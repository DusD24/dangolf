import { CLUB_HEADS, CLUBS } from './clubs.js';
import { TEE_X } from './practice.js';

const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const shapes = Object.fromEntries(Object.entries({
  leftBoot: 'M-26 -10 Q-18 -16 -7 -10 L-5 0 Q-16 5 -35 1 Q-38 -2 -26 -10Z',
  rightBoot: 'M11 -11 Q21 -17 27 -8 Q41 -4 36 3 Q23 8 8 2Z',
  hem: 'M-19 -70 Q-27 -48 -25 -28 L-37 -8 Q-16 6 25 -3 L38 -10 Q24 -34 19 -69Z',
  hemTrim: 'M-35 -12 Q-16 0 11 -6 Q27 -8 35 -13 L38 -9 Q25 1 3 1 Q-23 5 -37 -8Z',
  foldA: 'M-20 -65 Q-13 -39 -26 -11 Q-17 -9 -12 -10 Q0 -44 -10 -65Z',
  foldB: 'M3 -67 Q-8 -41 4 -6 L13 -7 Q10 -40 17 -67Z',
  coat: 'M-17 -119 Q-37 -109 -32 -90 L-22 -61 Q-4 -48 24 -59 L30 -86 Q31 -111 13 -119Z',
  cape: 'M-20 -113 Q-36 -94 -35 -63 L-39 -26 Q-20 -14 -5 -30 Q-12 -65 8 -110Z',
  capeTrim: 'M-26 -102 Q-35 -71 -35 -29 Q-22 -21 -9 -29 L-5 -32 Q-20 -24 -32 -32 Q-31 -75 -23 -102Z',
  belt: 'M-25 -69 Q-5 -60 23 -67 L25 -60 Q1 -52 -24 -60Z',
  mantle: 'M-26 -111 Q-18 -124 2 -125 Q22 -125 29 -111 Q19 -91 -1 -91 Q-18 -93 -26 -111Z',
  mantleTrim: 'M-25 -113 Q-10 -96 1 -96 Q17 -97 27 -113 L29 -110 Q17 -91 1 -91 Q-15 -93 -26 -110Z',
  hair: 'M-23 -151 Q-16 -169 5 -165 Q23 -163 23 -144 L18 -123 Q8 -111 -10 -116 Q-25 -127 -23 -151Z',
  face: 'M12 -155 Q23 -156 24 -142 L33 -136 Q31 -132 24 -130 L22 -120 Q15 -117 11 -126Z',
  beard: 'M16 -132 Q23 -131 26 -134 Q23 -126 23 -121 Q27 -111 18 -94 L13 -103 Q9 -107 12 -119Z',
  hat: 'M-28 -159 Q-26 -181 -13 -195 L10 -219 L2 -200 Q8 -197 13 -191 L27 -161Z',
  hatLight: 'M-23 -162 Q-19 -187 2 -210 L-7 -193 Q-16 -178 -10 -164Z',
  hatBand: 'M-27 -169 Q-3 -163 22 -171 L27 -162 Q1 -153 -29 -160Z',
  brim: 'M-43 -161 Q-31 -167 -7 -164 Q17 -161 42 -166 Q44 -158 30 -152 Q-2 -147 -33 -152 Q-43 -153 -43 -161Z',
}).map(([id, value]) => [id, new Path2D(value)]));
const heads = Object.fromEntries(Object.entries(CLUB_HEADS).map(([id, value]) => [id, new Path2D(value)]));

function fill(ctx, id, color, border) {
  const path = shapes[id];
  ctx.fillStyle = color;
  ctx.fill(path);
  if (border) {
    ctx.strokeStyle = border;
    ctx.stroke(path);
  }
}

function shade(ctx, x, y, x2, y2, light, dark) {
  const gradient = ctx.createLinearGradient(x, y, x2, y2);
  gradient.addColorStop(0, light);
  gradient.addColorStop(1, dark);
  return gradient;
}

function oval(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawnArm(ctx, shoulder, grip, elbow, size, front) {
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.quadraticCurveTo(elbow.x, elbow.y, grip.x, grip.y);
  ctx.lineCap = 'round';
  ctx.lineWidth = size * .174;
  ctx.strokeStyle = '#201d32';
  ctx.stroke();
  ctx.lineWidth = size * .136;
  ctx.strokeStyle = front ? shade(ctx, shoulder.x, shoulder.y, grip.x, grip.y, '#8b73ad', '#4a3d69') : '#3e355a';
  ctx.stroke();
}

function clubPose(practice, profile) {
  let angle = practice.angle;
  let tip = { ...practice.club };
  if (profile.head === 'putter') {
    const forward = practice.impact ? Math.sin(Math.PI * clamp(practice.elapsed / .38)) * .23 : 0;
    angle = forward - (practice.phase === 'drawing' ? practice.charge * .24 : 0);
    tip = { x: TEE_X - .10 + angle, y: .067 + Math.abs(angle) * .10, z: 0 };
  } else {
    const arc = clamp((Math.abs(angle) - .32) / 1.12);
    const turn = arc * arc * (3 - 2 * arc);
    tip.y += turn * (angle < 0 ? .43 : .77);
    tip.z += turn * (angle < 0 ? .30 : -.79);
  }

  const lift = Math.abs(Math.sin(angle));
  const grip = {
    x: -.10 + .23 * Math.sin(angle + .25),
    y: .84 + .43 * lift,
    z: -.42 + .11 * Math.sin(angle),
  };
  const dx = grip.x - tip.x;
  const dy = grip.y - tip.y;
  const dz = grip.z - tip.z;
  const length = Math.hypot(dx, dy, dz);
  return {
    angle, tip,
    grip: {
      x: tip.x + dx * profile.length / length,
      y: tip.y + dy * profile.length / length,
      z: tip.z + dz * profile.length / length,
    },
  };
}

function drawStaff(ctx, grip, tip, profile, size, shining) {
  const dx = tip.x - grip.x;
  const dy = tip.y - grip.y;
  const angle = Math.atan2(dy, dx);
  const length = Math.hypot(dx, dy);
  ctx.save();
  ctx.translate(grip.x, grip.y);
  ctx.rotate(angle);
  const width = Math.max(2.4, size * .037);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-width * .7, 0);
  ctx.lineTo(length, 0);
  ctx.lineWidth = width + 2;
  ctx.strokeStyle = '#241a2d';
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = shade(ctx, 0, 0, length, 0, '#513345', '#bc8c64');
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width, -width * .25);
  ctx.lineTo(length - width * .4, -width * .25);
  ctx.lineWidth = .9;
  ctx.strokeStyle = '#f2bd806b';
  ctx.stroke();

  for (const band of [.10, .24, .55, .82, .94]) {
    const x = length * band;
    ctx.fillStyle = band === .24 || band === .82 ? '#d6a76b' : '#9d704e';
    ctx.fillRect(x, -width * .62, Math.max(1.5, width * .62), width * 1.24);
  }
  ctx.strokeStyle = '#f7d39895';
  ctx.lineWidth = .9;
  ctx.beginPath();
  for (let i = 2; i < 13; i++) {
    const x = i * length / 16;
    ctx.moveTo(x - width * .45, width * .34);
    ctx.lineTo(x, -width * .40);
    ctx.lineTo(x + width * .43, width * .20);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle - Math.PI / 2 + profile.loft * .65);
  const headScale = Math.max(.42, size * .0067) * profile.size;
  ctx.scale(headScale, headScale);
  ctx.shadowBlur = shining ? 24 : 13;
  ctx.shadowColor = shining ? '#ffe5a4' : '#80f1e3';
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = shining ? '#fff3c2' : '#b8fff1';
  ctx.fillStyle = shade(ctx, -8, -9, 13, 8, shining ? '#fff8cc' : '#d5fff5', shining ? '#d28651' : '#4f95a4');
  ctx.fill(heads[profile.head]);
  ctx.stroke(heads[profile.head]);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  for (let y = -3; y <= 4; y += 2.3) {
    ctx.moveTo(-5, y);
    ctx.lineTo(7, y - .4);
  }
  ctx.lineWidth = .75;
  ctx.strokeStyle = '#2d657584';
  ctx.stroke();
  ctx.restore();
}

export function drawWizard(ctx, point, practice) {
  const profile = CLUBS[practice.clubType];
  const pose = clubPose(practice, profile);
  const foot = point(-.42, 0, -.78);
  const grip = point(pose.grip.x, pose.grip.y, pose.grip.z);
  const tip = point(pose.tip.x, pose.tip.y, pose.tip.z);
  const size = foot.scale;
  const back = clamp(-pose.angle / 1.7);
  const finish = clamp((pose.angle - .36) / .98);
  const lean = .05 + back * .21 - finish * .18;
  const shift = (back * 10 - finish * 13) * size / 100;
  const crouch = (5 + back * 8 - finish * 7) * size / 100;

  oval(ctx, foot.x + size * .025, foot.y, size * .40, size * .086, '#101e2799');
  ctx.save();
  ctx.translate(foot.x, foot.y);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6;
  fill(ctx, 'leftBoot', '#272234', '#171625');
  fill(ctx, 'rightBoot', '#3d2b3c', '#211d2e');
  ctx.rotate(lean * .35);
  fill(ctx, 'hem', shade(ctx, -33, -50, 38, -15, '#60517d', '#292943'), '#24223b');
  fill(ctx, 'foldA', '#a486ad50');
  fill(ctx, 'foldB', '#201e3c70');
  fill(ctx, 'hemTrim', '#b8875c');
  ctx.restore();

  const farShoulder = { x: foot.x - size * .13 + shift, y: foot.y - size * 1.07 + crouch };
  const shoulder = { x: foot.x + size * .14 + shift, y: foot.y - size * 1.03 + crouch };
  drawnArm(ctx, farShoulder, grip, { x: farShoulder.x - size * .09, y: grip.y + size * .24 }, size, false);

  ctx.save();
  ctx.translate(foot.x + shift, foot.y + crouch);
  ctx.scale(size / 100, size / 100);
  ctx.rotate(lean);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.5;
  fill(ctx, 'cape', shade(ctx, -35, -98, 5, -34, '#665487', '#3b2f55'), '#302944');
  fill(ctx, 'capeTrim', '#b28a65a0');
  fill(ctx, 'coat', shade(ctx, -20, -113, 31, -64, '#776494', '#393257'), '#302747');
  fill(ctx, 'belt', '#35283d');
  oval(ctx, 9, -64, 4.7, 3.2, '#c99865');
  fill(ctx, 'mantle', shade(ctx, -23, -120, 26, -95, '#574371', '#312740'), '#2c253c');
  fill(ctx, 'mantleTrim', '#ca996b');
  oval(ctx, 2, -98, 4.2, 4, '#b27d52');
  oval(ctx, 2, -98, 2.5, 2.2, '#a8eee2');
  fill(ctx, 'hair', shade(ctx, -20, -154, 19, -119, '#e4d4db', '#8e809c'), '#61546f');
  fill(ctx, 'face', shade(ctx, 11, -152, 30, -127, '#e3b79a', '#996e6d'), '#744c60');
  fill(ctx, 'beard', shade(ctx, 14, -132, 23, -100, '#fff0dd', '#b6a7bb'), '#908397');
  ctx.strokeStyle = '#f6e6dcad';
  ctx.lineWidth = .9;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(16 + i * 1.8, -126);
    ctx.quadraticCurveTo(17 + i * 1.8, -119, 15 + i * 1.5, -105 - i * 1.4);
  }
  ctx.stroke();
  fill(ctx, 'hat', shade(ctx, -25, -196, 25, -160, '#826ca4', '#3d345f'), '#302541');
  fill(ctx, 'hatLight', '#ad8bbd73');
  fill(ctx, 'hatBand', shade(ctx, -23, -164, 25, -163, '#d3a36c', '#76504f'), '#644657');
  fill(ctx, 'brim', shade(ctx, -38, -163, 38, -153, '#76618f', '#3e335d'), '#2c233e');
  ctx.restore();

  drawnArm(ctx, shoulder, grip, { x: shoulder.x + size * .22, y: grip.y + size * .20 }, size, true);
  const age = practice.castAt === null ? Infinity : practice.elapsed - practice.castAt;
  drawStaff(ctx, grip, tip, profile, size, practice.snapCue || age < .16);
  oval(ctx, grip.x, grip.y, size * .050, size * .043, '#deb098');
  oval(ctx, grip.x + size * .015, grip.y - size * .014, size * .028, size * .022, '#efd0ac');
  if (practice.snapCue) {
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, size * .105, 0, TAU);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#ffe9ac';
    ctx.stroke();
  }
}
