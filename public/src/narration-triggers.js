import { surfaceAt } from './course.js';
import { ROYAL_FLUSH_PURITY } from './mana.js';
import { BALL_RADIUS, METERS_PER_YARD } from './practice.js';
import { SECOND_TOP_LINES, THIRD_TOP_LINES } from './voice-lines.js';

const FOOT = .3048;
// World-coordinate subtraction can put an exact yard/foot boundary a few ulps away.
const atMost = (value, limit) => value <= limit + 1e-6;
const atLeast = (value, limit) => value >= limit - 1e-6;
const reaction = (id, important = false) => ({ id, important });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angle = value => Math.atan2(Math.sin(value), Math.cos(value));

function segment(from, to, point) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (!length) return null;
  const along = ((point.x - from.x) * dx + (point.z - from.z) * dz) / length;
  const t = Math.max(0, Math.min(1, along / length));
  return { length, along, t, miss: distance({ x: from.x + t * dx, z: from.z + t * dz }, point),
    side: (dx * (point.z - from.z) - dz * (point.x - from.x)) / length,
    nx: -dz / length, nz: dx / length, heading: Math.atan2(dz, dx) };
}

// The fairway must actually turn, the ball must pass its corner, and the observed
// flight must bend in the matching direction. A Crescent on a straight hole is ordinary.
function followedDogleg(shot, end) {
  const stations = shot.hole?.fairway ?? [];
  for (let i = 1; i < stations.length - 1; i++) {
    const a = stations[i - 1];
    const b = stations[i];
    const c = stations[i + 1];
    const turn = angle(Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x));
    if (Math.abs(turn) < .20 || shot.start.x >= b.x || end.x < b.x + 8) continue;
    if (Math.sign(shot.spell?.direction) === Math.sign(turn) && shot.bend * Math.sign(turn) >= .035) return true;
  }
  return false;
}

function threadedGap(shot) {
  const nearby = [...shot.obstacles.values()];
  return nearby.some((a, i) => nearby.slice(i + 1).some(b =>
    a.side * b.side < 0 && Math.abs(a.travel - b.travel) <= 15 &&
    Math.abs(angle(a.heading - b.heading)) < .2 && a.clearance + b.clearance <= 24));
}

/** Pure shot-to-line classification; playback and cooldown live elsewhere. */
export class ShotNarration {
  constructor() { this.beginRound(); }

  beginRound() {
    this.active = null;
    this.chunks = 0;
    this.tops = 0;
    this.secondTop = 0;
    this.thirdTop = 0;
    this.trees = 0;
    this.thirdChunk = 0;
    this.birdies = 0;
    this.holeIndex = null;
    this.holePutts = 0;
    this.holePenalty = false;
  }

  beginShot(round, practice, attempted = false) {
    if (round && this.holeIndex !== round.index) {
      this.holeIndex = round.index;
      this.holePutts = 0;
      this.holePenalty = false;
    }
    const start = round ? { ...round.lie } : { x: practice.ball.x, z: practice.ball.z };
    this.active = {
      start, surface: round ? round.surface : practice.surfaceAt(practice.ball),
      remaining: round?.remaining ?? null, mana: round?.mana ?? null,
      club: round?.club ?? practice.clubType, spell: practice.spell ? { ...practice.spell } : null,
      attempted: attempted || round?.attemptedSpell || practice.impact?.runeAttempt || false,
      priorChunks: this.chunks, priorTrees: this.trees, hole: round?.hole ?? null,
      previous: { ...start, y: practice.ball.y }, speed: Math.hypot(practice.ball.vx, practice.ball.vz),
      hot: false, travel: 0, firstHeading: null, bend: 0, obstacles: new Map(),
    };
  }

  cancelShot() { this.active = null; }

  observe(round, practice) {
    const shot = this.active;
    if (!shot) return;
    const point = { ...(round ? round.worldPoint(practice.ball) : practice.ball), y: practice.ball.y };
    const speed = Math.hypot(practice.ball.vx, practice.ball.vz);
    const path = segment(shot.previous, point, shot.hole?.pin ?? point);
    if (path && path.length > .0001) {
      if (practice.impact?.putt && shot.hole && point.y <= BALL_RADIUS + .02 &&
          shot.previous.y <= BALL_RADIUS + .02 && path.miss <= .25 && Math.max(speed, shot.speed) > 1.9) shot.hot = true;
      if (practice.impact && !practice.impact.putt && practice.carry === null) {
        shot.firstHeading ??= path.heading;
        shot.bend = angle(path.heading - shot.firstHeading);
      }
      if (shot.spell?.type === 'spear' && practice.impact?.stinger >= .3) {
        const obstacles = [...(shot.hole?.hazards ?? []), ...(shot.hole?.trees ?? [])];
        for (const obstacle of obstacles) {
          if (obstacle.height && point.y > obstacle.height) continue;
          const pass = segment(shot.previous, point, obstacle);
          if (pass.along < 0 || pass.along > pass.length) continue;
          const radius = obstacle.radius ? (point.y >= obstacle.height * .28 ? obstacle.radius : .48) :
            Math.hypot(obstacle.rx * pass.nx, obstacle.rz * pass.nz);
          const clearance = Math.abs(pass.side) - radius;
          if (clearance < .3 || clearance > 12) continue;
          const previous = shot.obstacles.get(obstacle);
          if (!previous || clearance < previous.clearance) shot.obstacles.set(obstacle,
            { clearance, side: pass.side, heading: pass.heading, travel: shot.travel + pass.along });
        }
      }
      shot.travel += path.length;
    }
    shot.previous = point;
    shot.speed = speed;
  }

  finish(round, practice) {
    const shot = this.active;
    if (!shot) return null;
    this.observe(round, practice);
    this.active = null; // A settled shot is consumed exactly once, even if no line qualifies.
    const impact = practice.impact;
    const spell = practice.spell;
    const end = round ? (round.landing ?? round.worldPoint(practice.ball)) : practice.ball;
    const surface = round ? surfaceAt(round.hole, end) : practice.surfaceAt(practice.ball);
    const chunk = impact?.kind === 'chunk' && practice.turfAt != null;
    this.chunks = chunk ? this.chunks + 1 : 0;
    this.tops = impact?.kind === 'top' ? this.tops + 1 : 0;
    this.trees = round?.hitTree ? this.trees + 1 : 0;
    // Alternate at the third chunk of each distinct streak, even when a hazard wins the line.
    const third = chunk && this.chunks === 3 ? (this.thirdChunk++ % 2 ? 'chunk-delving' : 'chunk-dwarf') : null;
    const putt = Boolean(impact?.putt || shot.club === 'putter');
    if (round && putt) this.holePutts++;
    const notice = round?.notice ?? '';
    const penalty = /water|out of bounds/i.test(notice);
    if (penalty) this.holePenalty = true;

    if (round?.status === 'holed') {
      const score = round.strokes - shot.hole.par;
      this.birdies = score <= -1 ? this.birdies + 1 : 0;
      if (round.strokes === 1) return reaction('ace', true);
      if (!putt) return reaction(atMost(shot.remaining, 30 * METERS_PER_YARD) ? 'chip-in' : 'hole-out', true);
      if (spell?.type === 'royal-flush' && spell.purity >= ROYAL_FLUSH_PURITY) return reaction('royal', true);
      if (!spell && atLeast(shot.remaining, 25 * FOOT)) return reaction('long-putt', true);
      if (this.birdies === 3) return reaction('birdie-streak', true);
      if (score <= -3) return reaction('albatross', true);
      if (score === -2) return reaction('eagle', true);
      if (score === 0 && this.holePenalty) return reaction('par-save', true);
      if (this.holePutts >= 3) return reaction('three-putt');
      return reaction(score === -1 ? 'birdie' : score === 0 ? 'par' : score === 1 ? 'bogey' : 'double');
    }
    if (/water/i.test(notice) || surface === 'water') return reaction('water');
    if (/out of bounds/i.test(notice) || surface === 'out') return reaction('out');
    if (round?.hitTree) return reaction(this.trees >= 2 ? 'tree-again' : 'tree');
    if (chunk) {
      if (third) return reaction(third, true);
      if (shot.surface === 'rough' && surface === 'fairway') return reaction('chunk-recovery');
      return reaction(this.chunks === 1 ? 'chunk-first' : this.chunks === 2 ? 'chunk-second' : 'chunk-later');
    }
    if (!impact) return reaction('whiff');
    if (this.tops === 2) return reaction(SECOND_TOP_LINES[this.secondTop++ % SECOND_TOP_LINES.length], true);
    if (this.tops === 3) return reaction(THIRD_TOP_LINES[this.thirdTop++ % THIRD_TOP_LINES.length], true);
    if (shot.attempted && !spell) return reaction('miscast');
    if (spell?.type === 'royal-flush' && spell.purity < ROYAL_FLUSH_PURITY) return reaction('royal-fail');
    if (impact.kind === 'top') return reaction(shot.surface === 'rough' && atMost(distance(shot.start, end), 16 * FOOT) ? 'rough-top' : 'top');
    if (surface === 'sand' && shot.surface !== 'sand') return reaction('bunker');
    if (shot.surface === 'green' && surface !== 'green') return reaction('green-exit');
    if (shot.surface === 'sand' && surface === 'green') return reaction('bunker-recovery');
    if (shot.priorTrees && surface === 'fairway') return reaction('tree-recovery');
    if (putt && round) {
      if (shot.hot) return reaction('hot-putt');
      const remaining = round ? distance(end, shot.hole.pin) : null;
      if (atMost(shot.remaining, 5 * FOOT)) return reaction('short-miss');
      if (atLeast(shot.remaining, 30 * FOOT) && atMost(remaining, 3 * FOOT)) return reaction('lag');
    }
    const safe = surface === 'fairway' || surface === 'green';
    if (impact.kind === 'solid' && safe) {
      if (spell?.type === 'star' && atLeast(practice.carry, 260 * METERS_PER_YARD)) return reaction('star');
      if (spell?.type === 'crescent' && surface === 'fairway' && followedDogleg(shot, end)) return reaction('crescent');
      if (spell?.type === 'spear' && impact.stinger >= .3 && threadedGap(shot)) return reaction('spear');
      if (spell?.type === 'texas-wedge' && surface === 'green') return reaction('texas');
      if (shot.priorChunks) return reaction('redemption');
      if (!spell && shot.mana !== null && shot.mana < 40 && round.mana >= 40) return reaction('mana-restored');
      if (!spell && !putt && impact.snapQuality) return reaction('clean-snap');
    }
    return null;
  }
}
