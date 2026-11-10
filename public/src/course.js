import { METERS_PER_YARD } from './practice.js';

export const COURSE_NAME = 'Moonfen Links';
const meters = yards => yards * METERS_PER_YARD;
const position = (x, z) => ({ x: meters(x), z: meters(z) });

function fairwayAt(fairway, x) {
  const next = fairway.findIndex(station => station.x >= x);
  if (next < 1) return next === 0 ? fairway[0] : fairway.at(-1);
  const a = fairway[next - 1];
  const b = fairway[next];
  const progress = (x - a.x) / (b.x - a.x);
  return { z: a.z + (b.z - a.z) * progress, width: a.width + (b.width - a.width) * progress };
}

function plantTreeLines(fairway, yards, water, bounds) {
  const trees = [];
  for (const side of [-1, 1]) {
    for (const row of [0, 1]) {
      for (let x = 28 + row * 7; x < yards + 35; x += 9 + row * 4) {
        const seed = x + side * yards;
        const radius = meters(4.6 + 1.1 * Math.sin(seed * 2.4));
        const height = 12 + 2.5 * Math.cos(seed * 1.6);
        const downrange = meters(x + 2.1 * Math.sin(seed * 1.7));
        const edge = fairwayAt(fairway, downrange);
        const setback = meters(6 + row * 14 + 1.8 * Math.cos(seed));
        const tree = { x: downrange, z: edge.z + side * (edge.width + setback + radius), radius, height };
        if (tree.z - radius < bounds.minZ || tree.z + radius > bounds.maxZ) continue;
        if (!water.some(pond => inside({ ...pond, rx: pond.rx + radius, rz: pond.rz + radius }, tree))) {
          trees.push(tree);
        }
      }
    }
  }
  return trees;
}

function makeHole(name, par, yards, stations, hazards, tip, target) {
  const pin = position(yards, stations.at(-1)[1]);
  const tee = position(0, 0);
  const fall = 1.95 + (yards - 330) * 2.399963;
  const grade = .028 + .002 * (yards % 7);
  const green = { ...pin, rx: meters(16), rz: meters(15),
    slope: { x: grade * Math.cos(fall), z: grade * Math.sin(fall) } };
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
  const trees = plantTreeLines(fairway, yards, terrain.filter(hazard => hazard.type === 'water'), bounds);
  return { name, par, yards, tee, pin, green, fairway, hazards: terrain, trees, bounds, tip,
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
    'The green is open straight ahead. A spear can run through the gap.'),
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
    'A good drive down the middle leaves a clear look at the last flag on the front nine.', [220, -14]),
  makeHole('Briar Gate', 4, 358,
    [[0, 0, 15], [110, 0, 25], [163, 0, 21], [218, 27, 17], [273, 46, 18], [358, 63, 16]],
    [['sand', 303, 64, 14, 8], ['sand', 341, 44, 10, 7]],
    'Lay up at the gate or send a right Crescent through it.', [163, 4]),
  makeHole('Foxglove Hollow', 3, 142,
    [[0, 0, 12], [56, -1, 19], [104, -3, 20], [142, -4, 16]],
    [['sand', 124, -16, 11, 9], ['sand', 142, 15, 10, 7]],
    'The right apron gives a short shot room to run onto the green.'),
  makeHole('Witchwood Elbow', 4, 376,
    [[0, 0, 14], [116, 0, 24], [170, 0, 22], [225, -28, 17], [280, -48, 19], [376, -66, 16]],
    [['sand', 259, -63, 15, 7], ['sand', 360, -49, 11, 8]],
    'Left Crescent follows the elbow. A straight drive can lay up before the turn.', [169, -4]),
  makeHole('Emberfen', 5, 516,
    [[0, 0, 15], [117, 3, 28], [226, 16, 28], [304, 36, 23], [390, 25, 25], [516, 6, 16]],
    [['water', 327, 1, 42, 20], ['sand', 435, 39, 20, 10], ['sand', 496, -11, 15, 8]],
    'Stay right of the fen on the second shot. The fairway turns back left after the water.', [226, 16]),
  makeHole('The Standing Stones', 4, 324,
    [[0, 0, 14], [102, 2, 25], [190, 12, 28], [247, 8, 24], [324, -4, 15]],
    [['sand', 208, -10, 18, 9], ['sand', 226, 34, 15, 9], ['sand', 305, -20, 10, 8]],
    'A shot through the gap between the bunkers leaves a short wedge.', [207, 13]),
  makeHole('Mothlight Pool', 3, 184,
    [[0, 0, 12], [76, 4, 20], [130, 12, 19], [184, 8, 16]],
    [['water', 143, -13, 30, 22], ['sand', 170, 25, 12, 8], ['sand', 195, -8, 9, 6]],
    'The green opens from the right, with water guarding the short left.', [169, 12]),
  makeHole('Owl’s Turn', 4, 402,
    [[0, 0, 14], [110, -1, 26], [175, 1, 23], [238, 28, 20], [300, 54, 20], [402, 62, 16]],
    [['sand', 231, 47, 17, 8], ['sand', 361, 41, 18, 9]],
    'The trees guard the right turn. Follow the fairway with a right Crescent or play to the corner.', [177, 5]),
  makeHole('Blackthorn Reach', 5, 534,
    [[0, 0, 15], [112, 0, 29], [202, -4, 26], [280, -27, 22], [387, -52, 27], [534, -58, 16]],
    [['sand', 263, -45, 16, 7], ['water', 425, -18, 43, 22], ['sand', 517, -74, 13, 8]],
    'Follow the left turn off the tee and keep the approach left of the mere.', [200, -8]),
  makeHole('Moonrise Keep', 4, 418,
    [[0, 0, 15], [113, 1, 26], [192, 3, 24], [264, -20, 20], [323, -34, 19], [418, -32, 16]],
    [['sand', 241, 1, 15, 8], ['water', 352, -62, 29, 15], ['sand', 403, -13, 14, 8]],
    'Turn left after the first landing area. Favor the right side on the approach to the final flag.', [192, 1]),
];

function inside(region, { x, z }) {
  return ((x - region.x) / region.rx) ** 2 + ((z - region.z) / region.rz) ** 2 <= 1;
}

export function isFringe(hole, ball, surface = surfaceAt(hole, ball)) {
  if (surface !== 'fairway' && surface !== 'rough') return false;
  const { x, z, rx, rz } = hole.green;
  const dx = ball.x - x;
  const dz = ball.z - z;
  const relative = Math.hypot(dx / rx, dz / rz);
  return relative > 1 && Math.hypot(dx, dz) * (1 - 1 / relative) <= meters(4);
}

export function surfaceAt(hole, ball) {
  const { x, z } = ball;
  const { minX, maxX, minZ, maxZ } = hole.bounds;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return 'out';
  for (const hazard of hole.hazards) {
    if (inside(hazard, ball)) return hazard.type;
  }
  if (inside(hole.green, ball)) return 'green';

  if (x <= hole.fairway[0].x || x > hole.fairway.at(-1).x) return 'rough';
  const edge = fairwayAt(hole.fairway, x);
  return Math.abs(z - edge.z) <= edge.width ? 'fairway' : 'rough';
}

const treeDistance = (tree, point) => Math.hypot(point.x - tree.x, point.z - tree.z);

export function hitsTree(hole, ball, lie) {
  return hole.trees.some(tree => {
    if (ball.y > tree.height || Math.abs(ball.x - tree.x) > tree.radius) return false;
    const collisionRadius = ball.y >= tree.height * .28 ? tree.radius : .48;
    // A ball underneath a tree can still be punched out on the next shot.
    return treeDistance(tree, ball) <= collisionRadius && treeDistance(tree, lie) > tree.radius;
  });
}
