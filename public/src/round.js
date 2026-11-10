import { CLUBS } from './clubs.js';
import { COURSE, surfaceAt } from './course.js';
import { HOLE_MANA_RECOVERY, manaRecovery, MAX_MANA, SPELL_MANA_COST } from './mana.js';
import { BALL_RADIUS, TEE_X } from './practice.js';
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

function passesCup(from, to, pin) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = dx * dx + dz * dz;
  const projection = length ? ((pin.x - from.x) * dx + (pin.z - from.z) * dz) / length : 0;
  const fraction = Math.max(0, Math.min(1, projection));
  return Math.hypot(from.x + fraction * dx - pin.x, from.z + fraction * dz - pin.z) <= .19;
}

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
    this.landing = null;
    this.previous = null;
    this.attemptedSpell = false;
    this.manaRecovered = 0;
    this.setAim(this.atTee ? this.hole.target : this.hole.pin);
    this.club = closestClub(this.surface, this.remaining);
    this.configure(practice);
  }

  configure(practice) {
    practice.configure(this.club, ball => surfaceAt(this.hole, this.worldPoint(ball)));
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

  canCast() {
    return this.mana >= SPELL_MANA_COST;
  }

  startShot(attemptedSpell = false) {
    if (this.status !== 'ready' || (attemptedSpell && !this.canCast())) return false;
    this.attemptedSpell = attemptedSpell;
    if (attemptedSpell) this.mana -= SPELL_MANA_COST;
    this.strokes++;
    this.previous = { ...this.lie, y: BALL_RADIUS };
    this.status = 'playing';
    return true;
  }

  track(practice) {
    if (this.status !== 'playing') return;
    const { ball } = practice;
    const point = { ...this.worldPoint(ball), y: ball.y };
    if (ball.y <= BALL_RADIUS) {
      const surface = surfaceAt(this.hole, point);
      if (surface === 'water' || surface === 'out') {
        this.strokes++;
        this.notice = (surface === 'water' ? 'Water' : 'Out of bounds') + ' · +1 penalty';
        this.endShot(practice, this.lie);
        return;
      }
      const speed = Math.hypot(ball.vx, ball.vz);
      if (practice.impact && this.previous.y <= BALL_RADIUS && speed <= 3.1 &&
          passesCup(this.previous, point, this.hole.pin)) {
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
