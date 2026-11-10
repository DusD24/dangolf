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

export function landingOnAim(round, distance) {
  const point = pointAlongAim(round, distance);
  return { point, surface: surfaceAt(round.hole, point) };
}

export function hazardsOnAim(hole, lie, aim) {
  const crossings = [];
  for (const { type, x, z, rx, rz } of hole.hazards) {
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
  return crossings.sort((a, b) => a.from - b.from);
}

export function mapProjection(round, width, height, padding = 16) {
  const { pin } = round.hole;
  const zoom = round.remaining < 33;
  const bounds = zoom ? {
    minX: pin.x - 42, maxX: pin.x + 42,
    minZ: pin.z - 42, maxZ: pin.z + 42,
  } : round.hole.bounds;
  const scale = Math.min((width - padding * 2) / (bounds.maxZ - bounds.minZ),
    (height - padding * 2) / (bounds.maxX - bounds.minX));
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerZ = (bounds.maxZ + bounds.minZ) / 2;
  return {
    scale, zoom,
    point: ({ x, z }) => ({ x: width / 2 + (z - centerZ) * scale, y: height / 2 - (x - centerX) * scale }),
    world: (x, y) => ({ x: centerX - (y - height / 2) / scale, z: centerZ + (x - width / 2) / scale }),
  };
}
