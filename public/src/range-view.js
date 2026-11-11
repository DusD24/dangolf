const TAU = Math.PI * 2;
const NEAR = -3.3;

function line(ctx, a, b, color, weight = 1) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.stroke();
}

function oval(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function worldProject(range, point, world, height = 0) {
  const local = range.localPoint(world);
  return local.x > NEAR ? point(local.x, height, local.z) : null;
}

// The rings follow the same world ellipses used by the practice targets.
// Projecting each vertex also keeps their orientation correct when aiming sideways.
function ring(ctx, range, point, target, fraction, color, weight) {
  let drawing = false;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const angle = i / 64 * TAU;
    const projected = worldProject(range, point, {
      x: target.x + Math.cos(angle) * target.rx * fraction,
      z: target.z + Math.sin(angle) * target.rz * fraction,
    }, .025);
    if (!projected) {
      drawing = false;
      continue;
    }
    if (drawing) ctx.lineTo(projected.x, projected.y);
    else ctx.moveTo(projected.x, projected.y);
    drawing = true;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.stroke();
}

function targetFlag(ctx, range, point, target, selected) {
  const base = worldProject(range, point, target);
  const top = worldProject(range, point, target, 3.2);
  if (!base || !top) return;
  const width = Math.min(19, Math.max(4, top.scale * 1.15));
  line(ctx, base, top, '#e3d9b4b0', 1);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(top.x + width, top.y + width * .17);
  ctx.lineTo(top.x + width * .73, top.y + width * .53);
  ctx.lineTo(top.x, top.y + width * .43);
  ctx.closePath();
  ctx.fillStyle = selected ? '#f2cc85' : '#99c6aa';
  ctx.fill();
  line(ctx, { x: top.x, y: top.y + width * .15 },
    { x: top.x + width * .76, y: top.y + width * .26 }, '#fff0b27a', .7);
}

function targetDetails(ctx, range, point, width, height) {
  if (range.mode === 'putting' || range.mode === 'fringe') return;
  const targets = (range.targets ?? []).map((target, index) => ({
    target, index, local: range.localPoint(target),
  })).filter(({ local }) => local.x > 3).sort((a, b) => b.local.x - a.local.x);
  for (const { target, index, local } of targets) {
    const center = point(local.x, 0, local.z);
    const extent = center.scale * Math.max(target.rx, target.rz);
    if (center.x + extent < 0 || center.x - extent > width || center.y - extent > height) continue;
    const selected = range.selectedTarget === target || range.selectedTarget === index
      || (target.id !== undefined && range.selectedTarget === target.id);
    ctx.save();
    if (selected) {
      ctx.shadowColor = '#bdf8d5';
      ctx.shadowBlur = 8;
    }
    ring(ctx, range, point, target, 1, selected ? '#e1dfa8ba' : '#c6d5a763', selected ? 1.7 : 1);
    ring(ctx, range, point, target, .62, selected ? '#abf4d5ad' : '#add6b847', 1);
    ring(ctx, range, point, target, .26, selected ? '#f8d695d9' : '#e0c38975', 1);
    ctx.restore();
    // The shared ground renderer owns the selected pin and its cup.
    if (!selected) targetFlag(ctx, range, point, target, false);
    if (selected && target.yards !== undefined && center.x > 28 && center.x < width - 28) {
      const flag = point(local.x, Math.max(.85, Math.min(7, range.remaining * .027)), local.z);
      const y = flag.y - 13;
      ctx.fillStyle = '#172c2de8';
      ctx.fillRect(flag.x - 25, y - 9, 50, 18);
      ctx.strokeStyle = '#cbb788a0';
      ctx.lineWidth = .8;
      ctx.strokeRect(flag.x - 25, y - 9, 50, 18);
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f2dbad';
      ctx.fillText(`${target.yards} yd`, flag.x, y);
    }
  }
}

function lantern(ctx, range, point, world, width, height) {
  const base = worldProject(range, point, world);
  const head = worldProject(range, point, world, 1.2);
  if (!base || !head || base.x < -32 || base.x > width + 32 || head.y > height + 32) return;
  const size = Math.min(13, Math.max(1.8, head.scale * .11));
  const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, size * 3.8);
  glow.addColorStop(0, '#ffda8d52');
  glow.addColorStop(.35, '#e8b46a25');
  glow.addColorStop(1, '#e8b46a00');
  oval(ctx, head.x, head.y, size * 3.8, size * 3.8, glow);
  oval(ctx, base.x, base.y, size * 1.5, size * .38, '#11292580');
  line(ctx, base, { x: head.x, y: head.y + size }, '#393c32', Math.max(1.3, head.scale * .045));
  line(ctx, { x: base.x + 1, y: base.y }, { x: head.x + 1, y: head.y + size }, '#ae99646b', .8);
  ctx.fillStyle = '#e9bd75';
  ctx.fillRect(head.x - size * .5, head.y - size * .65, size, size * 1.3);
  ctx.fillStyle = '#ffebae';
  ctx.fillRect(head.x - size * .17, head.y - size * .53, size * .34, size * 1.06);
  ctx.strokeStyle = '#58604a';
  ctx.lineWidth = Math.max(1, size * .13);
  ctx.strokeRect(head.x - size * .56, head.y - size * .72, size * 1.12, size * 1.44);
  ctx.beginPath();
  ctx.moveTo(head.x - size * .85, head.y - size * .77);
  ctx.lineTo(head.x, head.y - size * 1.32);
  ctx.lineTo(head.x + size * .85, head.y - size * .77);
  ctx.closePath();
  ctx.fillStyle = '#70765a';
  ctx.fill();
  line(ctx, { x: head.x - size * .65, y: head.y - size * .84 },
    { x: head.x, y: head.y - size * 1.25 }, '#dbc78a', .8);
}

function teeStones(ctx, range, point) {
  const tee = range.hole.tee;
  // Only edge the driving bay: the practice bunker and green keep their natural lies.
  if (range.mode !== 'driving') return;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = tee.x - 1.15 + i * .72;
      const z = tee.z + side * 2.4;
      const corners = [[-.31, -.13], [.31, -.13], [.31, .13], [-.31, .13]]
        .map(([dx, dz]) => worldProject(range, point, { x: x + dx, z: z + dz }, .035));
      if (corners.some(corner => !corner)) continue;
      ctx.beginPath();
      corners.forEach((corner, index) => index ? ctx.lineTo(corner.x, corner.y) : ctx.moveTo(corner.x, corner.y));
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#68776b' : '#788473';
      ctx.fill();
      ctx.strokeStyle = '#b3bd9375';
      ctx.lineWidth = .8;
      ctx.stroke();
      const rune = worldProject(range, point, { x, z }, .045);
      const a = worldProject(range, point, { x: x - .1, z }, .045);
      const b = worldProject(range, point, { x: x + .1, z }, .045);
      if (rune && a && b) {
        line(ctx, a, b, '#c0c28d', 1);
        oval(ctx, rune.x, rune.y, 1.4, 1, '#cfdaa2');
      }
    }
  }
}

export function drawRangeDetails(ctx, range, point, width, height) {
  ctx.save();
  targetDetails(ctx, range, point, width, height);
  const tee = range.hole.tee;
  const shortGame = range.mode === 'putting' || range.mode === 'fringe';
  const markers = [];
  for (const side of [-1, 1]) {
    const stations = shortGame ? [[8, 7], [22, 13]]
      : [[4, 4.5], [12, 7.5], [28, 13], [55, 22], [95, 31], [155, 44], [240, 60]];
    for (const [x, z] of stations) {
      const world = { x: tee.x + x, z: tee.z + side * z };
      markers.push({ world, depth: range.localPoint(world).x });
    }
  }
  markers.sort((a, b) => b.depth - a.depth);
  for (const { world, depth } of markers) {
    if (depth > 1) lantern(ctx, range, point, world, width, height);
  }
  teeStones(ctx, range, point);
  ctx.restore();
}
