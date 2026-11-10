import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COURSE, surfaceAt } from '../public/src/course.js';
import { MAX_MANA, SPELL_MANA_COST } from '../public/src/mana.js';
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

function playShot(round, practice, { putt, load = 0.85, spell = null, attempted = Boolean(spell), snap } = {}) {
  if (putt !== undefined) practice.putt(putt);
  else {
    practice.beginStroke(.5, .3);
    practice.moveStroke(.5, .3 + .45 * load);
    assert.ok(practice.releaseStroke(.5, .3, spell));
  }
  assert.ok(round.startShot(attempted));
  for (let i = 0; i < 15 / STEP && round.status === 'playing'; i++) {
    if (practice.castAt === null && ((snap === 'center' && practice.contact && practice.snapCue) ||
        (snap === 'early' && practice.elapsed > .15))) practice.snap();
    practice.step();
    round.track(practice);
  }
  assert.notEqual(round.status, 'playing');
}

test('all three spells spend the same mana and two 80% casts block another', () => {
  for (const type of ['star', 'crescent', 'spear']) {
    const round = new Round();
    const practice = new Practice();
    round.prepare(practice);
    for (let i = 1; i <= 2; i++) {
      playShot(round, practice, { load: .35, spell: { type, purity: .80, potency: .80, direction: 1 } });
      assert.equal(round.mana, MAX_MANA - i * SPELL_MANA_COST);
      round.next(practice);
    }
    assert.equal(round.canCast(), false);
    assert.equal(round.startShot(true), false);
    assert.equal(round.strokes, 2);
    playShot(round, practice, { load: .35, snap: 'center' });
    assert.equal(round.mana, 38);
    round.next(practice);
    playShot(round, practice, { load: .35 });
    assert.equal(round.canCast(), true);
  }
});

test('pure spells recover the same mana, while chunks and miscasts spend the full cost', () => {
  const play = (type, snap, attempted = true) => {
    const round = new Round();
    const practice = new Practice();
    round.prepare(practice);
    const spell = type ? { type, purity: 1, potency: 1, direction: 1 } : null;
    playShot(round, practice, { load: .35, spell, attempted, snap });
    const mana = round.mana;
    round.track(practice);
    assert.equal(round.mana, mana);
    return mana;
  };
  for (const type of ['star', 'crescent', 'spear']) {
    assert.equal(play(type), 80);
    assert.equal(play(type, 'center'), 90);
    assert.equal(play(type, 'early'), 60);
  }
  assert.equal(play(null), 60);
});

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
