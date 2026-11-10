import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shotCue } from '../public/src/audio.js';
import { Practice } from '../public/src/practice.js';

const attempt = {
  phase: 'swing', club: { x: 0 }, impact: null, turfAt: null, steer: 0, castLabel: '', spell: null,
};

test('a clean hit gets the driver crack and a max star adds the blast and rune layer', () => {
  const impact = { at: .4, spellEnergy: 1.25 };
  assert.deepEqual(shotCue({ ...attempt, impact, castLabel: 'Clean snap' }),
    { base: 'pure', rune: null, success: true, blast: false });
  const spell = { type: 'star', purity: 1 };
  assert.deepEqual(shotCue({ ...attempt, impact, spell }),
    { base: 'pure', rune: 'star', success: true, blast: true });
  assert.equal(shotCue({ ...attempt, impact: { at: .4, spellEnergy: 1.15 }, spell }).blast, false);
});

test('recognized runes use their own success and failure layers on all base outcomes', () => {
  for (const type of ['crescent', 'sword', 'star']) {
    const spell = { type, purity: .95 };
    assert.deepEqual(shotCue({ ...attempt, phase: 'result', spell }),
      { base: 'whiff', rune: type, success: false, blast: false });
    assert.deepEqual(shotCue({ ...attempt, spell, turfAt: .3, impact: { at: .35, spellEnergy: 1.25 } }),
      { base: 'turf', rune: type, success: false, blast: false });
    assert.deepEqual(shotCue({ ...attempt, spell, impact: { at: .35, spellEnergy: 1 } }),
      { base: 'pure', rune: type, success: true, blast: false });
  }
});

test('no sound starts at address or on the backswing, and a miss can sound on the pass', () => {
  assert.equal(shotCue({ ...attempt, phase: 'ready', club: { x: .5 } }), null);
  assert.equal(shotCue(attempt), null);
  assert.equal(shotCue({ ...attempt, club: { x: .5 } }).base, 'whiff');
});

test('real crooked swings can produce either a clean whiff or a turf chunk', () => {
  for (const [drift, outcome] of [[.10, 'whiff'], [.22, 'turf']]) {
    const practice = new Practice();
    practice.beginStroke(.5, .3);
    practice.moveStroke(.5, .75);
    practice.moveStroke(.5 + drift, .52);
    practice.releaseStroke(.5, .3, { type: 'star', purity: 1, potency: 1 });
    for (let i = 0; i < 140; i++) practice.step();
    assert.equal(practice.impact, null);
    assert.deepEqual(shotCue(practice), { base: outcome, rune: 'star', success: false, blast: false });
  }
});

test('clean 90% Guided contact adds a celebration without upgrading a turf strike', () => {
  for (const [purity, celebrate] of [[.89, false], [.90, true], [.96, true]]) {
    const practice = new Practice();
    practice.beginStroke(.5, .3);
    practice.moveStroke(.5, .75);
    practice.releaseStroke(.5, .3, { type: 'star', purity, potency: purity * .6, guided: true });
    for (let step = 0; step < 100 && !practice.impact; step++) practice.step();
    assert.equal(Boolean(shotCue(practice).celebrate), celebrate);
    practice.turfAt = practice.impact.at;
    assert.equal(shotCue(practice).base, 'turf');
    assert.equal(Boolean(shotCue(practice).celebrate), false);
  }
});
