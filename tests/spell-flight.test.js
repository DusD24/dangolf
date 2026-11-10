import assert from 'node:assert/strict';
import { test } from 'node:test';
import { METERS_PER_YARD, Practice, STEP } from '../public/src/practice.js';

function arm(type, { potency = 1, direction = 1, bend = 0 } = {}) {
  const p = new Practice();
  p.beginStroke(.5, .2);
  p.moveStroke(.5, .65);
  p.moveStroke(.5 + bend, .43);
  assert.ok(p.releaseStroke(.5, .2, { type, potency, direction, purity: 1 }));
  return p;
}

function finish(p) {
  for (let i = 0; i < 10 / STEP; i++) p.step();
}

test('a pure full-load rune reaches driver carry from release alone', () => {
  const p = arm('crescent');
  assert.equal(p.impact, null);
  finish(p);
  const yards = p.carry / METERS_PER_YARD;
  assert.ok(yards >= 235 && yards <= 255, 'Carry was ' + yards + ' yd');
  assert.ok(p.ball.z > 10);
});

test('mirrored crescents start square and bend in opposite directions during flight', () => {
  const left = arm('crescent', { direction: -1 });
  const right = arm('crescent');
  while (!left.impact) left.step();
  while (!right.impact) right.step();
  assert.ok(Math.abs(left.ball.z) < 0.01);
  assert.ok(Math.abs(right.ball.z) < 0.01);
  finish(left);
  finish(right);
  assert.ok(left.ball.z < -10);
  assert.ok(Math.abs(left.ball.z + right.ball.z) < 0.1);
});

test('Spear carries lower and rolls farther after landing', () => {
  const spear = arm('spear');
  const neutral = arm('star', { potency: 0 });
  finish(spear);
  finish(neutral);
  assert.ok(spear.impact.launchY < neutral.impact.launchY * 0.6);
  assert.ok(spear.distance - spear.carry > neutral.distance - neutral.carry);
});

test('the Hard and Guided star multiply the same launch energy by 125% and 115%', () => {
  const energies = [0, .6, 1].map(potency => {
    const p = arm('star', { potency });
    for (let i = 0; i < 100 && !p.impact; i++) p.step();
    assert.ok(p.impact);
    return p.ball.vx ** 2;
  });
  assert.ok(Math.abs(energies[1] / energies[0] - 1.15) < 0.001);
  assert.ok(Math.abs(energies[2] / energies[0] - 1.25) < 0.001);
});

test('a well-timed snap boosts a rune and an early tap preserves its release', () => {
  const plain = arm('star');
  const early = arm('star');
  const clean = arm('star');
  assert.ok(early.snap());
  for (let i = 0; i < 100 && !clean.snapCue; i++) clean.step();
  assert.ok(clean.snapCue && clean.snap());
  finish(plain);
  finish(early);
  finish(clean);
  assert.equal(early.carry, plain.carry);
  assert.ok(clean.carry > plain.carry);
  assert.ok(clean.impact.snapEnergy > 1 && clean.impact.snapEnergy <= 1.1);
});

test('a recognized rune can still miss without moving the ball', () => {
  const p = arm('star', { bend: 0.22 });
  finish(p);
  assert.equal(p.impact, null);
  assert.equal(p.distance, 0);
});
