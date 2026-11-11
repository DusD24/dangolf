import assert from 'node:assert/strict';
import { test } from 'node:test';
import { surfaceAt } from '../public/src/course.js';
import { MAX_MANA } from '../public/src/mana.js';
import { BALL_RADIUS, METERS_PER_YARD, Practice, STEP } from '../public/src/practice.js';
import { PracticeRange } from '../public/src/practice-range.js';
import { Round } from '../public/src/round.js';

function setup(mode = 'driving') {
  const range = new PracticeRange();
  const practice = new Practice();
  range.setMode(mode, practice);
  return { range, practice };
}

function settle(range, practice) {
  for (let i = 0; i < 25 / STEP && range.status === 'playing'; i++) {
    practice.step();
    range.track(practice);
  }
  assert.notEqual(range.status, 'playing');
}

function swing(range, practice, spell = null) {
  assert.ok(practice.beginStroke(.5, .3));
  practice.moveStroke(.5, .3 + .45 * .7);
  assert.ok(practice.releaseStroke(.5, .3, spell));
  assert.ok(range.startShot(spell?.type));
  settle(range, practice);
}

test('range provides six staggered targets in a broad course-shaped field', () => {
  const { range } = setup();
  assert.ok(range instanceof Round);
  assert.equal(range.isPractice, true);
  assert.equal(range.mode, 'driving');
  assert.equal(range.club, 'driver');
  assert.deepEqual(range.targets.map(target => target.yards), [50, 100, 150, 200, 250, 300]);
  assert.ok(range.targets.some(target => target.z < 0));
  assert.ok(range.targets.some(target => target.z > 0));
  for (const target of range.targets) {
    assert.equal(target.x, target.yards * METERS_PER_YARD);
    assert.equal(surfaceAt(range.hole, target), 'green');
  }
  assert.ok(range.hole.trees.length > 30);
  assert.ok(range.hole.bounds.maxZ >= 220 * METERS_PER_YARD);
  assert.ok(range.hole.fairway.at(-2).width >= 140 * METERS_PER_YARD);
  assert.equal(range.surface, 'fairway');
});

test('a real shot rotates with aim and a fresh ball preserves its club and aim', () => {
  const { range, practice } = setup();
  range.selectClub('iron8', practice);
  range.setAim({ x: 100, z: -35 });
  const aim = range.aim;
  swing(range, practice);
  assert.ok(range.lastShot.point.x > 10);
  assert.ok(range.lastShot.point.z < -5);
  const history = [...range.history];
  range.restart(practice);
  assert.equal(range.club, 'iron8');
  assert.equal(practice.clubType, 'iron8');
  assert.equal(range.aim, aim);
  assert.deepEqual(range.lie, range.hole.tee);
  assert.deepEqual(range.history, history);
  assert.equal(range.notice, '');
  assert.equal(range.landing, null);
  assert.equal(range.strokes, 0);
  assert.equal(range.mana, MAX_MANA);
  assert.equal(practice.distance, 0);
});

test('targets update the pin and aim without changing the selected club', () => {
  const { range, practice } = setup();
  range.selectClub('hybrid4', practice);
  assert.ok(range.selectTarget('150', practice));
  assert.equal(range.selectedTarget.yards, 150);
  assert.deepEqual(range.hole.pin, { x: range.selectedTarget.x, z: range.selectedTarget.z });
  assert.equal(range.club, 'hybrid4');
  assert.equal(range.hole.green.x, range.selectedTarget.x);
  assert.equal(range.aim, Math.atan2(range.selectedTarget.z, range.selectedTarget.x));
  assert.equal(range.selectTarget('missing', practice), false);
  assert.ok(range.startShot());
  assert.equal(range.selectTarget('200', practice), false);
});

test('stations initialize their terrain and remember separately selected clubs', () => {
  const { range, practice } = setup();
  range.selectClub('wood5', practice);
  assert.ok(range.setMode('rough', practice));
  assert.equal(range.surface, 'rough');
  assert.equal(range.club, 'iron7');
  range.selectClub('iron9', practice);
  assert.ok(range.setMode('sand', practice));
  assert.equal(range.surface, 'sand');
  assert.equal(range.club, 'sand');
  range.setMode('driving', practice);
  assert.equal(range.club, 'wood5');
  range.setMode('rough', practice);
  assert.equal(range.club, 'iron9');
  assert.equal(range.setMode('unknown', practice), false);
});

test('aim nudges use station-specific increments and stop at the full-shot limits', () => {
  const { range, practice } = setup();
  range.setAim({ x: 100, z: 0 });
  assert.ok(range.nudgeAim(1));
  assert.ok(Math.abs(range.aim - Math.PI / 180) < 1e-10);
  for (let i = 0; i < 100; i++) range.nudgeAim(1);
  assert.ok(Math.abs(range.aim - 35 * Math.PI / 180) < 1e-10);
  range.setMode('putting', practice);
  const prior = range.aim;
  range.nudgeAim(-1);
  assert.ok(Math.abs(range.aim - prior + .5 * Math.PI / 180) < 1e-10);
  assert.equal(range.selectTarget('100', practice), false);
  range.startShot();
  assert.equal(range.nudgeAim(1), false);
});

test('all full-shot spells use the real physics without consuming practice mana', () => {
  const { range, practice } = setup();
  for (const type of ['star', 'crescent', 'spear']) {
    const spell = { type, purity: .96, potency: .8, direction: 1 };
    swing(range, practice, spell);
    assert.equal(range.mana, MAX_MANA);
    assert.equal(range.lastShot.spell, type);
    assert.equal(range.lastShot.purity, .96);
    assert.ok(range.lastShot.carry > 10);
    assert.equal(range.canCast('royal-flush'), true);
    range.restart(practice);
  }
});

test('Royal Flush captures the actual cup without adding scorecard progress', () => {
  const { range, practice } = setup('putting');
  assert.equal(range.club, 'putter');
  assert.equal(range.surface, 'green');
  assert.equal(range.remaining, 9);
  assert.equal(range.puttingRune, 'royal-flush');
  range.setAim({ x: range.lie.x, z: range.lie.z + 8 });
  const spell = { type: 'royal-flush', purity: .95 };
  assert.ok(range.putt(practice, .3, spell, spell.type));
  settle(range, practice);
  assert.equal(range.status, 'holed');
  assert.deepEqual(range.landing, range.hole.pin);
  assert.equal(range.mana, MAX_MANA);
  assert.equal(range.lastShot.error, 0);
  assert.deepEqual(range.card, []);
  assert.equal(range.total, 0);
  assert.equal(range.toPar, 0);
  assert.equal(range.strokes, 0);
  range.next(practice);
  assert.equal(range.status, 'ready');
  assert.equal(range.remaining, 9);
});

test('the fringe station has a real Texas Wedge lie and powered rolls travel farther', () => {
  const results = [false, true].map(cast => {
    const { range, practice } = setup('fringe');
    assert.equal(range.club, 'putter');
    assert.equal(range.surface, 'rough');
    assert.equal(range.puttingRune, 'texas-wedge');
    const spell = cast ? { type: 'texas-wedge', purity: 1 } : null;
    assert.ok(range.putt(practice, .65, spell, spell?.type));
    settle(range, practice);
    assert.equal(range.mana, MAX_MANA);
    return range.lastShot.total;
  });
  assert.ok(results[1] > results[0] + 1);
});

test('settled history retains only eight shots and cannot double-record a result', () => {
  const { range, practice } = setup();
  assert.equal(range.lastShot, null);
  range.endShot(practice, range.lie);
  assert.equal(range.history.length, 0);
  for (let i = 0; i < 10; i++) {
    swing(range, practice);
    const count = range.history.length;
    range.track(practice);
    range.endShot(practice, range.landing);
    assert.equal(range.history.length, count);
    range.restart(practice);
  }
  assert.equal(range.history.length, 8);
  const shot = range.lastShot;
  assert.equal(shot.mode, 'driving');
  assert.equal(shot.club, 'driver');
  assert.equal(shot.power, .7);
  assert.equal(shot.spell, null);
  assert.equal(shot.snap, false);
  assert.ok(shot.total >= shot.carry);
  assert.equal(shot.error, Math.hypot(shot.point.x - shot.target.x, shot.point.z - shot.target.z));
});
