import { mapProjection, pointAlongAim } from './course-map.js';
import { surfaceAt } from './course.js';
import { METERS_PER_YARD } from './practice.js';

const COLORS = {
  water: '#31596b',
  sand: '#bc9b67',
  green: '#71935c',
  rough: '#405a37',
  fairway: ['#4e7049', '#577951'],
};

const TREE_CROWNS = [
  ['#183e34', '#2e5741', '#43694e'],
  ['#203e33', '#355840', '#4b6a45'],
  ['#213d3a', '#32564d', '#486b5b'],
];

function patch(ctx, points, fill) {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function oval({ x, z, rx, rz }) {
  return Array.from({ length: 32 }, (_, index) => {
    const angle = index * Math.PI / 16;
    return { x: x + rx * Math.cos(angle), z: z + rz * Math.sin(angle) };
  });
}

function fillOval(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawCourseTrees(ctx, round, point) {
  const trees = round.hole.trees.map(tree => ({ ...tree, local: round.localPoint(tree) }))
    .filter(({ local }) => local.x > 4)
    .sort((a, b) => b.local.x - a.local.x);
  for (const { local, radius, height, x, z } of trees) {
    const base = point(local.x, 0, local.z);
    const crown = point(local.x, height * .62, local.z);
    const top = point(local.x, height, local.z);
    const width = radius * crown.scale;
    const rise = crown.y - top.y;
    const [shade, leaf, light] = TREE_CROWNS[Math.floor(Math.abs(x * 2 + z)) % TREE_CROWNS.length];
    fillOval(ctx, base.x + width * .25, base.y, width * .8, width * .11, '#172c2560');
    patch(ctx, [
      { x: base.x - base.scale * .41, y: base.y },
      { x: base.x + base.scale * .38, y: base.y },
      { x: crown.x + crown.scale * .17, y: crown.y },
      { x: crown.x - crown.scale * .19, y: crown.y },
    ], '#493f33');
    fillOval(ctx, crown.x, crown.y, width, rise * .83, shade);
    fillOval(ctx, crown.x - width * .33, crown.y - rise * .24, width * .65, rise * .64, leaf);
    fillOval(ctx, crown.x + width * .36, crown.y - rise * .08, width * .62, rise * .56, shade);
    fillOval(ctx, crown.x + width * .08, crown.y - rise * .39, width * .66, rise * .58, leaf);
    fillOval(ctx, crown.x - width * .15, crown.y - rise * .58, width * .42, rise * .36, light);
  }
}

function terrain(ctx, hole, project, mowing = false) {
  for (let i = hole.fairway.length - 1; i > 0; i--) {
    const a = hole.fairway[i - 1];
    const b = hole.fairway[i];
    const bands = mowing ? Math.ceil((b.x - a.x) / 15) : 1;
    const edge = (fraction, side) => ({
      x: a.x + (b.x - a.x) * fraction,
      z: a.z + (b.z - a.z) * fraction + side * (a.width + (b.width - a.width) * fraction),
    });
    for (let band = bands - 1; band >= 0; band--) {
      const near = band / bands;
      const far = (band + 1) / bands;
      patch(ctx, project([edge(near, -1), edge(far, -1), edge(far, 1), edge(near, 1)]),
        COLORS.fairway[(i + band) % 2]);
    }
  }
  for (const green of hole.greens ?? [hole.green]) patch(ctx, project(oval(green)), COLORS.green);
  for (const hazard of hole.hazards) {
    patch(ctx, project(oval(hazard)), COLORS[hazard.type]);
    if (hazard.type === 'water') {
      patch(ctx, project(oval({ ...hazard, rx: hazard.rx * .79, rz: hazard.rz * .79 })), '#406b7b');
    }
  }
}

function clipNear(points) {
  const near = -3.35;
  const visible = [];
  let previous = points.at(-1);
  for (const point of points) {
    if ((point.x >= near) !== (previous.x >= near)) {
      const fraction = (near - previous.x) / (point.x - previous.x);
      visible.push({ x: near, z: previous.z + fraction * (point.z - previous.z) });
    }
    if (point.x >= near) visible.push(point);
    previous = point;
  }
  return visible;
}

export function drawCourseGround(ctx, round, point) {
  terrain(ctx, round.hole, points =>
    clipNear(points.map(world => round.localPoint(world))).map(local => point(local.x, 0, local.z)), true);
  drawCourseTrees(ctx, round, point);
  if (round.club === 'putter') {
    const { slope } = round.hole.green;
    if (slope) {
      const grade = Math.hypot(slope.x, slope.z);
      const down = { x: slope.x / grade * .5, z: slope.z / grade * .5 };
      for (const x of [1.25, 3.8, 7, 10.8]) {
        for (const z of [-2, 0, 2]) {
          const start = round.worldPoint({ x, z });
          if (surfaceAt(round.hole, start) !== 'green') continue;
          const end = round.localPoint({ x: start.x + down.x, z: start.z + down.z });
          arrow(ctx, point(x, .012, z), point(end.x, .012, end.z), '#d5efab7a');
        }
      }
    }
  }

  const pin = round.localPoint(round.hole.pin);
  if (pin.x < -.9) return;
  const cup = point(pin.x, 0, pin.z);
  const flagHeight = round.club === 'putter' ? 2.15 : Math.max(.85, Math.min(7, round.remaining * .027));
  const flag = point(pin.x, flagHeight, pin.z);
  ctx.beginPath();
  ctx.ellipse(cup.x, cup.y, Math.max(2, cup.scale * .11), Math.max(1, cup.scale * .03), 0, 0, Math.PI * 2);
  ctx.fillStyle = '#202c24';
  ctx.fill();

  const width = Math.max(7, Math.min(27, flag.scale * .44));
  ctx.beginPath();
  ctx.moveTo(cup.x, cup.y);
  ctx.lineTo(flag.x, flag.y);
  ctx.lineTo(flag.x + width, flag.y + width * .21);
  ctx.lineTo(flag.x, flag.y + width * .42);
  ctx.strokeStyle = '#f5e6bc';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#f0bd71';
  ctx.fill();
}

const MAP_INK = {
  pin: '#ffd08d',
  ball: '#fff8e6',
  water: '#a5dfef',
  sand: '#e8c18b',
  trees: '#9fc184',
  rough: '#95aa7b',
  aim: '#f6dcaa',
};

function mapLine(ctx, a, b, color, weight = 1) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = weight;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function arrow(ctx, a, b, color) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const size = Math.min(5, Math.hypot(b.x - a.x, b.y - a.y) * .47);
  mapLine(ctx, a, b, color, 1.2);
  for (const offset of [-.6, .6]) {
    mapLine(ctx, b, { x: b.x - size * Math.cos(angle + offset), y: b.y - size * Math.sin(angle + offset) }, color, 1.2);
  }
}

function mapDot(ctx, point, radius, color) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = '#122724';
  ctx.stroke();
}

function mapText(ctx, label, x, y, color = '#dbcdb0') {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#162c26';
  ctx.strokeText(label, x, y);
  ctx.fillStyle = color;
  ctx.fillText(label, x, y);
}

function drawAim(ctx, round, map, width, height, compact, crossings) {
  const { point, scale, zoom, putting } = map;
  const start = point(round.lie);
  const step = (zoom ? 10 : round.hole.yards <= 180 ? 25 : 50) * METERS_PER_YARD;
  const { minX, maxX, minZ, maxZ } = round.hole.bounds;
  const { x, z } = round.forward;
  const exitX = x ? ((x > 0 ? maxX : minX) - round.lie.x) / x : Infinity;
  const exitZ = z ? ((z > 0 ? maxZ : minZ) - round.lie.z) / z : Infinity;
  const limit = Math.min(exitX, exitZ, Math.hypot(width, height) / scale);
  const at = distance => point(pointAlongAim(round, distance));
  ctx.setLineDash(compact ? [2, 2] : [5, 5]);
  mapLine(ctx, start, at(limit), '#f6dcaa9e', compact ? 1 : 1.5);
  ctx.setLineDash([]);
  for (const { type, from, to } of putting ? [] : crossings) {
    mapLine(ctx, at(from), at(to), MAP_INK[type], compact ? 2 : 3);
  }
  if (!compact) {
    for (let distance = step; !putting && distance <= limit; distance += step) {
      const p = at(distance);
      if (p.x < 6 || p.y < 12 || p.x > width - 33 || p.y > height - 7) continue;
      mapDot(ctx, p, 2, MAP_INK.aim);
      mapText(ctx, Math.round(distance / METERS_PER_YARD) + ' yd', p.x + 7, p.y + 3);
    }
    const target = point(round.aimTarget);
    const center = point(round.hole.pin);
    if (Math.hypot(target.x - center.x, target.y - center.y) > (putting ? 3 : 12)) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = MAP_INK.aim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      mapLine(ctx, { x: target.x - 10, y: target.y }, { x: target.x + 10, y: target.y }, MAP_INK.aim);
      mapLine(ctx, { x: target.x, y: target.y - 10 }, { x: target.x, y: target.y + 10 }, MAP_INK.aim);
    }
  }
}

export function drawHoleMap(canvas, round, ball, { compact = false, crossings = [], estimates = [] } = {}) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
  const density = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * density) || canvas.height !== Math.round(height * density)) {
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(density, 0, 0, density, 0, 0);
  const map = mapProjection(round, width, height, compact ? 8 : 21);
  const { point, scale } = map;
  const { bounds } = round.hole;
  ctx.font = (compact ? '8' : '10') + 'px system-ui, sans-serif';
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#263d33');
  background.addColorStop(1, '#152b28');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const spacing = (map.zoom ? 10 : 25) * METERS_PER_YARD * scale;
  if (spacing >= 8) {
    const origin = point(round.hole.tee);
    for (let x = origin.x % spacing; x < width; x += spacing) {
      mapLine(ctx, { x, y: 0 }, { x, y: height }, '#d1c59114');
    }
    for (let y = origin.y % spacing; y < height; y += spacing) {
      mapLine(ctx, { x: 0, y }, { x: width, y }, '#d1c59114');
    }
  }

  const corner = point({ x: bounds.maxX, z: bounds.minZ });
  const far = point({ x: bounds.minX, z: bounds.maxZ });
  ctx.strokeStyle = '#d6b77e61';
  ctx.setLineDash([3, 4]);
  ctx.strokeRect(corner.x, corner.y, far.x - corner.x, far.y - corner.y);
  ctx.setLineDash([]);
  terrain(ctx, round.hole, points => points.map(point));
  for (const tree of round.hole.trees) {
    const center = point(tree);
    const radius = Math.max(1, tree.radius * scale);
    fillOval(ctx, center.x, center.y, radius, radius, '#16392d');
    fillOval(ctx, center.x - radius * .16, center.y - radius * .16, radius * .68, radius * .68, '#52734e');
  }
  if (map.putting && round.hole.green.slope) {
    const { x, z } = round.hole.green.slope;
    const grade = Math.hypot(x, z);
    const length = compact ? 7 : 15;
    const spacing = compact ? 25 : 39;
    for (let left = spacing / 2; left < width; left += spacing) {
      for (let top = spacing / 2; top < height; top += spacing) {
        const end = { x: left + z / grade * length, y: top - x / grade * length };
        if (surfaceAt(round.hole, map.world(end.x, end.y)) === 'green') {
          arrow(ctx, { x: left, y: top }, end, '#d5efabb0');
        }
      }
    }
  }
  if (round.status === 'ready') drawAim(ctx, round, map, width, height, compact, crossings);

  const tee = point(round.hole.tee);
  mapLine(ctx, { x: tee.x - 4, y: tee.y }, { x: tee.x + 4, y: tee.y }, '#9ec88e', 2);
  const pin = point(round.hole.pin);
  const flagHeight = compact ? 7 : 12;
  mapLine(ctx, pin, { x: pin.x, y: pin.y - flagHeight }, MAP_INK.pin, 1.5);
  patch(ctx, [
    { x: pin.x, y: pin.y - flagHeight },
    { x: pin.x + flagHeight * .68, y: pin.y - flagHeight * .76 },
    { x: pin.x, y: pin.y - flagHeight * .52 },
  ], MAP_INK.pin);
  for (const estimate of estimates) {
    const p = point(estimate.point);
    mapDot(ctx, p, 5, estimate.color);
  }
  if (round.isPractice) {
    const shots = round.history.filter(item => item.mode === round.mode);
    for (const shot of shots) {
      mapDot(ctx, point(shot.point), compact ? 1.8 : 3, shot === shots.at(-1) ? '#ffdc94' : '#c0f0dc80');
    }
  }
  mapDot(ctx, point(ball), compact ? 3 : 4, MAP_INK.ball);

  const yards = map.zoom ? 10 : round.hole.yards <= 180 ? 25 : 50;
  const feet = round.remaining < 5 ? 3 : 6;
  const bar = (map.putting ? feet * .3048 : yards * METERS_PER_YARD) * scale;
  const left = compact ? 6 : 12;
  const baseline = height - (compact ? 5 : 10);
  mapLine(ctx, { x: left, y: baseline }, { x: left + bar, y: baseline }, MAP_INK.aim, 1.5);
  for (const x of [left, left + bar]) mapLine(ctx, { x, y: baseline - 3 }, { x, y: baseline }, MAP_INK.aim);
  mapText(ctx, map.putting ? feet + ' ft' : yards + ' yd', left, baseline - 5);
  return map.world;
}
