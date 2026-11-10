const clamp01 = value => Math.max(0, Math.min(1, value));
const SAMPLE_COUNT = 48;

function crescent(direction) {
  const path = [[0, 0]];
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    path.push([-direction * 0.58 * Math.sin(Math.PI * t), -t]);
  }
  path.push([0, -1]);
  for (let i = 23; i > 0; i--) {
    const t = i / 24;
    path.push([-direction * 0.22 * Math.sin(Math.PI * t), -t]);
  }
  path.push([0, 0]);
  return path;
}

const star = [[0, 0]];
for (let point = 1; point < 5; point++) {
  const angle = Math.PI / 2 + point * 4 * Math.PI / 5;
  star.push([0.5 * Math.cos(angle), -0.5 + 0.5 * Math.sin(angle)]);
}
star.push([0, 0]);

// Taper back to the start so the second edge leads into the vertical pull.
const sword = [[0, 0], [-.025, -.16], [-.18, -.34], [-.30, -.55], [-.23, -.74], [0, -1],
  [.23, -.74], [.30, -.55], [.18, -.34], [.025, -.16], [0, 0]];

export const RUNES = [
  { id: 'crescent-left', name: 'Crescent', type: 'crescent', direction: -1, pace: 760, path: crescent(-1) },
  { id: 'crescent-right', name: 'Crescent', type: 'crescent', direction: 1, pace: 760, path: crescent(1) },
  { id: 'sword', name: 'Sword', type: 'sword', pace: 1200, path: sword },
  { id: 'star', name: 'Star', type: 'star', pace: 1050, path: star },
];

function normalizedSamples(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const distances = [0];
  for (const [i, point] of points.entries()) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    if (i > 0) {
      const previous = points[i - 1];
      distances.push(distances[i - 1] + Math.hypot(point.x - previous.x, point.y - previous.y));
    }
  }

  const height = maxY - minY;
  const midX = (minX + maxX) / 2;
  const length = distances.at(-1);
  const samples = [];
  let end = 1;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const target = i * length / (SAMPLE_COUNT - 1);
    while (end < points.length - 1 && distances[end] < target) end++;
    const from = points[end - 1];
    const to = points[end];
    const span = distances[end] - distances[end - 1];
    const mix = span > 0 ? (target - distances[end - 1]) / span : 0;
    samples.push([
      (from.x + mix * (to.x - from.x) - midX) / height,
      (from.y + mix * (to.y - from.y) - maxY) / height,
    ]);
  }
  return samples;
}

const templates = RUNES.map(rune => ({
  rune,
  samples: normalizedSamples(rune.path.map(([x, y]) => ({ x, y }))),
}));

function shapeScore(path, template, guided) {
  let direct = 0;
  let reverse = 0;
  for (const [i, [x, y]] of path.entries()) {
    const [dx, dy] = template[i];
    const [rx, ry] = template[SAMPLE_COUNT - 1 - i];
    direct += (x - dx) ** 2 + (y - dy) ** 2;
    reverse += (x - rx) ** 2 + (y - ry) ** 2;
  }
  const error = Math.sqrt(Math.min(direct, reverse) / SAMPLE_COUNT);
  const grace = guided ? .055 : .042;
  return clamp01(1 - Math.max(0, error - grace) / (guided ? .29 : .25));
}

export function runeExit(points) {
  const start = points[0];
  const pull = points.findIndex(point => point.y > start.y + 0.052);
  if (pull < 4) return -1;

  let top = 0;
  for (let i = 1; i < pull; i++) {
    if (points[i].y < points[top].y) top = i;
  }
  if (start.y - points[top].y < 0.065) return -1;

  let exit = top;
  let nearest = Infinity;
  for (let i = top + 1; i < pull; i++) {
    const distance = Math.hypot(points[i].x - start.x, points[i].y - start.y);
    if (distance < nearest) {
      nearest = distance;
      exit = i;
    }
  }
  // Choose the closest return to the start before the first committed pull.
  return exit > top ? exit : -1;
}

function swingRhythm(swing, turn, guided) {
  const exitGap = swing[1].t - swing[0].t;
  const turnGap = swing[turn + 1].t - swing[turn].t;
  const holdPenalty = gap => clamp01((gap - (guided ? 175 : 125)) / 450);
  const continuity = 1 - (holdPenalty(exitGap) + holdPenalty(turnGap)) / 2;
  const downTime = Math.max(1, swing[turn].t - swing[0].t);
  const upTime = Math.max(1, swing.at(-1).t - swing[turn].t);
  const cadence = clamp01(1 - Math.max(0, Math.abs(Math.log(upTime / downTime)) - 0.43) / 1.3);
  return 0.76 * continuity + 0.24 * cadence;
}

export function analyzeStroke(points, mode, guideId) {
  const exit = runeExit(points);
  if (exit < 0) return { swing: points, spell: null, attempted: false };

  const swing = points.slice(exit);
  const fallback = { swing, spell: null, attempted: true };
  let turn = 0;
  for (let i = 1; i < swing.length; i++) {
    if (swing[i].y > swing[turn].y) turn = i;
  }
  if (turn === 0 || turn === swing.length - 1) return fallback;

  const guided = mode === 'guided';
  const path = normalizedSamples(points.slice(0, exit + 1));
  let match;
  let geometry = 0;
  for (const template of templates) {
    if (guided && template.rune.id !== guideId) continue;
    const score = shapeScore(path, template.samples, guided);
    if (score > geometry) {
      geometry = score;
      match = template.rune;
    }
  }
  if (!match || geometry < 0.69) return fallback;

  const paceTarget = match.pace * (guided ? 1.20 : 1);
  const pace = clamp01(1 - Math.max(0, (swing[0].t - points[0].t) / paceTarget - 1) / 1.45);
  const rhythm = swingRhythm(swing, turn, guided);
  const score = 0.5 * geometry + 0.2 * pace + 0.3 * rhythm;
  const purity = score >= 0.985 ? 1 : score;
  return {
    swing,
    attempted: true,
    spell: {
      id: match.id,
      name: match.name,
      type: match.type,
      direction: match.direction,
      purity,
      potency: purity * (guided ? 0.6 : 1),
      guided,
      geometry,
      pace,
      rhythm,
    },
  };
}
