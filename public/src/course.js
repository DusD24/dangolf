import { METERS_PER_YARD } from './practice.js';

export const COURSE_NAME = 'Moonfen Links';
const meters = yards => yards * METERS_PER_YARD;
const position = (x, z) => ({ x: meters(x), z: meters(z) });

function makeHole(name, par, yards, stations, hazards, tip, target) {
  const pin = position(yards, stations.at(-1)[1]);
  const tee = position(0, 0);
  const green = { ...pin, rx: meters(16), rz: meters(15) };
  const fairway = [[-7, 0, stations[0][2]], ...stations].map(([x, z, width]) => ({
    ...position(x, z), width: meters(width),
  }));
  const terrain = hazards.map(([type, x, z, rx, rz]) => ({
    type, ...position(x, z), rx: meters(rx), rz: meters(rz),
  }));
  const bounds = {
    minX: meters(-29), maxX: meters(yards + 50),
    minZ: meters(Math.min(...stations.map(([, z]) => z)) - 64),
    maxZ: meters(Math.max(...stations.map(([, z]) => z)) + 64),
  };
  return { name, par, yards, tee, pin, green, fairway, hazards: terrain, bounds, tip,
    target: target ? position(...target) : pin };
}

// Stations give downrange yards, the fairway center, and its half width.
export const COURSE = [
  makeHole('Lantern Meadow', 4, 330,
    [[0, 0, 14], [65, 0, 26], [215, 1, 26], [286, 0, 21], [330, 0, 15]],
    [['sand', 307, 19, 14, 8]], 'A wide first drive sets up an open approach.'),
  makeHole('Willow Brook', 3, 125,
    [[0, 0, 10], [45, 0, 19], [90, 0, 21], [125, 0, 15]],
    [['water', 58, -7, 13, 33], ['sand', 121, 18, 12, 7]],
    'Carry the brook or lay up on the near bank. The right edge stays dry.'),
  makeHole('Crescent Bend', 4, 365,
    [[0, 0, 13], [100, 0, 22], [190, -2, 26], [254, -27, 23], [365, -47, 16]],
    [['sand', 237, -38, 16, 10], ['sand', 343, -26, 15, 8]],
    'Play to the elbow. A left crescent can follow the bend.', [188, -2]),
  makeHole('Starfall Reach', 5, 480,
    [[0, 0, 15], [100, 5, 29], [210, 17, 32], [312, 19, 31], [390, 6, 25], [480, -5, 17]],
    [['water', 239, -28, 51, 23], ['sand', 428, 17, 20, 8]],
    'Stay right for the layup. A strong star can carry the left edge of the lake.', [245, 16]),
  makeHole('Swordsman’s Run', 3, 155,
    [[0, 0, 12], [66, 0, 23], [119, 0, 21], [155, 0, 16]],
    [['sand', 133, -16, 16, 8], ['sand', 133, 17, 13, 7]],
    'The green is open straight ahead. A sword can run through the gap.'),
  makeHole('Split Oak', 4, 382,
    [[0, 0, 14], [100, 0, 25], [160, 0, 39], [236, 0, 39], [300, 4, 25], [382, 9, 17]],
    [['water', 199, 0, 50, 12], ['sand', 348, 24, 16, 8]],
    'Pick a side of the long pool before you swing.', [204, 27]),
  makeHole('Mirror Pond', 3, 170,
    [[0, 0, 11], [68, -4, 21], [130, -8, 25], [170, 0, 16]],
    [['water', 131, 15, 24, 23], ['sand', 177, -20, 10, 6]],
    'The left apron is the safe miss. Water guards the right approach.', [145, -17]),
  makeHole('Long Lantern', 5, 505,
    [[0, 0, 15], [125, 4, 28], [232, 13, 29], [307, 27, 24], [384, 37, 25], [505, 42, 17]],
    [['water', 318, 3, 31, 22], ['sand', 422, 56, 18, 10], ['sand', 485, 23, 15, 8]],
    'Lay up on the outside. The inside line saves distance if you clear the water.', [230, 14]),
  makeHole('Last Light', 4, 390,
    [[0, 0, 14], [110, -4, 24], [217, -14, 27], [310, -10, 22], [390, 3, 15]],
    [['water', 316, -38, 33, 13], ['sand', 372, 16, 15, 8], ['sand', 397, -15, 9, 7]],
    'A good drive down the middle leaves a clear look at the last flag.', [220, -14]),
];

function inside(region, { x, z }) {
  return ((x - region.x) / region.rx) ** 2 + ((z - region.z) / region.rz) ** 2 <= 1;
}

export function surfaceAt(hole, ball) {
  const { x, z } = ball;
  const { minX, maxX, minZ, maxZ } = hole.bounds;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return 'out';
  for (const hazard of hole.hazards) {
    if (inside(hazard, ball)) return hazard.type;
  }
  if (inside(hole.green, ball)) return 'green';

  const next = hole.fairway.findIndex(station => station.x >= x);
  if (next < 1) return 'rough';
  const a = hole.fairway[next - 1];
  const b = hole.fairway[next];
  const progress = (x - a.x) / (b.x - a.x);
  const center = a.z + (b.z - a.z) * progress;
  const width = a.width + (b.width - a.width) * progress;
  return Math.abs(z - center) <= width ? 'fairway' : 'rough';
}
