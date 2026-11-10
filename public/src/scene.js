import { BALL_RADIUS, METERS_PER_YARD, TEE_X } from './practice.js';
import { createTeeView } from './view.js';

const TAU = Math.PI * 2;

function ellipse(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function shape(ctx, path, fill, outline) {
  const geometry = new Path2D(path);
  ctx.fillStyle = fill;
  ctx.fill(geometry);
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.stroke(geometry);
  }
}

function gradient(ctx, top, bottom, height) {
  const color = ctx.createLinearGradient(0, 0, 0, height);
  color.addColorStop(0, top);
  color.addColorStop(1, bottom);
  return color;
}

function landscape(ctx, width, height, horizon) {
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.54);
  sky.addColorStop(0, '#1b263c');
  sky.addColorStop(0.56, '#52465c');
  sky.addColorStop(1, '#d88970');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 34; i++) {
    const x = ((i * 0.414214 + 0.06) % 1) * width;
    const y = height * (0.035 + ((i * 0.173205) % 1) * 0.32);
    const radius = i % 7 === 0 ? 1.45 : 0.65;
    ellipse(ctx, x, y, radius, radius, i % 3 === 0 ? '#f9e5bfb5' : '#c9d8f462');
  }

  const moonX = width * 0.78;
  const moonY = height * 0.235;
  const moonR = Math.min(45, width * 0.077, height * 0.064);
  const halo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 3.1);
  halo.addColorStop(0, '#ffe4a77a');
  halo.addColorStop(1, '#ffe4a700');
  ellipse(ctx, moonX, moonY, moonR * 3.1, moonR * 3.1, halo);
  ellipse(ctx, moonX, moonY, moonR, moonR, '#f3d4a1');
  ellipse(ctx, moonX - moonR * .26, moonY + moonR * .17, moonR * .18, moonR * .10, '#d7b08055', -.3);
  ellipse(ctx, moonX + moonR * .36, moonY - moonR * .18, moonR * .13, moonR * .17, '#d7b08044', -.4);

  for (const [layer, color] of ['#695267', '#424856', '#354750', '#263e43'].entries()) {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width + 14; x += 14) {
      const a = x / width;
      const wave = Math.sin(a * (8 + layer) + layer) * 0.042 + Math.sin(a * 26 + layer) * 0.012;
      ctx.lineTo(x, horizon + height * (-0.096 + layer * 0.024 + wave));
    }
    ctx.lineTo(width, height);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const ground = horizon;
  ctx.save();
  ctx.translate(0, ground);
  ctx.fillStyle = gradient(ctx, '#435943', '#1b392e', height - ground);
  ctx.fillRect(0, 0, width, height - ground);
  ctx.restore();
}

function rangeWidth(depth) {
  return 1.55 + 14 * (1 - Math.exp(-Math.max(0, depth) / 37));
}

function fairway(ctx, point) {
  const stripes = [-3.45, -1.1, 1.6, 4.3, 8, 15, 28, 50, 80, 120, 175, 240, 350 * METERS_PER_YARD];
  for (let index = stripes.length - 1; index > 0; index--) {
    const near = stripes[index - 1];
    const far = stripes[index];
    const nearEdge = rangeWidth(near);
    const farEdge = rangeWidth(far);
    const corners = [
      point(near, 0, -nearEdge),
      point(far, 0, -farEdge),
      point(far, 0, farEdge),
      point(near, 0, nearEdge),
    ];
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
    ctx.closePath();
    ctx.fillStyle = index % 2 ? '#55754f' : '#486747';
    ctx.fill();
  }

  for (const yards of [50, 100, 150, 200, 250, 300]) {
    const depth = TEE_X + yards * METERS_PER_YARD;
    for (const side of [-1, 1]) {
      const z = side * rangeWidth(depth) * .94;
      const ground = point(depth, 0, z);
      const top = point(depth, 0.035 * depth, z);
      ctx.strokeStyle = '#e8d8b0a0';
      ctx.lineWidth = Math.max(1, top.scale * .023);
      ctx.beginPath();
      ctx.moveTo(ground.x, ground.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }
  }

  const targetDepth = TEE_X + 250 * METERS_PER_YARD;
  const target = point(targetDepth, 0, 0);
  const flag = point(targetDepth, 7, 0);
  ellipse(ctx, target.x, target.y, target.scale * 5, target.scale * .35, '#bac188a0');
  ctx.beginPath();
  ctx.moveTo(target.x, target.y);
  ctx.lineTo(flag.x, flag.y);
  ctx.lineTo(flag.x + flag.scale * 3, flag.y + flag.scale * .75);
  ctx.lineTo(flag.x, flag.y + flag.scale * 1.55);
  ctx.strokeStyle = '#f2dbad';
  ctx.lineWidth = 1.4;
  ctx.fillStyle = '#e7b16c';
  ctx.stroke();
  ctx.fill();
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.fillStyle = '#f2dbad';
  ctx.fillText('250 yd', flag.x + flag.scale * 4.2, flag.y + 4);
}

function grass(ctx, point, width, height, horizon) {
  ctx.lineWidth = 1;
  for (let cell = -3; cell < 26; cell++) {
    for (let i = 0; i < 18; i++) {
      const x = cell + ((i * .618034) % 1);
      const z = ((i * .414214 + (cell + 3) * .31) % 1 - .5) * 10;
      const dot = point(x, 0, z);
      if (dot.x < 0 || dot.x > width || dot.y > height || dot.y < horizon) continue;
      const h = dot.scale * (.012 + .009 * (i % 5));
      ctx.strokeStyle = i % 3 ? '#b9c38a45' : '#202d2c80';
      ctx.beginPath();
      ctx.moveTo(dot.x - h * .4, dot.y - h * .62);
      ctx.lineTo(dot.x, dot.y);
      ctx.lineTo(dot.x + h * .16, dot.y - h);
      ctx.stroke();
    }
  }
}

function wizard(ctx, foot, grip, staffTop, club, practice, scale) {
  ellipse(ctx, foot.x + scale * .09, foot.y + scale * .02, scale * .34, scale * .071, '#101d28a6');

  ctx.save();
  ctx.translate(foot.x, foot.y);
  ctx.scale(scale / 100, scale / 100);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  shape(ctx, 'M-17 -12 Q-10 -13 -3 -4 L-1 2 Q-10 7 -27 2 L-28 -3 Z', '#33272c');
  shape(ctx, 'M10 -13 Q17 -12 22 -5 Q37 -3 32 4 Q18 8 6 2 L5 -4 Z', '#422d2c');

  const moving = practice.phase === 'swing' || practice.phase === 'drawing';
  const loadWobble = practice.phase === 'drawing' ? Math.sin(performance.now() / 67) * practice.charge * .055 : 0;
  const stumble = practice.turfAt === null ? 0 : Math.max(0, 1 - (practice.elapsed - practice.turfAt) * 2) * .24;
  ctx.rotate((moving ? Math.sin(practice.staffAngle) * .15 : .045) + loadWobble + stumble);
  const robe = ctx.createLinearGradient(-37, -98, 30, -28);
  robe.addColorStop(0, '#333453');
  robe.addColorStop(.55, '#595083');
  robe.addColorStop(1, '#2b314d');

  shape(ctx, 'M-14 -104 Q-33 -98 -32 -73 Q-25 -56 -25 -35 L-33 -9 Q-10 -1 24 -9 L28 -19 Q11 -44 16 -73 Q22 -96 2 -104 Z', robe, '#26283e');
  shape(ctx, 'M-19 -102 Q-30 -70 -21 -47 L-31 -10 Q-8 -1 20 -10 L12 -45 Q4 -67 15 -100 Z', '#72638a', '#403856');
  shape(ctx, 'M-10 -88 Q-16 -54 -11 -29 L-15 -12 L-8 -12 Q-1 -43 -5 -60 L-5 -88 Z', '#a294af83');
  shape(ctx, 'M-22 -94 Q-19 -110 1 -113 Q18 -113 20 -95 Q14 -84 2 -80 Q-12 -82 -22 -94 Z', '#403859', '#2c2b43');
  shape(ctx, 'M-15 -95 Q0 -89 15 -99 Q12 -88 2 -85 Q-9 -87 -15 -95 Z', '#8b7794');
  shape(ctx, 'M-15 -131 Q-12 -148 7 -146 Q23 -144 22 -125 L28 -120 L21 -117 L19 -107 Q1 -100 -11 -112 Z', '#cb9a83', '#56394d');
  shape(ctx, 'M-16 -139 Q5 -146 14 -135 Q9 -126 12 -114 Q4 -107 -7 -110 Q-18 -118 -16 -139 Z', '#bcb1bd', '#8d7f96');
  shape(ctx, 'M19 -121 L26 -119 L21 -110 Q23 -95 14 -88 L12 -100 L15 -109 Z', '#e7d7ca', '#9d8e9c');
  shape(ctx, 'M-18 -145 Q-18 -156 -11 -168 L10 -182 L2 -166 Q12 -164 23 -145 Z', '#51466e', '#302e4c');
  shape(ctx, 'M-19 -150 Q-2 -146 19 -151 L23 -144 Q5 -139 -21 -143 Z', '#c38d64');
  shape(ctx, 'M-34 -144 Q-21 -148 2 -146 Q17 -145 32 -149 Q33 -141 20 -137 Q-11 -134 -34 -139 Z', '#414166', '#2a2d45');
  ctx.restore();

  const shoulder = { x: foot.x + scale * .04, y: foot.y - scale * .88 };
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.quadraticCurveTo(shoulder.x + scale * .18, shoulder.y + scale * .15, grip.x, grip.y);
  ctx.strokeStyle = '#615785';
  ctx.lineWidth = scale * .14;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(grip.x * 1.72 - staffTop.x * .72, grip.y * 1.72 - staffTop.y * .72);
  ctx.lineTo(staffTop.x, staffTop.y);
  ctx.strokeStyle = '#3d2b36';
  ctx.lineWidth = scale * .067;
  ctx.stroke();
  ctx.strokeStyle = '#bb8963';
  ctx.lineWidth = scale * .035;
  ctx.stroke();
  ellipse(ctx, grip.x, grip.y, scale * .052, scale * .045, '#dbab90');

  const castAge = practice.castAt === null ? Infinity : practice.elapsed - practice.castAt;
  const casting = castAge < .19;
  const glow = practice.snapCue ? '#fff5b8' : casting ? '#ffd277' : '#a5e9e0';
  ctx.beginPath();
  ctx.moveTo(staffTop.x, staffTop.y);
  ctx.quadraticCurveTo((staffTop.x + club.x) / 2, (staffTop.y + club.y) / 2 + scale * .20, club.x, club.y);
  ctx.strokeStyle = glow;
  ctx.lineWidth = casting ? 3 : 1.5;
  ctx.shadowColor = glow;
  ctx.shadowBlur = casting ? 16 : 7;
  ctx.stroke();

  ellipse(ctx, staffTop.x, staffTop.y, scale * .049, scale * .055, glow, .4);
  ellipse(ctx, club.x, club.y, scale * .073, scale * .042, glow, practice.angle * .50);
  ellipse(ctx, club.x - scale * .018, club.y - scale * .008, scale * .040, scale * .017, '#f6fff0', practice.angle * .50);
  ctx.shadowBlur = 0;
  if (practice.snapCue) {
    ctx.strokeStyle = '#ffe2a0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(club.x, club.y, scale * .115, 0, TAU);
    ctx.stroke();
  }
}

function sparks(ctx, origin, age, scale, color, count) {
  if (age < 0 || age > .31) return;
  ctx.save();
  ctx.globalAlpha = 1 - age / .31;
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963;
    const r = scale * (.035 + age * (1 + (i % 3) * .35));
    ellipse(ctx, origin.x + Math.cos(a) * r, origin.y + Math.sin(a) * r * .55, 2, 1.2, color, a);
  }
  ctx.restore();
}

function drawGuide(ctx, guide) {
  const { x, y, scale, pull, path, channelOnly } = guide;
  const halfWidth = Math.max(8, scale * .11);
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = '#b8f4e978';
  ctx.beginPath();
  ctx.moveTo(x - halfWidth, y);
  ctx.lineTo(x - halfWidth, y + pull);
  ctx.lineTo(x + halfWidth, y + pull);
  ctx.lineTo(x + halfWidth, y);
  ctx.stroke();
  if (!channelOnly) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const [dx, dy] of path.slice(1)) ctx.lineTo(x + dx * scale, y + dy * scale);
    ctx.strokeStyle = '#c6fff0a3';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawScene(ctx, width, height, practice, trace, flight, guide) {
  const { point, horizon } = createTeeView(width, height);
  landscape(ctx, width, height, horizon);
  fairway(ctx, point);
  grass(ctx, point, width, height, horizon);

  const tee = point(TEE_X, 0, 0);
  const aim = point(17, 0, 0);
  ellipse(ctx, tee.x, tee.y, tee.scale * .17, tee.scale * .062, '#c3d69e66');
  ctx.beginPath();
  ctx.moveTo(tee.x, tee.y - tee.scale * .09);
  ctx.lineTo(aim.x, aim.y);
  ctx.setLineDash([4, 7]);
  ctx.strokeStyle = '#f0e2ac9c';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.setLineDash([]);

  const foot = point(-.43, 0, -.76);
  const grip = point(0, 1.005, practice.steer * .10);
  const staffTop = point(
    Math.sin(practice.staffAngle) * .34,
    1.005 + Math.cos(practice.staffAngle) * .34,
    practice.steer * .10,
  );
  const club = point(practice.club.x, practice.club.y, practice.club.z);
  wizard(ctx, foot, grip, staffTop, club, practice, foot.scale);

  if (flight.length > 1) {
    const start = point(flight[0].x, flight[0].y, flight[0].z);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (const sample of flight.slice(1)) {
      const dot = point(sample.x, sample.y, sample.z);
      ctx.lineTo(dot.x, dot.y);
    }
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = '#fff2baaa';
    ctx.stroke();
  }

  const { ball } = practice;
  const ballPoint = point(ball.x, ball.y, ball.z);
  const shadow = point(ball.x, 0, ball.z);
  const radius = Math.max(2.3, BALL_RADIUS * ballPoint.scale);
  ellipse(ctx, shadow.x, shadow.y, radius * 1.6, radius * .45, '#11222cb0');
  ellipse(ctx, ballPoint.x, ballPoint.y, radius, radius, '#fff7de');
  ellipse(ctx, ballPoint.x + radius * .25, ballPoint.y + radius * .30, radius * .43, radius * .27, '#b1b49f');

  if (practice.impact) {
    sparks(ctx, tee, practice.elapsed - practice.impact.at, tee.scale, '#ffefae', 11);
  }
  if (practice.turfAt !== null) {
    sparks(ctx, point(-.07, .03, practice.steer * .10), practice.elapsed - practice.turfAt, tee.scale, '#c6ad73', 14);
  }

  if (guide) {
    if (guide.path) drawGuide(ctx, guide);
    ellipse(ctx, guide.x, guide.y, 4, 4, '#f0d29b');
  }

  if (trace.length > 1) {
    ctx.beginPath();
    ctx.moveTo(trace[0].x, trace[0].y);
    for (const dot of trace.slice(1)) ctx.lineTo(dot.x, dot.y);
    ctx.strokeStyle = '#e5eabe9c';
    ctx.lineWidth = 2;
    ctx.stroke();
    const latest = trace.at(-1);
    ellipse(ctx, latest.x, latest.y, 4, 4, '#e8e9bf');
  }
}
