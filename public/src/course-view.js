const COLORS = {
  water: '#31596b',
  sand: '#bc9b67',
  green: '#71935c',
  fairway: ['#4e7049', '#577951'],
};

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
  patch(ctx, project(oval(hole.green)), COLORS.green);
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

  const pin = round.localPoint(round.hole.pin);
  if (pin.x < -.9) return;
  const cup = point(pin.x, 0, pin.z);
  const flagHeight = Math.max(.85, Math.min(7, round.remaining * .027));
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

export function drawHoleMap(canvas, round, ball) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const bounds = round.remaining < 33 ? {
    minX: round.hole.pin.x - 42, maxX: round.hole.pin.x + 42,
    minZ: round.hole.pin.z - 42, maxZ: round.hole.pin.z + 42,
  } : round.hole.bounds;
  const scale = Math.min((width - 32) / (bounds.maxZ - bounds.minZ),
    (height - 32) / (bounds.maxX - bounds.minX));
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerZ = (bounds.maxZ + bounds.minZ) / 2;
  const point = ({ x, z }) => ({ x: width / 2 + (z - centerZ) * scale, y: height / 2 - (x - centerX) * scale });

  ctx.fillStyle = '#243d31';
  ctx.fillRect(0, 0, width, height);
  terrain(ctx, round.hole, points => points.map(point));

  const current = point(ball);
  const target = point(round.hole.pin);
  if (round.status === 'ready') {
    const aimLength = round.remaining < 33 ? 14 : 120;
    const aim = point({
      x: round.lie.x + round.forward.x * aimLength,
      z: round.lie.z + round.forward.z * aimLength,
    });
    ctx.strokeStyle = '#f0d29b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(current.x, current.y);
    ctx.lineTo(aim.x, aim.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const [dot, color, radius] of [[target, '#f0b36d', 5], [current, '#fff7dc', 4]]) {
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  return (x, y) => ({ x: centerX - (y - height / 2) / scale, z: centerZ + (x - width / 2) / scale });
}
