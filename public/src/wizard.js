import { CLUB_HEADS, CLUBS } from './clubs.js';
import { swingPose } from './swing-pose.js';

const TAU = Math.PI * 2;
const shapes = Object.fromEntries(Object.entries({
  boot: 'M-27 -9 Q-23 -15 -15 -11 L-12 -7 Q-1 -8 1 -2 Q3 3 -7 4 L-26 4 Q-30 2 -27 -9Z',
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
  backMantle: 'M-28 -110 Q-19 -124 2 -125 Q22 -125 29 -111 Q16 -109 1 -86 Q-17 -105 -28 -110Z',
  backTrim: 'M-28 -111 Q-13 -106 1 -90 Q16 -110 29 -112 L29 -109 Q16 -105 1 -85 Q-16 -103 -28 -108Z',
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

function drawSleeve(ctx, { shoulder, elbow, wrist }, size, front) {
  const color = front
    ? shade(ctx, shoulder.x, shoulder.y, wrist.x, wrist.y, '#8e78af', '#4d3b69')
    : '#463a60';
  ctx.lineCap = 'round';
  const segments = [[shoulder, elbow, .16], [elbow, wrist, .11]];
  for (const [start, end, width] of segments) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = size * width + 2;
    ctx.strokeStyle = '#262139';
    ctx.stroke();
  }
  for (const [start, end, width] of segments) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = size * width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(angle);
  ctx.fillStyle = front ? '#cca374' : '#946e5a';
  ctx.fillRect(-size * .072, -size * .061, size * .029, size * .122);
  ctx.restore();
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
  ctx.moveTo(-Math.max(width * 2.6, size * .09), 0);
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

function drawBoot(ctx, heel, toe, size, near) {
  ctx.save();
  ctx.translate(toe.x, toe.y);
  const length = Math.hypot(toe.x - heel.x, toe.y - heel.y);
  ctx.rotate(Math.atan2(toe.y - heel.y, toe.x - heel.x));
  ctx.scale(length / 24, size / 110);
  ctx.lineWidth = 1.7;
  fill(ctx, 'boot', near ? '#483346' : '#322739', '#211c2e');
  ctx.restore();
}

function drawLowerBody(ctx, point, pose, hip, size) {
  const leadToe = point(.36, .025, -.57);
  const trailToe = point(-.47, .025, -.89);
  const leadHeel = point(.34, .055, -.83);
  const trailHeel = point(-.50, .055 + pose.heel, -1.16);
  const foot = point(-.12, 0, -.87);
  oval(ctx, foot.x, foot.y, size * .42, size * .092, '#101e2780');

  const flex = .04 + (pose.chest.z - pose.hip.z) * .35;
  const leadKnee = point(.31, pose.hip.y * .55, -.83 + flex);
  const trailKnee = point(-.43, (pose.hip.y + pose.heel) * .55, -1.10 + flex + pose.heel * .48);
  for (const [heel, toe, knee, near] of [
    [leadHeel, leadToe, leadKnee, false], [trailHeel, trailToe, trailKnee, true],
  ]) {
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(heel.x, heel.y);
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * .13;
    ctx.lineCap = 'round';
    ctx.strokeStyle = near ? '#332943' : '#29253b';
    ctx.stroke();
    drawBoot(ctx, heel, toe, size, near);
  }

  const hemX = (leadHeel.x + trailHeel.x) / 2 + size * .05;
  const hemY = (leadHeel.y + trailHeel.y) / 2 - size * .10;
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(Math.atan2(hip.x - hemX, hemY - hip.y));
  ctx.scale(size / 100 * (.85 + .13 * Math.abs(Math.sin(pose.hipTurn))), (hemY - hip.y) / 64);
  ctx.translate(0, 68);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6;
  fill(ctx, 'hem', shade(ctx, -33, -50, 38, -15, '#60517d', '#292943'), '#24223b');
  fill(ctx, 'foldA', '#a486ad50');
  fill(ctx, 'foldB', '#201e3c70');
  fill(ctx, 'hemTrim', '#b8875c');
  ctx.restore();
}

function drawTorso(ctx, hip, chest, size, shoulderTurn) {
  ctx.save();
  ctx.translate(hip.x, hip.y);
  const rise = hip.y - chest.y;
  const sway = chest.x - hip.x;
  ctx.rotate(Math.atan2(sway, rise));
  const facing = Math.sin(shoulderTurn);
  ctx.scale(size / 100 * (.65 + .27 * Math.abs(facing)), Math.hypot(sway, rise) / 48);
  ctx.translate(0, 64);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.5;
  fill(ctx, 'cape', shade(ctx, -35, -98, 5, -34, '#665487', '#3b2f55'), '#302944');
  fill(ctx, 'capeTrim', '#b28a65a0');
  fill(ctx, 'coat', shade(ctx, -20, -113, 31, -64, '#776494', '#393257'), '#302747');
  fill(ctx, 'belt', '#35283d');
  fill(ctx, 'backMantle', shade(ctx, -23, -120, 26, -95, '#574371', '#312740'), '#2c253c');
  fill(ctx, 'backTrim', '#b58a63');
  ctx.save();
  // Move the front clasp around the body's edge as the shoulders open toward the target.
  const front = Math.min(1, Math.max(0, .40 - facing));
  ctx.globalAlpha = front;
  ctx.translate(17 * (1 - front), 0);
  ctx.scale(.65 + .35 * front, 1);
  oval(ctx, 9, -64, 4.7, 3.2, '#c99865');
  fill(ctx, 'mantle', shade(ctx, -23, -120, 26, -95, '#574371', '#312740'), '#2c253c');
  fill(ctx, 'mantleTrim', '#ca996b');
  oval(ctx, 2, -98, 4.2, 4, '#b27d52');
  oval(ctx, 2, -98, 2.5, 2.2, '#a8eee2');
  ctx.restore();
  ctx.restore();
}

function drawHead(ctx, head, size, gaze) {
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(.36 - gaze * .30);
  ctx.scale(size / 123, size / 123);
  ctx.translate(0, 141);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.5;
  fill(ctx, 'hair', shade(ctx, -20, -154, 19, -119, '#e4d4db', '#8e809c'), '#61546f');
  ctx.save();
  const profile = Math.max(.06, Math.cos(gaze * 1.18));
  ctx.translate(12 * (1 - profile), 0);
  ctx.scale(profile, 1);
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
  ctx.restore();
  fill(ctx, 'hat', shade(ctx, -25, -196, 25, -160, '#826ca4', '#3d345f'), '#302541');
  fill(ctx, 'hatLight', '#ad8bbd73');
  fill(ctx, 'hatBand', shade(ctx, -23, -164, 25, -163, '#d3a36c', '#76504f'), '#644657');
  fill(ctx, 'brim', shade(ctx, -38, -163, 38, -153, '#76618f', '#3e335d'), '#2c233e');
  ctx.restore();
}

function drawHand(ctx, { wrist, palm }, grip, tip, size, near) {
  const shaftAngle = Math.atan2(tip.y - grip.y, tip.x - grip.x);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(palm.x, palm.y);
  ctx.lineWidth = size * .058;
  ctx.strokeStyle = near ? '#c2907b' : '#a87767';
  ctx.stroke();

  ctx.save();
  ctx.translate(palm.x, palm.y);
  ctx.rotate(shaftAngle);
  oval(ctx, 0, 0, size * .044, size * .039, '#3f2938');
  oval(ctx, 0, -size * .004, size * .037, size * .033, near ? '#e7b797' : '#c89178');
  ctx.beginPath();
  ctx.moveTo(-size * .025, -size * .016);
  ctx.quadraticCurveTo(0, -size * .024, size * .022, -size * .012);
  ctx.lineWidth = Math.max(.6, size * .009);
  ctx.strokeStyle = near ? '#f5d5ad' : '#e0a987';
  ctx.stroke();
  ctx.restore();
}

export function drawWizard(ctx, point, practice) {
  const profile = CLUBS[practice.clubType];
  const pose = swingPose(practice, profile);
  const project = ({ x, y, z }) => point(x, y, z);
  const hip = project(pose.hip);
  const chest = project(pose.chest);
  const head = project(pose.head);
  const grip = project(pose.grip);
  const tip = project(pose.tip);
  const size = hip.scale;
  const [far, near] = [pose.lead, pose.trail].sort((a, b) => b.shoulder.x - a.shoulder.x);
  const paintArm = arm => ({
    shoulder: project(arm.shoulder), elbow: project(arm.elbow),
    wrist: project(arm.wrist), palm: project(arm.palm),
  });
  const farArm = paintArm(far);
  const nearArm = paintArm(near);
  const crossesChest = far.elbow.x < pose.chest.x && pose.shoulderTurn < 0;

  drawLowerBody(ctx, point, pose, hip, size);
  if (!crossesChest) drawSleeve(ctx, farArm, size, far === pose.trail);
  drawTorso(ctx, hip, chest, size, pose.shoulderTurn);
  if (crossesChest) drawSleeve(ctx, farArm, size, far === pose.trail);
  drawSleeve(ctx, nearArm, size, near === pose.trail);
  const age = practice.castAt === null ? Infinity : practice.elapsed - practice.castAt;
  drawStaff(ctx, grip, tip, profile, size, practice.snapCue || age < .16);
  drawHand(ctx, farArm, grip, tip, size, far === pose.trail);
  drawHand(ctx, nearArm, grip, tip, size, near === pose.trail);
  drawHead(ctx, head, size, pose.gaze);

  if (practice.snapCue) {
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, size * .105, 0, TAU);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#ffe9ac';
    ctx.stroke();
  }
}
