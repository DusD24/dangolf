import { surfaceAt } from './course.js';
import { METERS_PER_YARD } from './practice.js';

export function pinDistance(meters, onGreen = false) {
  return onGreen || meters < 12 ? Math.round(meters / .3048) + ' ft' :
    Math.round(meters / METERS_PER_YARD) + ' yd';
}

export function pointAlongAim(round, distance) {
  return {
    x: round.lie.x + round.forward.x * distance,
    z: round.lie.z + round.forward.z * distance,
  };
}

export function puttAimTarget(round, direction) {
  const angle = round.aim + direction * Math.PI / 360;
  return { x: round.lie.x + round.remaining * Math.cos(angle), z: round.lie.z + round.remaining * Math.sin(angle) };
}

export function landingOnAim(round, distance) {
  const point = pointAlongAim(round, distance);
  return { point, surface: surfaceAt(round.hole, point) };
}

export function greenRead(round) {
  const { pin, green } = round.hole;
  if (!green.slope || round.remaining < .01) return '';
  const x = (pin.x - round.lie.x) / round.remaining;
  const z = (pin.z - round.lie.z) / round.remaining;
  const side = green.slope.z * x - green.slope.x * z;
  const grade = green.slope.x * x + green.slope.z * z;
  const pace = Math.abs(grade) < .009 ? '' : grade > 0 ? ' · Downhill' : ' · Uphill';
  return (Math.abs(side) < .009 ? 'Little break' : side > 0 ? 'Breaks right' : 'Breaks left') + pace;
}

export function hazardsOnAim(hole, lie, aim) {
  const crossings = [];
  const canopies = hole.trees.map(({ x, z, radius }) => ({ type: 'trees', x, z, rx: radius, rz: radius }));
  for (const { type, x, z, rx, rz } of [...hole.hazards, ...canopies]) {
    const dx = aim.x / rx;
    const dz = aim.z / rz;
    const ox = (lie.x - x) / rx;
    const oz = (lie.z - z) / rz;
    // Solve where the forward aim ray enters and leaves the actual hazard ellipse.
    const a = dx * dx + dz * dz;
    const b = dx * ox + dz * oz;
    const c = ox * ox + oz * oz - 1;
    const discriminant = b * b - a * c;
    if (discriminant <= 0) continue;
    const half = Math.sqrt(discriminant);
    const to = (-b + half) / a;
    if (to > 0) crossings.push({ type, from: Math.max(0, (-b - half) / a), to });
  }
  crossings.sort((a, b) => a.from - b.from);
  const stretches = [];
  for (const crossing of crossings) {
    const last = stretches.at(-1);
    if (last?.type === 'trees' && crossing.type === 'trees' && crossing.from <= last.to) {
      last.to = Math.max(last.to, crossing.to);
    } else {
      stretches.push(crossing);
    }
  }
  return stretches;
}

export function mapProjection(round, width, height, padding = 16) {
  const { pin } = round.hole;
  const zoom = round.remaining < 33;
  const putting = round.club === 'putter' && zoom;
  const span = putting ? Math.max(3, round.remaining * .7 + 2) : 42;
  const center = putting ? { x: (pin.x + round.lie.x) / 2, z: (pin.z + round.lie.z) / 2 } : pin;
  const bounds = zoom ? {
    minX: center.x - span, maxX: center.x + span,
    minZ: center.z - span, maxZ: center.z + span,
  } : round.hole.bounds;
  const scale = Math.min((width - padding * 2) / (bounds.maxZ - bounds.minZ),
    (height - padding * 2) / (bounds.maxX - bounds.minX));
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerZ = (bounds.maxZ + bounds.minZ) / 2;
  return {
    scale, zoom, putting,
    point: ({ x, z }) => ({ x: width / 2 + (z - centerZ) * scale, y: height / 2 - (x - centerX) * scale }),
    world: (x, y) => ({ x: centerX - (y - height / 2) / scale, z: centerZ + (x - width / 2) / scale }),
  };
}
