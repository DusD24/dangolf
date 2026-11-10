import { BALL_RADIUS, TEE_X } from './practice.js';

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

function landscape(ctx, width, height, camera) {
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
      const a = x / width + camera.x * (0.004 + layer * 0.004);
      const wave = Math.sin(a * (8 + layer) + layer) * 0.042 + Math.sin(a * 26 + layer) * 0.012;
      ctx.lineTo(x, height * (0.39 + layer * 0.024 + wave));
    }
    ctx.lineTo(width, height);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const horizon = height * 0.52;
  ctx.save();
  ctx.translate(0, horizon);
  ctx.fillStyle = gradient(ctx, '#36584b', '#192f2a', height - horizon);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.quadraticCurveTo(width * 0.56, -height * 0.066, width, 0);
  ctx.lineTo(width, height - horizon);
  ctx.lineTo(0, height - horizon);
  ctx.fill();

  for (let i = 1; i < 6; i++) {
    const y = (height - horizon) * i * i / 36;
    ctx.strokeStyle = i % 2 ? '#d5cf9630' : '#182d2b38';
    ctx.lineWidth = 1 + i * 0.36;
    ctx.beginPath();
    ctx.moveTo(0, y + 7);
    ctx.quadraticCurveTo(width * .54, y - 10 - i * 3, width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function grass(ctx, point, scale, width, height, camera) {
  const base = Math.floor(camera.x);
  ctx.lineWidth = 1;
  for (let cell = base - 8; cell <= base + 8; cell++) {
    for (let i = 0; i < 24; i++) {
      const x = cell + ((i * .618034) % 1);
      const z = camera.z + ((i * .414214 + cell * .31) % 1) * 4.6;
      const dot = point(x, 0, z);
      if (dot.x < 0 || dot.x > width || dot.y > height || dot.y < height * .53) continue;
      const h = scale * (.012 + .009 * (i % 5));
      ctx.strokeStyle = i % 3 ? '#b9c38a45' : '#202d2cb5';
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
  shape(ctx, 'M-12 -94 Q-23 -67 -9 -46 L-16 -12 Q-6 -8 5 -12 L8 -22 Q-1 -55 10 -91 Z', '#8971a4a0');
  shape(ctx, 'M-25 -51 Q-8 -44 17 -49 L19 -43 Q-5 -37 -25 -44 Z', '#332739');
  ellipse(ctx, 5, -45, 5, 4, '#dca66e');
  shape(ctx, 'M-25 -89 Q-25 -104 -14 -111 Q-3 -117 12 -109 Q18 -102 15 -88 L22 -78 Q9 -67 -16 -78 Z', '#3b3b5b', '#29293f');

  shape(ctx, 'M-16 -130 Q-18 -148 5 -148 Q20 -146 21 -126 L29 -120 Q28 -116 20 -116 L20 -107 Q8 -96 -6 -101 Q-16 -110 -16 -130 Z', '#d2a18a', '#56394d');
  ellipse(ctx, 15, -127, 2.3, 1.8, '#292033');
  shape(ctx, 'M6 -128 Q13 -134 19 -130 L19 -127 Q12 -129 6 -126 Z', '#e3d6cd');
  shape(ctx, 'M-17 -127 Q-4 -130 -1 -115 Q11 -111 23 -117 Q22 -105 17 -100 Q22 -82 3 -68 Q7 -79 -8 -89 Q-21 -104 -17 -127 Z', '#ddd1ca', '#9d8e9c');
  shape(ctx, 'M-10 -109 Q-1 -101 5 -100 Q3 -90 9 -82 Q-1 -88 -5 -96 Z', '#ae9da8');
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

export function drawScene(ctx, width, height, practice, camera, trace) {
  const scale = Math.min(width / 3.25, height / 4.5);
  const point = (x, y, z) => ({
    x: width * .43 + (x - camera.x + (z - camera.z) * .40) * scale,
    y: height * .645 + ((z - camera.z) * .31 - (x - camera.x) * .036 - y) * scale,
  });

  landscape(ctx, width, height, camera);
  grass(ctx, point, scale, width, height, camera);

  const tee = point(TEE_X, 0, 0);
  const aim = point(TEE_X + 2.3, 0, 0);
  ellipse(ctx, tee.x, tee.y, scale * .19, scale * .043, '#c3d69e3c');
  ctx.beginPath();
  ctx.moveTo(tee.x + scale * .22, tee.y);
  ctx.lineTo(aim.x, aim.y);
  ctx.setLineDash([scale * .047, scale * .07]);
  ctx.strokeStyle = '#dfdb9e77';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  const foot = point(-.41, 0, -.06);
  const grip = point(0, 1.005, practice.steer * .10);
  const staffTop = point(
    Math.sin(practice.staffAngle) * .34,
    1.005 + Math.cos(practice.staffAngle) * .34,
    practice.steer * .10,
  );
  const club = point(practice.club.x, practice.club.y, practice.club.z);
  if (foot.x > -scale && foot.x < width + scale) {
    wizard(ctx, foot, grip, staffTop, club, practice, scale);
  }

  const { ball } = practice;
  const ballPoint = point(ball.x, ball.y, ball.z);
  const shadow = point(ball.x, 0, ball.z);
  const radius = Math.max(3.2, BALL_RADIUS * scale);
  ellipse(ctx, shadow.x, shadow.y, radius * 1.6, radius * .45, '#11222cb0');
  if (ball.y > BALL_RADIUS + .06 && practice.impact) {
    const tail = point(ball.x - ball.vx * .052, ball.y - ball.vy * .052, ball.z - ball.vz * .052);
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(ballPoint.x, ballPoint.y);
    ctx.strokeStyle = '#fdf0bd70';
    ctx.lineWidth = radius * .70;
    ctx.stroke();
  }
  ellipse(ctx, ballPoint.x, ballPoint.y, radius, radius, '#fff7de');
  ellipse(ctx, ballPoint.x + radius * .25, ballPoint.y + radius * .30, radius * .43, radius * .27, '#b1b49f');

  if (practice.impact) {
    sparks(ctx, tee, practice.elapsed - practice.impact.at, scale, '#ffefae', 11);
  }
  if (practice.turfAt !== null) {
    sparks(ctx, point(-.07, .03, practice.steer * .10), practice.elapsed - practice.turfAt, scale, '#c6ad73', 14);
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
