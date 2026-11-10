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
const SNAP_CUE_START = 0.068;
const SNAP_CUE_END = 0.034;
const DRIVER_LEVERAGE = 4.7;
const TURF_BOUNCE = 0.12;
const TURF_SPEED_RETENTION = 0.47;
const ROLL_DECELERATION = 8.5;
const GREEN_DECELERATION = 3.2;
const SURFACES = {
  fairway: { launch: 1, bounce: 1, roll: 1, putt: 1.4 },
  green: { launch: 1, bounce: .9, roll: GREEN_DECELERATION / ROLL_DECELERATION, putt: 1 },
  rough: { launch: .86, bounce: .78, roll: 1.4, putt: 2.2 },
  sand: { launch: .72, bounce: .48, roll: 2.3, putt: 3.5 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = value => value * value * (3 - 2 * value);

function teeBall() {
  return { x: TEE_X, y: BALL_RADIUS, z: 0, vx: 0, vy: 0, vz: 0 };
}

// Sweep the club head against the stationary ball so a fast shot still makes contact.
function crossesBall(from, to, ball) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  if (lengthSquared === 0) return false;

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
    this.spellSnapEnergy = 1;
    this.snapStrength = 0;
    this.earlyPull = 0;
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
    const { depth, drift, y: startY } = this.stroke;
    if (depth < MIN_PULL || y - startY > 0.35 * depth) {
      this.cancelStroke();
      return false;
    }

    const deadZone = 0.025;
    const bend = Math.max(0, Math.abs(drift) - deadZone);
    this.steer = Math.sign(drift) * clamp(bend / 0.14, 0, 1);
    this.stroke = null;
    this.spell = spell;
    this.phase = 'swing';
    this.startAngle = -0.30 - 1.40 * this.charge;
    this.angle = this.startAngle;
    this.staffAngle = this.startAngle;
    this.club = this.clubPose();
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

  get snapCue() {
    if (this.phase !== 'swing' || this.castAt !== null || this.impact || this.angularSpeed < 1) {
      return false;
    }
    const grace = this.spell?.guided ? .014 : 0;
    return this.approachTime <= SNAP_CUE_START + grace && this.approachTime >= SNAP_CUE_END - grace;
  }

  get approachTime() {
    return (SWING_PASS_ANGLE - this.angle) / Math.max(0.01, this.angularSpeed);
  }

  snap() {
    if (this.phase !== 'swing' || this.castAt !== null) return false;
    const atCue = this.snapCue;
    this.castAt = this.elapsed;
    const lead = this.approachTime;
    const grace = this.spell?.guided ? .014 : 0;
    const late = this.impact || lead < SNAP_CUE_END - grace;
    this.castLabel = late ? 'Late cast' : atCue ? 'Clean snap' : 'Early cast';

    const alignment = Math.exp(-(((lead - 0.052) / 0.024) ** 2));
    if (this.spell) {
      if (atCue) this.spellSnapEnergy = 1 + 0.10 * alignment;
      return true;
    }

    // A taut tether sends the snap into the swing. An early pull drags the head into the turf.
    this.snapStrength = 0.30 + 0.70 * alignment;
    this.earlyPull = clamp((lead - SNAP_CUE_START) / 0.14, 0, 1);
    return true;
  }

  clubPose() {
    const yaw = this.steer * 0.48;
    const pivot = {
      x: 0,
      y: 1.005,
      z: this.steer * 0.10,
    };
    const arc = TETHER_LENGTH * Math.sin(this.angle);
    const dig = Math.exp(-(((this.angle + 0.12) / 0.52) ** 2));
    return {
      x: pivot.x + arc * Math.cos(yaw),
      y: pivot.y - TETHER_LENGTH * Math.cos(this.angle) - dig * (
        0.032 * this.steer ** 2 + 0.22 * this.earlyPull
      ),
      z: pivot.z + arc * Math.sin(yaw),
    };
  }

  step() {
    if (this.phase === 'swing') this.stepClub();
    else if (this.phase === 'result') this.elapsed += STEP;
    if (this.impact) this.stepBall();
  }

  stepClub() {
    this.elapsed += STEP;
    const driveTime = 0.64 - 0.21 * this.charge;
    const progress = smooth(clamp(this.elapsed / driveTime, 0, 1));
    this.staffAngle = this.startAngle + (1.30 - this.startAngle) * progress;

    const castAge = this.castAt === null ? -1 : this.elapsed - this.castAt;
    const snapPulse = castAge > 0 && castAge < 0.14
      ? this.snapStrength * Math.sin(Math.PI * castAge / 0.14)
      : 0;
    const drive = 88 * (this.staffAngle - this.angle) - 10 * this.angularSpeed;
    this.angularSpeed += (drive + 225 * snapPulse) * STEP;
    this.angle += this.angularSpeed * STEP;
    if (this.angle >= SWING_PASS_ANGLE) this.clubPassedAt ??= this.elapsed;
    const previous = this.club;
    const next = this.clubPose();

    if (next.y < CLUB_RADIUS) {
      this.turfAt ??= this.elapsed;
      next.y = CLUB_RADIUS;
      this.angularSpeed *= 0.82;
    }
    this.club = next;

    if (!this.impact && next.x > previous.x && crossesBall(previous, next, this.ball)) {
      this.strikeBall(previous, snapPulse);
    }
    if (this.elapsed >= 0.92) this.phase = 'result';
  }

  strikeBall(previous, snapPulse) {
    const speed = Math.hypot(
      this.club.x - previous.x,
      this.club.y - previous.y,
      this.club.z - previous.z,
    ) / STEP;
    const runeCharge = (this.spell?.purity ?? 0) * this.charge;
    const stinger = this.spell?.type === 'spear' ? this.spell.potency : 0;
    const spellEnergy = this.spell?.type === 'star' ? 1 + 0.25 * this.spell.potency : 1;
    const profile = CLUBS[this.clubType];
    const lie = SURFACES[this.surfaceAt(this.ball)] ?? SURFACES.fairway;
    const loft = Math.max(0.045, profile.loft + 0.055 + 0.12 * this.charge + 0.22 * snapPulse +
      0.16 * runeCharge - 0.22 * stinger);
    const heading = this.steer * 0.88;
    const transfer = 0.90 - 0.17 * Math.abs(this.steer);
    const launchSpeed = speed * transfer * DRIVER_LEVERAGE * profile.speed * lie.launch * (1 + 0.47 * runeCharge) *
      Math.sqrt(spellEnergy * this.spellSnapEnergy);
    const horizontal = launchSpeed * Math.cos(loft);
    this.ball.vx = horizontal * Math.cos(heading);
    this.ball.vy = launchSpeed * Math.sin(loft);
    this.ball.vz = horizontal * Math.sin(heading);
    this.impact = {
      speed,
      launchY: this.ball.vy,
      at: this.elapsed,
      spellEnergy,
      snapEnergy: this.spellSnapEnergy,
      pure: Boolean(this.spell?.guided && this.spell.purity >= .90 && this.turfAt === null),
      stinger,
      curve: this.spell?.type === 'crescent' ? 4.4 * this.spell.direction * this.spell.potency : 0,
    };
  }

  stepBall() {
    const ball = this.ball;
    if (ball.vx === 0 && ball.vy === 0 && ball.vz === 0) return;
    ball.x += ball.vx * STEP;
    ball.z += ball.vz * STEP;

    const { curve, stinger, putt } = this.impact;
    if (ball.y > BALL_RADIUS || ball.vy > 0) {
      if (curve && this.carry === null) {
        const turn = curve * STEP / Math.hypot(ball.vx, ball.vz);
        const sin = Math.sin(turn);
        const cos = Math.cos(turn);
        const forward = ball.vx;
        ball.vx = forward * cos - ball.vz * sin;
        ball.vz = forward * sin + ball.vz * cos;
      }
      ball.vy -= 9.81 * STEP;
      ball.y += ball.vy * STEP;
      if (ball.y > BALL_RADIUS) return;
      this.carry ??= Math.hypot(ball.x - TEE_X, ball.z);
      ball.y = BALL_RADIUS;
      ball.vy = ball.vy < -0.60 ? -TURF_BOUNCE * ball.vy : 0;
      const surface = SURFACES[this.surfaceAt(ball)] ?? SURFACES.fairway;
      const retention = (TURF_SPEED_RETENTION + 0.10 * stinger) * surface.bounce;
      ball.vx *= retention;
      ball.vz *= retention;
      return;
    }

    const speed = Math.hypot(ball.vx, ball.vz);
    const surface = SURFACES[this.surfaceAt(ball)] ?? SURFACES.fairway;
    const drag = putt ? GREEN_DECELERATION * surface.putt :
      ROLL_DECELERATION * surface.roll * (1 - 0.30 * stinger);
    const roll = Math.max(0, 1 - drag * STEP / speed);
    ball.vx *= roll;
    ball.vz *= roll;
  }

  get distance() {
    return Math.hypot(this.ball.x - TEE_X, this.ball.z);
  }
}
