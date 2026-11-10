import assert from 'node:assert/strict';
import { test } from 'node:test';
import { METERS_PER_YARD, Practice, STEP } from '../public/src/practice.js';

function startSwing(practice, depth = 0.44, drift = 0) {
  practice.beginStroke(0.5, 0.3);
  practice.moveStroke(0.5, 0.3 + depth);
  practice.moveStroke(0.5 + drift, 0.3 + depth / 2);
  return practice.releaseStroke(0.5, 0.3);
}

function simulate(practice, seconds) {
  for (let step = 0; step < Math.round(seconds / STEP); step++) practice.step();
}

test('a tap and an unfinished return stroke leave the ball ready', () => {
  const practice = new Practice();
  practice.beginStroke(0.5, 0.3);
  assert.equal(practice.releaseStroke(0.5, 0.3), false);
  practice.beginStroke(0.5, 0.3);
  practice.moveStroke(0.5, 0.6);
  assert.equal(practice.releaseStroke(0.5, 0.55), false);
  assert.equal(practice.phase, 'ready');
});

test('a short straight stroke rolls the ball without a snap', () => {
  const practice = new Practice();
  const start = practice.ball.x;
  assert.ok(startSwing(practice, 0.10));
  assert.equal(practice.ball.x, start);
  simulate(practice, 1.5);
  assert.ok(practice.impact);
  assert.ok(practice.ball.x > start + 0.25);
});

test('a longer pull produces a faster square strike', () => {
  const short = new Practice();
  const long = new Practice();
  startSwing(short, 0.10);
  startSwing(long, 0.44);
  simulate(short, 1);
  simulate(long, 1);
  assert.ok(long.impact.speed > short.impact.speed * 1.25);
});

test('small drift is forgiven while a bent swipe sends the ball off line', () => {
  const slight = new Practice();
  const bent = new Practice();
  startSwing(slight, 0.44, 0.013);
  startSwing(bent, 0.44, 0.075);
  simulate(slight, 1.5);
  simulate(bent, 1.5);
  assert.ok(slight.impact);
  assert.ok(Math.abs(slight.ball.z) < 0.08);
  assert.ok(bent.impact);
  assert.ok(Math.abs(bent.ball.z) > 0.2);
});

test('a badly crooked swipe can miss without moving the ball', () => {
  const practice = new Practice();
  const start = { ...practice.ball };
  startSwing(practice, 0.44, 0.22);
  simulate(practice, 1.4);
  assert.equal(practice.impact, null);
  assert.equal(practice.ball.x, start.x);
  assert.equal(practice.ball.z, start.z);
  assert.equal(practice.phase, 'result');
});

test('centered contact adds a modest carry bonus and lift', () => {
  const plain = new Practice();
  const centered = new Practice();
  startSwing(plain, .45);
  startSwing(centered, .45);
  while (!centered.contact) centered.step();
  assert.ok(centered.snapCue);
  assert.equal(centered.impact, null);
  assert.ok(centered.snap());
  assert.equal(centered.snap(), false);
  simulate(plain, 8);
  simulate(centered, 8);
  assert.equal(centered.impact.snapQuality, 1);
  assert.ok(centered.carry > plain.carry * 1.10 && centered.carry < plain.carry * 1.18);
  assert.ok(centered.impact.launchY > plain.impact.launchY);
});

test('a chunk pops up and rough gives it more escape distance than fairway', () => {
  const results = ['fairway', 'rough'].map(surface => {
    const practice = new Practice();
    practice.configure('driver', () => surface);
    startSwing(practice, .45);
    simulate(practice, .15);
    assert.ok(practice.snap());
    let peak = 0;
    for (let step = 0; step < 8 / STEP; step++) {
      practice.step();
      peak = Math.max(peak, practice.ball.y);
    }
    assert.equal(practice.impact.kind, 'chunk');
    assert.ok(practice.turfAt !== null);
    assert.ok(peak > 2);
    return practice.distance / METERS_PER_YARD;
  });
  assert.ok(results[0] >= 2 && results[0] <= 5);
  assert.ok(results[1] > results[0] * 2 && results[1] < 13);
});

test('a near snap keeps stock carry, while a top rolls on fairway and dies in rough', () => {
  function tapAfterContact(surface, delay) {
    const practice = new Practice();
    practice.configure('driver', () => surface);
    startSwing(practice, .45);
    while (!practice.contact) practice.step();
    simulate(practice, delay);
    assert.ok(practice.snap());
    simulate(practice, 8);
    return practice;
  }
  const near = tapAfterContact('fairway', 5 * STEP);
  assert.equal(near.castLabel, 'Near snap');
  assert.ok(near.carry / METERS_PER_YARD >= 180 && near.carry / METERS_PER_YARD <= 220);
  const fairway = tapAfterContact('fairway', 10 * STEP);
  const rough = tapAfterContact('rough', 10 * STEP);
  for (const shot of [fairway, rough]) {
    assert.equal(shot.impact.kind, 'top');
    assert.equal(shot.impact.launchY, 0);
    assert.equal(shot.carry, 0);
  }
  assert.ok(fairway.distance / METERS_PER_YARD > 60);
  assert.ok(rough.distance / .3048 >= 10 && rough.distance / .3048 <= 15);
});

test('a tap after the contact window cannot alter a launched shot', () => {
  const baseline = new Practice();
  const cast = new Practice();
  startSwing(baseline);
  startSwing(cast);
  while (!cast.impact) {
    cast.step();
    baseline.step();
  }
  assert.equal(cast.snap(), false);
  simulate(cast, 1.5);
  simulate(baseline, 1.5);
  assert.deepEqual(cast.ball, baseline.ball);
});

test('cancelling and resetting make a fresh attempt immediately possible', () => {
  const practice = new Practice();
  practice.beginStroke(0.5, 0.3);
  practice.moveStroke(0.5, 0.6);
  practice.cancelStroke();
  assert.equal(practice.releaseStroke(0.5, 0.3), false);
  assert.ok(startSwing(practice));
  simulate(practice, 1.3);
  assert.ok(practice.impact);
  practice.reset();
  assert.equal(practice.phase, 'ready');
  assert.equal(practice.impact, null);
  assert.ok(startSwing(practice));
});

test('the best straight snap timing is inside the visible cue', () => {
  for (const depth of [0.056, 0.10, 0.44]) {
    let best;
    for (let tapStep = 0; tapStep < 70; tapStep++) {
      const practice = new Practice();
      assert.ok(startSwing(practice, depth));
      simulate(practice, tapStep * STEP);
      const atCue = practice.snapCue;
      practice.snap();
      simulate(practice, 8);
      if (!best || practice.distance > best.distance) {
        best = { atCue, distance: practice.distance, tapStep };
      }
    }
    assert.ok(best.atCue, 'Longest shot should follow the cue at pull depth ' +
      depth + '. Best cast was at step ' + best.tapStep);
  }
});

test('the glint waits for the contact window on a bent return', () => {
  const practice = new Practice();
  startSwing(practice, .225, .085);
  for (let i = 0; i < 120 && !practice.snapCue; i++) practice.step();
  assert.ok(practice.snapCue);
  assert.ok(practice.snap());
  simulate(practice, 1);
  assert.equal(practice.impact?.snapQuality, 1);
});

test('an early snap at the start of a shallow stroke weakens contact', () => {
  const early = new Practice();
  const plain = new Practice();
  startSwing(early, 0.056);
  startSwing(plain, 0.056);
  simulate(early, 0.09);
  assert.ok(early.snap());
  simulate(early, 8);
  simulate(plain, 8);
  assert.ok(early.turfAt !== null);
  assert.ok(early.distance < plain.distance);
});

test('a pull past the old power cap still loads more power', () => {
  const practice = new Practice();
  practice.beginStroke(0.5, 0.2);
  practice.moveStroke(0.5, 0.48);
  const oldCap = practice.charge;
  practice.moveStroke(0.5, 0.60);
  const deeperPull = practice.charge;
  assert.ok(oldCap < deeperPull);
  assert.ok(deeperPull < 1);
  practice.moveStroke(0.5, 0.65);
  assert.ok(practice.releaseStroke(0.5, 0.2));
  assert.ok(practice.charge >= 0.99);
});
