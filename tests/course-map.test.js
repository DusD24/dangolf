import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COURSE } from '../public/src/course.js';
import { hazardsOnAim, landingOnAim, mapProjection, pinDistance } from '../public/src/course-map.js';
import { METERS_PER_YARD, Practice, STEP } from '../public/src/practice.js';
import { shotRanges } from '../public/src/range-card.js';
import { Round } from '../public/src/round.js';

test('green distances stay in feet even on the far edge', () => {
  const round = new Round();
  round.lie = { x: round.hole.pin.x - 45 * .3048, z: round.hole.pin.z };
  assert.equal(round.surface, 'green');
  assert.equal(pinDistance(round.remaining, true), '45 ft');
  assert.equal(pinDistance(round.remaining), '15 yd');
});

test('hazard distances mark the near and far edges on the current aim line', () => {
  const round = new Round([COURSE[1]]);
  round.prepare(new Practice());
  const water = hazardsOnAim(round.hole, round.lie, round.forward)[0];
  assert.equal(water.type, 'water');
  assert.equal(Math.floor(water.from / METERS_PER_YARD), 45);
  assert.equal(Math.ceil(water.to / METERS_PER_YARD), 71);
  assert.equal(landingOnAim(round, (water.from + water.to) / 2).surface, 'water');
  assert.equal(landingOnAim(round, water.to + METERS_PER_YARD).surface, 'fairway');

  round.setAim({ x: 50, z: 50 });
  const treeLines = hazardsOnAim(round.hole, round.lie, round.forward);
  assert.ok(treeLines.length > 0);
  assert.ok(treeLines.every(({ type, from, to }) => type === 'trees' && to > from));
});

test('map coordinates invert after zooming in from the new lie', () => {
  const round = new Round([COURSE[2]]);
  round.prepare(new Practice());
  const whole = mapProjection(round, 320, 360);
  round.lie = { x: round.hole.pin.x - 12, z: round.hole.pin.z + 5 };
  const close = mapProjection(round, 320, 360);
  assert.ok(close.scale > whole.scale);
  for (const mark of [round.lie, round.hole.pin]) {
    const screen = close.point(mark);
    const world = close.world(screen.x, screen.y);
    assert.ok(Math.hypot(world.x - mark.x, world.z - mark.z) < 1e-9);
  }
});

test('planning uses real carry for the starting lie and keeps putt roll precise', () => {
  const practice = new Practice();
  practice.configure('iron7', () => 'rough');
  practice.beginStroke(0, 0);
  practice.moveStroke(0, .45 * .75);
  practice.releaseStroke(0, 0);
  for (let i = 0; i < 8 / STEP && practice.carry === null; i++) practice.step();

  const rough = shotRanges('iron7', 'rough')[2];
  assert.equal(rough.stock, practice.carry);
  assert.ok(rough.stock < shotRanges('iron7')[2].stock);
  const putt = shotRanges('putter', 'green')[1];
  assert.ok(putt.stock > shotRanges('putter')[1].stock);
  assert.equal(putt.snap, null);
});
