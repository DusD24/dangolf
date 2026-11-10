export const STEP = 1 / 120;
export const BALL_RADIUS = 0.043;
export const TEE_X = 0.20;
const CLUB_RADIUS = 0.044;
const TETHER_LENGTH = 0.95;
const MAX_PULL = 0.45;
const MIN_PULL = 0.055;
const SNAP_CUE_START = 0.068;
const SNAP_CUE_END = 0.034;

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
    this.castAt = null;
    this.castLabel = '';
    this.snapStrength = 0;
    this.earlyPull = 0;
    this.turfAt = null;
    this.impact = null;
    this.ball = teeBall();
    this.carry = null;
    this.club = this.clubPose();
  }

  beginStroke(x, y) {
    if (this.phase !== 'ready') return false;
    this.stroke = { x, y, depth: 0, drift: 0 };
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
    this.charge = clamp(stroke.depth / MAX_PULL, 0, 1);
    this.angle = 0.40 - 2.12 * this.charge;
    this.staffAngle = this.angle * 0.76;
    this.club = this.clubPose();
  }

  releaseStroke(x, y) {
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
    this.phase = 'swing';
    this.startAngle = -0.30 - 1.40 * this.charge;
    this.angle = this.startAngle;
    this.staffAngle = this.startAngle;
    this.club = this.clubPose();
    return true;
  }

  cancelStroke() {
    if (this.phase === 'drawing') this.reset();
  }

  get snapCue() {
    if (this.phase !== 'swing' || this.castAt !== null || this.impact || this.angularSpeed < 1) {
      return false;
    }
    return this.approachTime <= SNAP_CUE_START && this.approachTime >= SNAP_CUE_END;
  }

  get approachTime() {
    return (0.13 - this.angle) / Math.max(0.01, this.angularSpeed);
  }

  snap() {
    if (this.phase !== 'swing' || this.castAt !== null) return false;
    const atCue = this.snapCue;
    this.castAt = this.elapsed;
    const lead = this.approachTime;
    const late = this.impact || lead < SNAP_CUE_END;
    this.castLabel = late ? 'Late cast' : atCue ? 'Clean snap' : 'Early cast';

    // A taut tether sends the spell into the swing. Pulling on it too soon
    // spends more of that force dragging the head toward the turf.
    const alignment = Math.exp(-(((lead - 0.052) / 0.024) ** 2));
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
        0.075 * this.steer ** 2 + 0.22 * this.earlyPull
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
    const loft = 0.055 + 0.12 * this.charge + 0.22 * snapPulse;
    const heading = this.steer * 0.88;
    const transfer = 0.90 - 0.17 * Math.abs(this.steer);
    const horizontal = speed * transfer * Math.cos(loft);
    this.ball.vx = horizontal * Math.cos(heading);
    this.ball.vy = speed * transfer * Math.sin(loft);
    this.ball.vz = horizontal * Math.sin(heading);
    this.impact = { speed, launchY: this.ball.vy, at: this.elapsed };
  }

  stepBall() {
    const ball = this.ball;
    if (ball.vx === 0 && ball.vy === 0 && ball.vz === 0) return;
    ball.x += ball.vx * STEP;
    ball.z += ball.vz * STEP;

    if (ball.y > BALL_RADIUS || ball.vy > 0) {
      ball.vy -= 9.81 * STEP;
      ball.y += ball.vy * STEP;
      if (ball.y > BALL_RADIUS) return;
      this.carry ??= Math.hypot(ball.x - TEE_X, ball.z);
      ball.y = BALL_RADIUS;
      ball.vy = ball.vy < -0.60 ? -0.31 * ball.vy : 0;
      ball.vx *= 0.79;
      ball.vz *= 0.79;
      return;
    }

    const speed = Math.hypot(ball.vx, ball.vz);
    const roll = Math.max(0, 1 - 1.65 * STEP / speed);
    ball.vx *= roll;
    ball.vz *= roll;
  }

  get distance() {
    return Math.hypot(this.ball.x - TEE_X, this.ball.z);
  }
}
