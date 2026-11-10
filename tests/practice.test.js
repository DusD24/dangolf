import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Practice, STEP } from '../public/src/practice.js';

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

test('casting at the club cue adds real strike speed and lift', () => {
  const baseline = new Practice();
  const cast = new Practice();
  startSwing(baseline);
  startSwing(cast);
  for (let i = 0; i < 120 && !cast.snapCue; i++) cast.step();
  assert.ok(cast.snapCue);
  assert.equal(cast.impact, null);
  assert.ok(cast.snap());
  assert.equal(cast.snap(), false);
  simulate(baseline, 1.5);
  simulate(cast, 1.5);
  assert.ok(cast.impact.speed > baseline.impact.speed * 1.35);
  assert.ok(cast.impact.launchY > baseline.impact.launchY);
});

test('an early snap can dig into the turf and spoil the strike', () => {
  const early = new Practice();
  const clean = new Practice();
  startSwing(early);
  startSwing(clean);
  simulate(early, 0.09);
  assert.ok(early.snap());
  simulate(early, 1.4);
  simulate(clean, 1.4);
  assert.ok(early.turfAt !== null);
  assert.ok(!early.impact || early.impact.speed < clean.impact.speed);
});

test('a snap after contact leaves the launched ball on the same path', () => {
  const baseline = new Practice();
  const cast = new Practice();
  startSwing(baseline);
  startSwing(cast);
  for (let i = 0; i < 120 && !cast.impact; i++) {
    cast.step();
    baseline.step();
  }
  assert.ok(cast.impact);
  assert.ok(cast.snap());
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
      assert.ok(practice.snap());
      simulate(practice, 8);
      if (!best || practice.distance > best.distance) {
        best = { atCue, distance: practice.distance, tapStep };
      }
    }
    assert.ok(best.atCue, 'Longest shot should follow the cue at pull depth ' +
      depth + '. Best cast was at step ' + best.tapStep);
  }
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

test('a full straight clean snap carries driver distance before rolling out', () => {
  const plain = new Practice();
  const clean = new Practice();
  startSwing(plain, 0.45);
  startSwing(clean, 0.45);
  simulate(clean, 38 * STEP);
  assert.ok(clean.snapCue);
  assert.ok(clean.snap());

  simulate(plain, 10);
  simulate(clean, 10);
  const carryYards = clean.carry / 0.9144;
  const totalYards = clean.distance / 0.9144;
  assert.ok(carryYards >= 235 && carryYards <= 265, 'Carry was ' + carryYards + ' yd');
  assert.ok(totalYards > carryYards && totalYards < carryYards + 40, 'Total was ' + totalYards + ' yd');
  assert.ok(plain.carry < clean.carry * 0.55);
});
