import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COURSE, surfaceAt } from '../public/src/course.js';
import { MAX_MANA, SPELL_MANA_COST } from '../public/src/mana.js';
import { Round } from '../public/src/round.js';
import { BALL_RADIUS, Practice, STEP } from '../public/src/practice.js';

test('Moonfen has 18 playable tees and pins and plays to par 71', () => {
  assert.equal(COURSE.length, 18);
  assert.deepEqual(COURSE.slice(0, 9).map(hole => hole.par), [4, 3, 4, 5, 3, 4, 3, 5, 4]);
  assert.equal(COURSE.reduce((sum, hole) => sum + hole.par, 0), 71);
  assert.equal(new Set(COURSE.map(hole => hole.name)).size, 18);
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

test('hole nine advances to the back nine and hole 18 completes the scorecard', () => {
  const round = new Round();
  const practice = new Practice();
  for (let i = 0; i < 18; i++) {
    assert.equal(round.index, i);
    const { pin } = round.hole;
    round.lie = { x: pin.x - 1, z: pin.z };
    round.prepare(practice);
    assert.equal(round.club, 'putter');
    playShot(round, practice, { putt: .23 });
    assert.equal(round.status, 'holed');
    assert.equal(round.card[i], 1);
    round.next(practice);
  }
  assert.equal(round.status, 'complete');
  assert.equal(round.card.length, 18);
  assert.equal(round.total, 18);
  assert.equal(round.toPar, -53);
});

test('a tree stops a canopy-height shot without a penalty, and a higher shot clears it', () => {
  const tree = { x: 48, z: 0, radius: 3, height: 12 };
  const hole = { ...COURSE[0], trees: [tree] };
  for (const y of [6, 13]) {
    const round = new Round([hole]);
    const practice = new Practice();
    round.prepare(practice);
    round.startShot();
    round.previous = { x: 44.8, z: 0, y };
    practice.impact = { kind: 'solid' };
    practice.ball = { ...round.localPoint({ x: 45.1, z: 0 }), y, vx: 45, vy: 0, vz: 0 };
    round.track(practice);
    assert.equal(round.strokes, 1);
    if (y > tree.height) {
      assert.equal(round.status, 'playing');
    } else {
      assert.equal(round.status, 'shot-over');
      assert.equal(round.hitTree, true);
      assert.equal(practice.ball.y, BALL_RADIUS);
      assert.equal(practice.ball.vx, 0);
      const landing = round.landing;
      round.next(practice);
      assert.deepEqual(round.lie, landing);
    }
  }
});

test('a tree drop into water uses the penalty and leaves a playable next lie', () => {
  const hole = { ...COURSE[0], hazards: [{ type: 'water', x: 43, z: 0, rx: 2, rz: 3 }],
    trees: [{ x: 48, z: 0, radius: 3, height: 12 }] };
  const round = new Round([hole]);
  const practice = new Practice();
  round.prepare(practice);
  round.startShot();
  round.previous = { x: 44.8, z: 0, y: 6 };
  practice.impact = { kind: 'solid' };
  practice.ball = { ...round.localPoint({ x: 45.1, z: 0 }), y: 6, vx: 45, vy: 0, vz: 0 };
  round.track(practice);
  assert.equal(round.notice, 'Water · +1 penalty');
  assert.equal(round.strokes, 2);
  round.next(practice);
  assert.deepEqual(round.lie, hole.tee);
});

test('mirrored doglegs reward a Guided Crescent while leaving a safe plain layup', () => {
  const routes = [['Briar Gate', 1], ['Witchwood Elbow', -1]];
  for (const [name, direction] of routes) {
    const hole = COURSE.find(item => item.name === name);
    const drive = options => {
      const round = new Round([hole]);
      const practice = new Practice();
      round.prepare(practice);
      playShot(round, practice, options);
      return round;
    };
    const layup = drive({ load: .84 });
    const straight = drive({ load: 1, snap: 'center' });
    const crescent = drive({ load: 1, spell: { type: 'crescent', purity: .95, potency: .57, direction, guided: true } });
    assert.equal(layup.hitTree, false, name);
    assert.equal(surfaceAt(hole, layup.landing), 'fairway', name);
    assert.equal(straight.hitTree, true, name);
    assert.equal(crescent.hitTree, false, name);
    assert.equal(surfaceAt(hole, crescent.landing), 'fairway', name);
    assert.ok(crescent.landing.x > straight.landing.x + 8, name);
  }
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

test('a long putt breaks across a slope and finishes short when lagged', () => {
  const round = new Round();
  const practice = new Practice();
  const { pin, green } = round.hole;
  round.lie = { x: pin.x - 12, z: pin.z };
  round.prepare(practice);
  playShot(round, practice, { putt: .66 });
  assert.equal(round.status, 'shot-over');
  assert.ok(round.landing.x < pin.x - 1);
  assert.ok((round.landing.z - pin.z) * Math.sign(green.slope.z) > .35);
});

test('Royal Flush costs 80 and holes at 90 percent even when aimed away', () => {
  for (const purity of [.899, .90]) {
    const round = new Round();
    const practice = new Practice();
    const { pin } = round.hole;
    round.lie = { x: pin.x - 12, z: pin.z };
    round.prepare(practice);
    round.setAim({ x: pin.x - 15, z: pin.z });
    const spell = { type: 'royal-flush', purity };
    assert.ok(round.putt(practice, .2, spell, spell.type));
    for (let i = 0; i < 15 / STEP && round.status === 'playing'; i++) {
      practice.step();
      round.track(practice);
    }
    assert.equal(round.mana, 20);
    assert.equal(round.strokes, 1);
    assert.equal(round.status, purity < .90 ? 'shot-over' : 'holed');
  }
});

test('Texas Wedge equips a fringe roll with less drag and cannot be cast from the green', () => {
  const runs = [false, true].map(cast => {
    const round = new Round();
    const practice = new Practice();
    const { pin, green } = round.hole;
    round.lie = { x: pin.x + green.rx + 2.5, z: pin.z };
    round.prepare(practice);
    round.selectClub('putter', practice);
    assert.equal(round.puttingRune, 'texas-wedge');
    assert.equal(round.putt(practice, .55, null, 'royal-flush'), false);
    round.mana = 39;
    assert.equal(round.putt(practice, .55, null, 'texas-wedge'), false);
    assert.equal(round.strokes, 0);
    round.mana = 100;
    const spell = cast ? { type: 'texas-wedge', purity: 1 } : null;
    assert.ok(round.putt(practice, .55, spell, cast ? spell.type : false));
    for (let i = 0; i < 15 / STEP && round.status === 'playing'; i++) {
      practice.step();
      round.track(practice);
    }
    assert.equal(round.mana, cast ? 80 : 100);
    round.next(practice);
    assert.equal(round.surface, 'green');
    assert.equal(round.putt(practice, .55, null, 'texas-wedge'), false);
    return round.remaining;
  });
  assert.ok(runs[1] + 1 < runs[0]);
});
