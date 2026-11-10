import { BALL_RADIUS, METERS_PER_YARD, TEE_X } from './practice.js';
import { surfaceAt } from './course.js';
import { drawCourseGround } from './course-view.js';
import { createTeeView } from './view.js';
import { POWER_MARKS } from './range-card.js';
import { drawWizard } from './wizard.js';

const TAU = Math.PI * 2;
const DIVOT_OUTLINE = [[-.54, -.08], [-.47, -.15], [-.25, -.11], [-.13, -.13],
  [-.07, -.025], [-.15, .11], [-.32, .14], [-.49, .105]];

function ellipse(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function gradient(ctx, top, bottom, height) {
  const color = ctx.createLinearGradient(0, 0, 0, height);
  color.addColorStop(0, top);
  color.addColorStop(1, bottom);
  return color;
}

function landscape(ctx, width, height, horizon) {
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.54);
  sky.addColorStop(0, '#11182c');
  sky.addColorStop(0.51, '#453950');
  sky.addColorStop(1, '#cf8778');
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

  for (let i = 0; i < 33; i++) {
    const fraction = i / 32;
    const x = fraction * width;
    const base = horizon + 2;
    const tree = height * (.013 + .023 * ((i * .613) % 1)) * (Math.abs(fraction - .50) + .63);
    ctx.beginPath();
    ctx.moveTo(x - tree * .32, base);
    ctx.lineTo(x - tree * .14, base - tree * .44);
    ctx.lineTo(x - tree * .22, base - tree * .39);
    ctx.lineTo(x, base - tree);
    ctx.lineTo(x + tree * .23, base - tree * .39);
    ctx.lineTo(x + tree * .13, base - tree * .46);
    ctx.lineTo(x + tree * .31, base);
    ctx.fillStyle = i % 3 === 0 ? '#202e39' : '#283844';
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

function grass(ctx, point, width, height, horizon, round) {
  ctx.lineWidth = 1;
  for (let cell = -3; cell < 26; cell++) {
    for (let i = 0; i < 18; i++) {
      const x = cell + ((i * .618034) % 1);
      const z = ((i * .414214 + (cell + 3) * .31) % 1 - .5) * 10;
      const dot = point(x, 0, z);
      if (dot.x < 0 || dot.x > width || dot.y > height || dot.y < horizon) continue;
      if (round) {
        const surface = surfaceAt(round.hole, round.worldPoint({ x, z }));
        if (surface !== 'fairway' && surface !== 'rough') continue;
      }
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

function drawDivot(ctx, point, age, steer) {
  const across = steer * .10;
  ctx.beginPath();
  for (const [i, [x, z]] of DIVOT_OUTLINE.entries()) {
    const edge = point(TEE_X + x, .005, across + z);
    if (i === 0) ctx.moveTo(edge.x, edge.y);
    else ctx.lineTo(edge.x, edge.y);
  }
  ctx.closePath();
  ctx.fillStyle = '#463327';
  ctx.fill();
  ctx.strokeStyle = '#ad9066';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  for (const offset of [-.055, .048]) {
    const back = point(TEE_X - .47, .006, across + offset);
    const front = point(TEE_X - .16, .006, across + offset * .60);
    ctx.beginPath();
    ctx.moveTo(back.x, back.y);
    ctx.lineTo(front.x, front.y);
    ctx.strokeStyle = '#ad83596b';
    ctx.stroke();
  }

  // The mark stays in the turf after the clods have landed.
  if (age < 0 || age > .64) return;
  for (let i = 0; i < 13; i++) {
    const lift = .025 + age * (1.65 + (i % 6) * .29) - 4.9 * age ** 2;
    if (lift <= 0) continue;
    const spread = (i * .618034 % 1 - .5) * 2;
    const clod = point(TEE_X - .35 + age * (.70 + (i % 5) * .32),
      lift, across + spread * (.09 + age * .81));
    const size = clod.scale * (.013 + (i % 4) * .009);
    ctx.save();
    ctx.translate(clod.x, clod.y);
    ctx.rotate(i * 1.2 + age * (i % 2 ? 13 : -11));
    ctx.beginPath();
    ctx.moveTo(-size, -.32 * size);
    ctx.lineTo(.20 * size, -.66 * size);
    ctx.lineTo(size, -.12 * size);
    ctx.lineTo(.52 * size, .54 * size);
    ctx.lineTo(-.73 * size, .49 * size);
    ctx.closePath();
    ctx.fillStyle = i % 3 === 0 ? '#8a6243' : '#67462f';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size, -.32 * size);
    ctx.lineTo(.20 * size, -.66 * size);
    ctx.lineTo(size, -.12 * size);
    ctx.strokeStyle = i % 3 === 0 ? '#a9ad69' : '#9c8056';
    ctx.lineWidth = Math.max(.65, size * .28);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGuide(ctx, guide) {
  const { x, y, scale, pull, path, shaft, channelOnly, charge } = guide;
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
  ctx.setLineDash([]);
  if (charge > 0) {
    ctx.fillStyle = '#99fbe230';
    ctx.fillRect(x - halfWidth + 2, y, halfWidth * 2 - 4, pull * charge);
  }
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const mark of POWER_MARKS) {
    const tick = y + pull * mark / 100;
    const reached = charge * 100 + .35 >= mark;
    ctx.strokeStyle = reached ? '#ffdc91' : '#d1e5d0a0';
    ctx.beginPath();
    ctx.moveTo(x - halfWidth, tick);
    ctx.lineTo(x + halfWidth + 5, tick);
    ctx.stroke();
    ctx.shadowColor = '#172633';
    ctx.shadowBlur = 4;
    ctx.fillStyle = reached ? '#ffe7a4' : '#f2ecd5';
    ctx.fillText(mark + '%', x + halfWidth + 8, tick);
    ctx.shadowBlur = 0;
  }
  if (shaft || (path && !channelOnly)) {
    ctx.beginPath();
    if (path && !channelOnly) {
      ctx.moveTo(x, y);
      for (const [dx, dy] of path.slice(1)) ctx.lineTo(x + dx * scale, y + dy * scale);
    }
    if (shaft) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + pull);
    }
    ctx.strokeStyle = '#c6fff0a3';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawScene(ctx, width, height, practice, trace, flight, guide, round) {
  const { point, horizon } = createTeeView(width, height);
  landscape(ctx, width, height, horizon);
  if (round) drawCourseGround(ctx, round, point);
  else fairway(ctx, point);
  grass(ctx, point, width, height, horizon, round);

  const tee = point(TEE_X, 0, 0);
  const aim = point(practice.clubType === 'putter' ? Math.min(5, (round?.remaining ?? 5) + TEE_X) : 17, 0, 0);
  ellipse(ctx, tee.x, tee.y, tee.scale * .17, tee.scale * .062, '#c3d69e66');
  ctx.beginPath();
  ctx.moveTo(tee.x, tee.y - tee.scale * .09);
  ctx.lineTo(aim.x, aim.y);
  ctx.setLineDash([4, 7]);
  ctx.strokeStyle = '#f0e2ac9c';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.setLineDash([]);

  if (practice.turfAt !== null) drawDivot(ctx, point, practice.elapsed - practice.turfAt, practice.steer);
  drawWizard(ctx, point, practice);

  if (flight.length > 1) {
    const start = point(flight[0].x, flight[0].y, flight[0].z);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (const sample of flight.slice(1)) {
      const dot = point(sample.x, sample.y, sample.z);
      ctx.lineTo(dot.x, dot.y);
    }
    ctx.save();
    const gold = practice.impact?.pure || practice.impact?.royal;
    ctx.lineWidth = gold ? 2.6 : 1.65;
    ctx.shadowBlur = practice.spell ? 11 : 5;
    ctx.shadowColor = gold ? '#ffbf7a' : '#82e6d3';
    ctx.strokeStyle = gold ? '#ffedb3' : practice.spell ? '#b0ffebba' : '#fff2baaa';
    ctx.stroke();
    ctx.restore();
  }

  const { ball } = practice;
  const ballPoint = point(ball.x, ball.y, ball.z);
  const shadow = point(ball.x, 0, ball.z);
  const radius = Math.max(2.3, BALL_RADIUS * ballPoint.scale);
  ellipse(ctx, shadow.x, shadow.y, radius * 1.6, radius * .45, '#11222cb0');
  ellipse(ctx, ballPoint.x, ballPoint.y, radius, radius, '#fff7de');
  ellipse(ctx, ballPoint.x + radius * .25, ballPoint.y + radius * .30, radius * .43, radius * .27, '#b1b49f');

  if (practice.impact && practice.impact.kind !== 'chunk' && practice.impact.kind !== 'top') {
    const age = practice.elapsed - practice.impact.at;
    const pure = practice.impact.pure;
    sparks(ctx, tee, age, tee.scale, pure ? '#ffce79' : '#ffefae', pure ? 22 : 11);
    if (pure && age < .46) {
      ctx.save();
      ctx.globalAlpha = 1 - age / .46;
      ctx.strokeStyle = '#ffd28b';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffc370';
      ctx.shadowBlur = 12;
      for (const offset of [0, .07]) {
        const radius = tee.scale * (.08 + age * (1.15 + offset * 4) + offset);
        ctx.beginPath();
        ctx.ellipse(tee.x, tee.y, radius, radius * .38, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (guide) {
    if (guide.marked) drawGuide(ctx, guide);
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
