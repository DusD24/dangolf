import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COURSE, surfaceAt } from '../public/src/course.js';
import { Round } from '../public/src/round.js';
import { BALL_RADIUS, Practice, STEP } from '../public/src/practice.js';

test('Moonfen has nine playable tees and pins with the approved par mix', () => {
  assert.equal(COURSE.length, 9);
  assert.deepEqual(COURSE.map(hole => hole.par).sort(), [3, 3, 3, 4, 4, 4, 4, 5, 5]);
  assert.equal(new Set(COURSE.map(hole => hole.name)).size, 9);
  for (const hole of COURSE) {
    assert.equal(surfaceAt(hole, hole.tee), 'fairway');
    assert.equal(surfaceAt(hole, hole.pin), 'green');
    assert.ok(hole.yards >= 100);
  }
});

function playShot(round, practice, { putt, load = 0.85 } = {}) {
  if (putt !== undefined) practice.putt(putt);
  else {
    practice.beginStroke(.5, .3);
    practice.moveStroke(.5, .3 + .45 * load);
    assert.ok(practice.releaseStroke(.5, .3));
  }
  assert.ok(round.startShot());
  for (let i = 0; i < 15 / STEP && round.status === 'playing'; i++) {
    practice.step();
    round.track(practice);
  }
  assert.notEqual(round.status, 'playing');
}

test('the next swing starts from the settled lie and keeps the stroke count', () => {
  const round = new Round();
  const practice = new Practice();
  round.prepare(practice);
  playShot(round, practice);
  assert.equal(round.status, 'shot-over');
  const rest = round.worldPoint(practice.ball);
  assert.ok(rest.x > 5);
  assert.equal(round.strokes, 1);
  round.next(practice);
  assert.deepEqual(round.lie, rest);
  assert.equal(round.strokes, 1);
  assert.equal(round.status, 'ready');
  assert.equal(practice.distance, 0);
});

test('a splash costs one penalty and the next shot plays from the prior lie', () => {
  const hole = COURSE.find(item => item.hazards.some(hazard => hazard.type === 'water'));
  const round = new Round([hole]);
  const practice = new Practice();
  round.prepare(practice);
  const original = { ...round.lie };
  const water = hole.hazards.find(hazard => hazard.type === 'water');
  round.setAim(water);
  round.startShot();
  practice.ball = { ...round.localPoint(water), y: 3, vx: 0, vy: 0, vz: 0 };
  round.track(practice);
  assert.equal(round.status, 'playing');
  assert.equal(round.strokes, 1);
  practice.ball.y = BALL_RADIUS;
  round.track(practice);
  assert.equal(round.notice, 'Water · +1 penalty');
  assert.equal(round.strokes, 2);
  round.next(practice);
  assert.deepEqual(round.lie, original);
});

test('all nine putts can be holed and the scorecard closes at nine entries', () => {
  const round = new Round();
  const practice = new Practice();
  for (let i = 0; i < 9; i++) {
    assert.equal(round.index, i);
    const { pin } = round.hole;
    round.lie = { x: pin.x - 3, z: pin.z };
    round.prepare(practice);
    assert.equal(round.club, 'putter');
    playShot(round, practice, { putt: 0.37 });
    assert.equal(round.status, 'holed');
    assert.equal(round.card[i], 1);
    round.next(practice);
  }
  assert.equal(round.status, 'complete');
  assert.equal(round.card.length, 9);
  assert.equal(round.total, 9);
  assert.equal(round.toPar, -26);
});

test('a putt that crosses the cup too fast stays in play', () => {
  const round = new Round();
  const practice = new Practice();
  round.lie = { x: round.hole.pin.x - 3, z: round.hole.pin.z };
  round.prepare(practice);
  playShot(round, practice, { putt: 0.80 });
  assert.equal(round.status, 'shot-over');
  assert.equal(round.card.length, 0);
  assert.ok(round.landing.x > round.hole.pin.x);
});
