import { CLUBS } from './clubs.js';
import { COURSE, hitsTree, isFringe, surfaceAt } from './course.js';
import { HOLE_MANA_RECOVERY, manaRecovery, MAX_MANA, ROYAL_FLUSH_PURITY, spellManaCost } from './mana.js';
import { BALL_RADIUS, Practice, STEP, TEE_X } from './practice.js';
import { shotRanges } from './range-card.js';

export const CLUB_NAMES = Object.fromEntries(Object.entries(CLUBS).map(([id, club]) => [id, club.name]));
const swingClubs = Object.keys(CLUBS).filter(club => club !== 'putter');

function closestClub(surface, distance) {
  if (surface === 'green') return 'putter';
  let closest = swingClubs[0];
  let miss = Infinity;
  for (const club of swingClubs) {
    const carry = shotRanges(club, surface).at(-1).snap;
    const gap = Math.abs(distance - carry);
    if (gap < miss) {
      closest = club;
      miss = gap;
    }
  }
  return closest;
}

function cupMiss(from, to, pin) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = dx * dx + dz * dz;
  const projection = length ? ((pin.x - from.x) * dx + (pin.z - from.z) * dz) / length : 0;
  const fraction = Math.max(0, Math.min(1, projection));
  return Math.hypot(from.x + fraction * dx - pin.x, from.z + fraction * dz - pin.z);
}

const FLAT = { x: 0, z: 0 };

export class Round {
  constructor(holes = COURSE) {
    this.holes = holes;
    this.index = 0;
    this.card = [];
    this.mana = MAX_MANA;
    this.teeOff();
  }

  get hole() { return this.holes[this.index]; }
  get atTee() { return this.lie.x === this.hole.tee.x && this.lie.z === this.hole.tee.z; }
  get surface() { return surfaceAt(this.hole, this.lie); }
  get puttingRune() {
    const surface = this.surface;
    if (surface === 'green') return 'royal-flush';
    return isFringe(this.hole, this.lie, surface) ? 'texas-wedge' : null;
  }
  get remaining() { return Math.hypot(this.hole.pin.x - this.lie.x, this.hole.pin.z - this.lie.z); }
  get total() { return this.card.reduce((sum, score) => sum + score, 0); }
  get toPar() { return this.card.reduce((sum, score, i) => sum + score - this.holes[i].par, 0); }

  teeOff() {
    this.lie = { ...this.hole.tee };
    this.strokes = 0;
    this.status = 'ready';
  }

  prepare(practice) {
    this.status = 'ready';
    this.notice = '';
    this.hitTree = false;
    this.landing = null;
    this.previous = null;
    this.attemptedSpell = false;
    this.manaRecovered = 0;
    this.setAim(this.atTee ? this.hole.target : this.hole.pin);
    this.club = closestClub(this.surface, this.remaining);
    this.configure(practice);
  }

  configure(practice) {
    const surface = ball => surfaceAt(this.hole, this.worldPoint(ball));
    practice.configure(this.club, surface, ball => {
      if (surface(ball) !== 'green') return FLAT;
      const { x, z } = this.hole.green.slope ?? FLAT;
      return { x: x * this.forward.x + z * this.forward.z, z: z * this.forward.x - x * this.forward.z };
    });
  }

  selectClub(club, practice) {
    if (this.status !== 'ready' || !Object.hasOwn(CLUB_NAMES, club)) return false;
    this.club = club;
    this.configure(practice);
    return true;
  }

  setAim(target) {
    if (this.status !== 'ready') return false;
    const dx = target.x - this.lie.x;
    const dz = target.z - this.lie.z;
    if (Math.hypot(dx, dz) < .001) return false;
    this.aimTarget = { ...target };
    this.aim = Math.atan2(dz, dx);
    this.forward = { x: Math.cos(this.aim), z: Math.sin(this.aim) };
    return true;
  }

  worldPoint(local) {
    const { x, z } = this.forward;
    const forward = local.x - TEE_X;
    return { x: this.lie.x + forward * x - local.z * z, z: this.lie.z + forward * z + local.z * x };
  }

  localPoint(world) {
    const { x, z } = this.forward;
    const dx = world.x - this.lie.x;
    const dz = world.z - this.lie.z;
    return { x: TEE_X + dx * x + dz * z, z: -dx * z + dz * x };
  }

  canCast(type) {
    return this.mana >= spellManaCost(type);
  }

  startShot(attemptedSpell = false) {
    if (this.status !== 'ready' || (attemptedSpell && !this.canCast(attemptedSpell))) return false;
    this.attemptedSpell = attemptedSpell;
    if (attemptedSpell) this.mana -= spellManaCost(attemptedSpell);
    this.strokes++;
    this.previous = { ...this.lie, y: BALL_RADIUS };
    this.status = 'playing';
    return true;
  }

  putt(practice, charge, spell = null, attempt = false) {
    if (this.status !== 'ready' || this.club !== 'putter' || (attempt &&
        (attempt !== this.puttingRune || !this.canCast(attempt))) || (spell && spell.type !== attempt)) return false;
    const royal = spell?.type === 'royal-flush' && spell.purity >= ROYAL_FLUSH_PURITY;
    if (royal) this.setAim(this.hole.pin);
    this.startShot(attempt);
    practice.putt(charge, spell, royal ? this.localPoint(this.hole.pin) : null);
    practice.impact.runeAttempt = attempt;
    return true;
  }

  previewPutt(charge) {
    const practice = new Practice();
    this.configure(practice);
    practice.putt(charge);
    for (let i = 0; i < 8 / STEP && (practice.ball.vx || practice.ball.vz); i++) practice.step();
    return { distance: practice.distance, point: this.worldPoint(practice.ball) };
  }

  track(practice) {
    if (this.status !== 'playing') return;
    const { ball } = practice;
    let point = { ...this.worldPoint(ball), y: ball.y };
    const { impact } = practice;
    if (impact && !impact.royal && hitsTree(this.hole, point, this.lie)) {
      this.hitTree = true;
      Object.assign(ball, this.localPoint(this.previous), { y: BALL_RADIUS });
      practice.carry ??= practice.distance;
      point = { ...this.worldPoint(ball), y: ball.y };
    }
    if (ball.y <= BALL_RADIUS) {
      const surface = surfaceAt(this.hole, point);
      if (!impact?.royal && (surface === 'water' || surface === 'out')) {
        this.strokes++;
        this.notice = (surface === 'water' ? 'Water' : 'Out of bounds') + ' · +1 penalty';
        this.endShot(practice, this.lie);
        return;
      }
      if (this.hitTree) {
        this.endShot(practice, this.worldPoint(ball));
        return;
      }
      const speed = Math.hypot(ball.vx, ball.vz);
      const miss = cupMiss(this.previous, point, this.hole.pin);
      const catches = impact?.putt ? miss <= .11 && speed <= 1.9 - 7 * miss : miss <= .19 && speed <= 3.1;
      if (impact && this.previous.y <= BALL_RADIUS && catches) {
        Object.assign(ball, this.localPoint(this.hole.pin));
        this.endShot(practice, this.hole.pin);
        this.card.push(this.strokes);
        this.status = 'holed';
        return;
      }
    }

    this.previous = point;
    if (practice.phase === 'result' && ball.vx === 0 && ball.vy === 0 && ball.vz === 0) {
      this.endShot(practice, this.worldPoint(ball));
    }
  }

  endShot(practice, lie) {
    const miscast = this.attemptedSpell && !practice.spell;
    const recovery = this.notice || miscast ? 0 : manaRecovery(practice.spell, practice.impact);
    this.manaRecovered = Math.min(MAX_MANA - this.mana, recovery);
    this.mana += this.manaRecovered;
    this.landing = { ...lie };
    this.status = 'shot-over';
    practice.ball.vx = 0;
    practice.ball.vy = 0;
    practice.ball.vz = 0;
    practice.phase = 'result';
  }

  next(practice) {
    if (this.status === 'holed') {
      if (this.index === this.holes.length - 1) {
        this.status = 'complete';
        return;
      }
      this.index++;
      this.mana = Math.min(MAX_MANA, this.mana + HOLE_MANA_RECOVERY);
      this.teeOff();
    } else if (this.status === 'shot-over') {
      this.lie = this.landing;
    } else {
      return;
    }
    this.prepare(practice);
  }
}
