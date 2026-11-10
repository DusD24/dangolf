import { CLUBS } from './clubs.js';

export const STEP = 1 / 120;
export const METERS_PER_YARD = 0.9144;
export const BALL_RADIUS = 0.043;
export const TEE_X = 0.20;
export const SWING_PASS_ANGLE = .13;
const CLUB_RADIUS = 0.044;
const TETHER_LENGTH = 0.95;
export const FULL_PULL = 0.45;
export const PUTT_PULL = 0.23;
const MIN_PULL = 0.055;
const SNAP_WINDOW = .027;
const EARLY_LIMIT = .090;
const LATE_LIMIT = .069;
const CONTACT_GRACE = .115;
const SWING_DURATION = .92;
const GRAVITY = 9.81;
const TURF_BOUNCE = 0.12;
const ROLL_DECELERATION = 8.5;
const GREEN_DECELERATION = 3.2;
const TOP_DECELERATION = 5.2;
const SURFACES = {
  fairway: { carry: 1, bounce: 1, roll: 1, putt: 1.4, top: 1 },
  green: { carry: 1, bounce: .9, roll: GREEN_DECELERATION / ROLL_DECELERATION, putt: 1, top: .65 },
  rough: { carry: .76, bounce: .70, roll: 1.4, putt: 2.2, top: 4.5 },
  sand: { carry: .55, bounce: .45, roll: 2.3, putt: 3.5, top: 5.2 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = value => value * value * (3 - 2 * value);
const mix = (from, to, amount) => from + (to - from) * amount;

export function carryFromLie(surface) {
  return (SURFACES[surface] ?? SURFACES.fairway).carry;
}

function teeBall() {
  return { x: TEE_X, y: BALL_RADIUS, z: 0, vx: 0, vy: 0, vz: 0 };
}

// Sweep the club head against the stationary ball so a fast shot still makes contact.
function crossesBall(from, to, ball) {
  const dx = to.x - from.x;
  if (dx <= 0) return false;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;

  const bx = ball.x - from.x;
  const by = ball.y - from.y;
  const bz = ball.z - from.z;
  const t = clamp((bx * dx + by * dy + bz * dz) / lengthSquared, 0, 1);
  return Math.hypot(bx - t * dx, by - t * dy, bz - t * dz) <= BALL_RADIUS + CLUB_RADIUS;
}

export class Practice {
  constructor() {
    this.configure();
  }

  configure(club = 'driver', surfaceAt = () => 'fairway') {
    this.clubType = Object.hasOwn(CLUBS, club) ? club : 'driver';
    this.surfaceAt = surfaceAt;
    this.reset();
  }

  reset() {
    this.phase = 'ready';
    this.stroke = null;
    this.charge = 0;
    this.steer = 0;
    this.elapsed = 0;
    this.angle = 0.40;
    this.angularSpeed = 0;
    this.staffAngle = 0.32;
    this.startAngle = 0;
    this.clubPassedAt = null;
    this.castAt = null;
    this.castLabel = '';
    this.spell = null;
    this.guided = false;
    this.contact = null;
    this.expectedContactAt = null;
    this.turfAt = null;
    this.impact = null;
    this.ball = teeBall();
    this.carry = null;
    this.club = this.clubPose();
  }

  beginStroke(x, y, guided = false) {
    if (this.phase !== 'ready') return false;
    this.stroke = { x, y, depth: 0, drift: 0, guided };
    this.phase = 'drawing';
    return true;
  }

  moveStroke(x, y) {
    if (this.phase !== 'drawing') return;
    const stroke = this.stroke;
    const depth = y - stroke.y;
    stroke.depth = Math.max(stroke.depth, depth);
    const drift = x - stroke.x;
    if (stroke.depth - depth > 0.008 && Math.abs(drift) > Math.abs(stroke.drift)) {
      stroke.drift = drift;
    }
    const power = clamp(stroke.depth / FULL_PULL, 0, 1);
    const mark = Math.round(power * 4) / 4;
    this.charge = stroke.guided && mark > 0 && Math.abs(mark - power) <= .0125 ? mark : power;
    this.angle = 0.40 - 2.12 * this.charge;
    this.staffAngle = this.angle * 0.76;
    this.club = this.clubPose();
  }

  releaseStroke(x, y, spell = null) {
    if (this.phase !== 'drawing') return false;
    this.moveStroke(x, y);
    const { depth, drift, y: startY, guided } = this.stroke;
    if (depth < MIN_PULL || y - startY > 0.35 * depth) {
      this.cancelStroke();
      return false;
    }

    const deadZone = 0.025;
    const bend = Math.max(0, Math.abs(drift) - deadZone);
    this.steer = Math.sign(drift) * clamp(bend / 0.14, 0, 1);
    this.stroke = null;
    this.spell = spell;
    this.guided = guided;
    this.phase = 'swing';
    this.startAngle = -0.30 - 1.40 * this.charge;
    this.angle = this.startAngle;
    this.staffAngle = this.startAngle;
    this.club = this.clubPose();
    this.expectedContactAt = this.predictContact();
    return true;
  }

  putt(charge) {
    this.charge = clamp(charge, 0, 1);
    this.ball.vx = Math.sqrt(2 * GREEN_DECELERATION * 22) * this.charge;
    this.phase = 'result';
    this.impact = { at: this.elapsed, putt: true, stinger: 0, curve: 0 };
  }

  puttEstimate() {
    const surface = SURFACES[this.surfaceAt(this.ball)] ?? SURFACES.fairway;
    return 22 * this.charge ** 2 / surface.putt;
  }

  cancelStroke() {
    if (this.phase === 'drawing') this.reset();
  }

  get snapWindow() {
    return SNAP_WINDOW + (this.guided ? .009 : 0);
  }

  get snapCue() {
    return this.phase === 'swing' && this.castAt === null && !this.impact &&
      this.expectedContactAt !== null && Math.abs(this.elapsed - this.expectedContactAt) <= this.snapWindow;
  }

  snap() {
    if (this.phase !== 'swing' || this.castAt !== null || this.impact) return false;
    this.castAt = this.elapsed;
    if (this.contact) this.strikeBall();
    return true;
  }

  clubPose(angle = this.angle) {
    const yaw = this.steer * 0.48;
    const pivot = {
      x: 0,
      y: 1.005,
      z: this.steer * 0.10,
    };
    const arc = TETHER_LENGTH * Math.sin(angle);
    const dig = Math.exp(-(((angle + 0.12) / 0.52) ** 2));
    return {
      x: pivot.x + arc * Math.cos(yaw),
      y: pivot.y - TETHER_LENGTH * Math.cos(angle) - dig * 0.032 * this.steer ** 2,
      z: pivot.z + arc * Math.sin(yaw),
    };
  }

  step() {
    if (this.phase === 'swing') this.stepClub();
    else if (this.phase === 'result') this.elapsed += STEP;
    if (this.impact) this.stepBall();
  }

  advanceClub(arc) {
    arc.elapsed += STEP;
    const driveTime = 0.64 - 0.21 * this.charge;
    const progress = smooth(clamp(arc.elapsed / driveTime, 0, 1));
    arc.staffAngle = this.startAngle + (1.30 - this.startAngle) * progress;
    const drive = 88 * (arc.staffAngle - arc.angle) - 10 * arc.angularSpeed;
    arc.angularSpeed += drive * STEP;
    arc.angle += arc.angularSpeed * STEP;
    const next = this.clubPose(arc.angle);

    if (next.y < CLUB_RADIUS) {
      arc.turfAt ??= arc.elapsed;
      next.y = CLUB_RADIUS;
      arc.angularSpeed *= 0.82;
    }
    arc.club = next;
  }

  // The tap changes the ball strike, so the same club motion can predict the cue.
  predictContact() {
    const arc = { elapsed: this.elapsed, angle: this.angle, angularSpeed: this.angularSpeed,
      club: this.club, turfAt: null };
    while (arc.elapsed < SWING_DURATION) {
      const previous = arc.club;
      this.advanceClub(arc);
      if (crossesBall(previous, arc.club, this.ball)) return arc.turfAt === null ? arc.elapsed : null;
    }
    return null;
  }

  stepClub() {
    const previous = this.club;
    this.advanceClub(this);
    if (this.angle >= SWING_PASS_ANGLE) this.clubPassedAt ??= this.elapsed;
    const next = this.club;
    if (!this.contact && crossesBall(previous, next, this.ball)) {
      this.contact = {
        at: this.elapsed,
        angle: this.angle,
        club: next,
        speed: Math.hypot(next.x - previous.x, next.y - previous.y, next.z - previous.z) / STEP,
      };
    }
    if (this.contact && !this.impact &&
        (this.castAt !== null || this.elapsed - this.contact.at >= CONTACT_GRACE)) this.strikeBall();
    if (this.elapsed >= SWING_DURATION) this.phase = 'result';
  }

  strikeBall() {
    const { at, speed } = this.contact;
    const offset = this.castAt === null ? null : this.castAt - at;
    const early = offset !== null && offset < -EARLY_LIMIT;
    const late = offset !== null && offset > LATE_LIMIT;
    const kind = early || (this.turfAt !== null && this.turfAt <= at) ? 'chunk' : late ? 'top' : 'solid';
    const snapQuality = kind === 'solid' && offset !== null && Math.abs(offset) <= this.snapWindow ? 1 : 0;
    if (offset !== null) {
      this.castLabel = early ? 'Early snap' : late ? 'Late snap' : snapQuality ? 'Clean snap' : 'Near snap';
    }
    if (kind === 'chunk') this.turfAt ??= this.elapsed;

    const profile = CLUBS[this.clubType];
    const [beginner, average, good, advanced, tour] = profile.carry;
    const surface = this.surfaceAt(this.ball);
    const lie = SURFACES[surface] ?? SURFACES.fairway;
    const power = this.charge ** 1.65;
    const nearMiss = offset !== null && !snapQuality
      ? clamp((Math.abs(offset) - this.snapWindow) / ((offset < 0 ? EARLY_LIMIT : LATE_LIMIT) - this.snapWindow), 0, 1)
      : 0;
    const stock = snapQuality ? good : mix(average, beginner, .65 * nearMiss);
    const target = snapQuality ? tour : advanced;
    const potency = this.spell?.potency ?? 0;
    const stinger = kind === 'solid' && this.spell?.type === 'spear' ? potency : 0;
    const distanceWeight = this.spell?.type === 'star' ? 1 : this.spell?.type === 'crescent' ? .55 : .35;
    const shapeBonus = distanceWeight * potency ** 1.65;
    let loft = (.15 + profile.loft + .05 * this.charge + .018 * snapQuality) * (1 - .72 * stinger);
    let carry = mix(stock, target, shapeBonus) * power * lie.carry * (1 - .34 * stinger) *
      (1 - .33 * Math.abs(this.steer)) * METERS_PER_YARD;
    let launchSpeed;
    if (kind === 'chunk') {
      loft = surface === 'rough' ? 1.15 : 1.20;
      carry = (surface === 'rough' ? 5.5 + .024 * average : 2.25 + .007 * average) *
        this.charge ** .75 * METERS_PER_YARD;
    }
    if (kind === 'top') {
      loft = 0;
      this.carry = 0;
      const roll = surface === 'rough' ? 12.5 * .3048 : surface === 'sand' ? 2.5 :
        average * .39 * METERS_PER_YARD;
      launchSpeed = Math.sqrt(2 * TOP_DECELERATION * lie.top * roll * power);
    } else {
      launchSpeed = Math.sqrt(carry * GRAVITY / Math.sin(2 * loft));
    }

    const heading = this.steer * .88;
    const horizontal = launchSpeed * Math.cos(loft);
    this.ball.vx = horizontal * Math.cos(heading);
    this.ball.vy = launchSpeed * Math.sin(loft);
    this.ball.vz = horizontal * Math.sin(heading);
    this.impact = {
      kind, speed, launchY: this.ball.vy, at: this.elapsed, snapQuality,
      pure: kind === 'solid' && Boolean(this.spell?.guided && this.spell.purity >= .90),
      stinger,
      retention: kind === 'chunk' ? .13 : .31 - .18 * loft + .06 * stinger,
      curve: kind === 'solid' && this.spell?.type === 'crescent' ? 4.4 * this.spell.direction * potency : 0,
    };
  }

  stepBall() {
    const ball = this.ball;
    if (ball.vx === 0 && ball.vy === 0 && ball.vz === 0) return;
    ball.x += ball.vx * STEP;
    ball.z += ball.vz * STEP;

    const { curve, stinger, putt, retention, kind } = this.impact;
    if (ball.y > BALL_RADIUS || ball.vy > 0) {
      if (curve && this.carry === null) {
        const turn = curve * STEP / Math.hypot(ball.vx, ball.vz);
        const sin = Math.sin(turn);
        const cos = Math.cos(turn);
        const forward = ball.vx;
        ball.vx = forward * cos - ball.vz * sin;
        ball.vz = forward * sin + ball.vz * cos;
      }
      ball.vy -= GRAVITY * STEP;
      ball.y += ball.vy * STEP;
      if (ball.y > BALL_RADIUS) return;
      this.carry ??= Math.hypot(ball.x - TEE_X, ball.z);
      ball.y = BALL_RADIUS;
      const rebound = -TURF_BOUNCE * ball.vy * (1 - .82 * stinger);
      ball.vy = rebound > .42 ? rebound : 0;
      const surface = SURFACES[this.surfaceAt(ball)] ?? SURFACES.fairway;
      ball.vx *= retention * surface.bounce;
      ball.vz *= retention * surface.bounce;
      return;
    }

    const speed = Math.hypot(ball.vx, ball.vz);
    const surface = SURFACES[this.surfaceAt(ball)] ?? SURFACES.fairway;
    const drag = putt ? GREEN_DECELERATION * surface.putt : kind === 'top' ? TOP_DECELERATION * surface.top :
      ROLL_DECELERATION * surface.roll * (1 - 0.30 * stinger);
    const roll = Math.max(0, 1 - drag * STEP / speed);
    ball.vx *= roll;
    ball.vz *= roll;
  }

  get distance() {
    return Math.hypot(this.ball.x - TEE_X, this.ball.z);
  }
}
