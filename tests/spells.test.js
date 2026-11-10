import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeStroke, RUNES } from '../public/src/spells.js';

function stroke(path, { drawMs = 550, exitPause = 0, turnPause = 0 } = {}) {
  const origin = { x: 0.55, y: 0.65 };
  const points = path.map(([x, y], i) => ({
    x: origin.x + x * 0.24,
    y: origin.y + y * 0.24,
    t: i * drawMs / (path.length - 1),
  }));
  for (let i = 1; i <= 12; i++) {
    points.push({ x: origin.x, y: origin.y + 0.45 * i / 12, t: drawMs + exitPause + 20 * i });
  }
  for (let i = 1; i <= 12; i++) {
    points.push({ x: origin.x, y: origin.y + 0.45 * (1 - i / 12),
      t: drawMs + exitPause + 240 + turnPause + 15 * i });
  }
  return points;
}

test('all guided runes join a full straight swing and can reach full purity', () => {
  for (const rune of RUNES) {
    const points = stroke(rune.path);
    const result = analyzeStroke(points, 'guided', rune.id);
    assert.equal(result.spell?.id, rune.id);
    assert.equal(result.spell.purity, 1);
    assert.equal(result.spell.potency, 0.6);
    assert.equal(result.swing[0], points[rune.path.length - 1]);
  }
});

test('Hard recognizes a mirrored crescent drawn in either direction', () => {
  const rune = RUNES.find(item => item.id === 'crescent-right');
  const points = stroke(rune.path.toReversed());
  const result = analyzeStroke(points, 'hard');
  assert.equal(result.spell?.id, 'crescent-right');
  assert.equal(result.spell.potency, 1);
  assert.equal(analyzeStroke(points, 'guided', 'crescent-left').spell, null);
});

test('a scaled, hand-drawn star with small unevenness can still cast', () => {
  const points = stroke([[0, 0], [-.31, -.91], [.49, -.34], [-.45, -.37],
    [.28, -.95], [.015, -.018]]);
  const result = analyzeStroke(points, 'hard');
  assert.equal(result.spell?.id, 'star');
  assert.ok(result.spell.purity > 0.8);
});

test('a triangular doodle falls back to the swing from its exit', () => {
  const points = stroke([[0, 0], [0, -.97], [.60, -.38], [0, 0]]);
  const result = analyzeStroke(points, 'hard');
  assert.equal(result.spell, null);
  assert.equal(result.swing[0], points[3]);
});

test('a plain pull stays a plain pull and a glyph alone never arms a spell', () => {
  const plain = [{ x: .5, y: .4, t: 0 }, { x: .5, y: .8, t: 200 }, { x: .5, y: .4, t: 350 }];
  assert.deepEqual(analyzeStroke(plain, 'hard'), { swing: plain, spell: null, attempted: false });
  const star = RUNES.find(rune => rune.id === 'star');
  const unfinished = stroke(star.path).slice(0, star.path.length);
  assert.equal(analyzeStroke(unfinished, 'hard').spell, null);
});

test('draw pace and both transition holds independently reduce purity', () => {
  const star = RUNES.find(rune => rune.id === 'star');
  for (const options of [{ drawMs: 1900 }, { exitPause: 420 }, { turnPause: 420 }]) {
    const result = analyzeStroke(stroke(star.path, options), 'hard');
    assert.equal(result.spell?.id, 'star');
    assert.ok(result.spell.purity < 0.96);
  }
});
