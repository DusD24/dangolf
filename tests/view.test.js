import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTeeView } from '../public/src/view.js';

for (const [width, height] of [[390, 844], [1280, 800]]) {
  test('a straight ball recedes up the fairway at ' + width + 'px wide', () => {
    const { point, horizon } = createTeeView(width, height);
    const tee = point(0.20, 0.043, 0);
    const downrange = point(16, 0.043, 0);
    assert.ok(tee.y > downrange.y && downrange.y > horizon);
    assert.ok(downrange.scale < tee.scale / 2);
    assert.ok(Math.abs(downrange.x - width / 2) < Math.abs(tee.x - width / 2));
  });
}

test('left and right misses separate across the fairway', () => {
  const { point } = createTeeView(390, 844);
  assert.ok(point(12, 0, -3).x < point(12, 0, 0).x);
  assert.ok(point(12, 0, 3).x > point(12, 0, 0).x);
});
