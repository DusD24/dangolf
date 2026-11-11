import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COURSE } from '../public/src/course.js';
import { ShotNarration } from '../public/src/narration-triggers.js';
import { BALL_RADIUS, METERS_PER_YARD, Practice, STEP } from '../public/src/practice.js';
import { Round } from '../public/src/round.js';
import { VOICE_LINES } from '../public/src/voice-lines.js';

const FT = .3048;
function setup() {
  const hole = { ...COURSE[0], pin: { x: 300, z: 0 }, trees: [], hazards: [],
    green: { x: 300, z: 0, rx: 16, rz: 16, slope: { x: 0, z: 0 } },
    fairway: [{ x: -10, z: 0, width: 25 }, { x: 350, z: 0, width: 25 }],
    bounds: { minX: -100, maxX: 400, minZ: -100, maxZ: 100 } };
  const round = new Round([hole]);
  const practice = new Practice();
  round.prepare(practice);
  return { round, practice, narration: new ShotNarration() };
}

function result(state, options = {}) {
  const { round: r, practice: p, narration: n } = state;
  const { kind = 'solid', start = { x: 0, z: 0 }, end = { x: 100, z: 0 }, spell = null,
    club = 'driver', snap = 0, attempted = Boolean(spell), tree = false, notice = '',
    holed = false, strokes = 4, mana = 100, endMana = mana, carry = 100, observe } = options;
  r.lie = start;
  r.prepare(p);
  r.selectClub(club, p);
  r.mana = mana;
  p.spell = spell;
  // Tests may start on a putting surface with a manual club choice.
  assert.ok(r.startShot(false));
  n.beginShot(r, p, attempted);
  p.impact = kind === null ? null : { kind, putt: club === 'putter', snapQuality: snap,
    stinger: spell?.type === 'spear' ? 1 : 0 };
  p.turfAt = kind === 'chunk' ? .1 : null;
  p.carry = carry;
  if (observe) observe(r, p, n);
  r.landing = holed ? r.hole.pin : end;
  r.status = holed ? 'holed' : 'shot-over';
  r.strokes = strokes;
  r.mana = endMana;
  r.hitTree = tree;
  r.notice = notice;
  Object.assign(p.ball, r.localPoint(r.landing), { y: BALL_RADIUS, vx: 0, vy: 0, vz: 0 });
  p.phase = 'result';
  const line = n.finish(r, p);
  if (line) assert.ok(Object.hasOwn(VOICE_LINES, line.id), line.id);
  assert.equal(n.finish(r, p), null, 'the same result must never narrate twice');
  return line;
}
const id = (state, options) => result(state, options)?.id ?? null;

test('chunks escalate once, alternate the third line between streaks, and reset on every nonchunk', () => {
  const state = setup();
  assert.deepEqual(result(state, { kind: 'chunk' }), { id: 'chunk-first', important: false });
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-second');
  assert.deepEqual(result(state, { kind: 'chunk' }), { id: 'chunk-dwarf', important: true });
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-later');
  assert.equal(id(state, { kind: null }), 'whiff');
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-first');
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-second');
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-delving');
  state.narration.beginRound();
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-first');
  assert.equal(id(state, {}), 'redemption');
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-first');
});

test('chunk recovery takes the common line but cannot swallow the third-chunk special', () => {
  const state = setup();
  for (const expected of ['chunk-recovery', 'chunk-recovery', 'chunk-dwarf', 'chunk-recovery']) {
    assert.equal(id(state, { kind: 'chunk', start: { x: 0, z: 30 }, end: { x: 7, z: 24 } }), expected);
  }
  assert.equal(id(state, { kind: 'chunk', end: { x: 10, z: 0 } }), 'chunk-later');
});

test('cancelling a shot preserves streaks and does not add a putt', () => {
  const state = setup();
  id(state, { kind: 'chunk' });
  state.narration.beginShot(state.round, state.practice);
  state.narration.cancelShot();
  assert.equal(state.narration.finish(state.round, state.practice), null);
  assert.equal(id(state, { kind: 'chunk' }), 'chunk-second');
  assert.equal(state.narration.holePutts, 0);
});

test('rough top uses actual travel and the inclusive sixteen-foot boundary', () => {
  const state = setup();
  const start = { x: 20, z: 30 };
  assert.equal(id(state, { kind: 'top', start, end: { x: 20 + 16 * FT, z: 30 } }), 'rough-top');
  state.narration.beginRound();
  assert.equal(id(state, { kind: 'top', start, end: { x: 20 + 16 * FT + .001, z: 30 } }), 'top');
  state.narration.beginRound();
  assert.equal(id(state, { kind: 'top', start: { x: 0, z: 0 }, end: { x: 1, z: 0 } }), 'top');
});

test('top streaks rotate all approved second and third lines and reset on any other shot', () => {
  const state = setup();
  const seconds = ['top-second-discussed', 'top-second-underside', 'top-second-mortal'];
  const thirds = ['top-third-bowling', 'top-third-putter', 'top-third-sphere'];
  for (let streak = 0; streak < 4; streak++) {
    assert.equal(id(state, { kind: 'top' }), 'top');
    assert.deepEqual(result(state, { kind: 'top' }), { id: seconds[streak % 3], important: true });
    assert.deepEqual(result(state, { kind: 'top' }), { id: thirds[streak % 3], important: true });
    assert.equal(id(state, { kind: 'top' }), 'top');
    result(state, { kind: streak % 2 ? 'chunk' : null });
  }
  state.narration.beginRound();
  id(state, { kind: 'top' });
  assert.equal(id(state, { kind: 'top' }), seconds[0]);
});

test('rough tops join the streak, cancellation preserves it, and hazards keep their own reaction', () => {
  const state = setup();
  const options = { kind: 'top', start: { x: 20, z: 30 }, end: { x: 21, z: 30 } };
  assert.equal(id(state, options), 'rough-top');
  state.narration.beginShot(state.round, state.practice);
  state.narration.cancelShot();
  assert.equal(id(state, options), 'top-second-discussed');
  assert.equal(id(state, { ...options, notice: 'Water · +1 penalty' }), 'water');
  assert.equal(id(state, options), 'rough-top');
  result(state, { club: 'putter' });
  assert.equal(id(state, options), 'rough-top');
});

test('whiff and miscast are specific; a plain clean snap and mana return are fallbacks', () => {
  const state = setup();
  assert.equal(id(state, { kind: null, attempted: true }), 'whiff');
  assert.equal(id(state, { attempted: true, snap: 1 }), 'miscast');
  assert.equal(id(state, { snap: 1 }), 'clean-snap');
  assert.equal(id(state, { snap: 1, mana: 22, endMana: 40 }), 'mana-restored');
  assert.equal(id(state, { mana: 40, endMana: 58 }), null);
  assert.equal(id(state, { mana: 21, endMana: 39 }), null);
  assert.equal(id(state, { spell: { type: 'star' }, snap: 1 }), null);
});

test('hazards suppress celebrations and tree hits distinguish consecutive hits and safe recovery', () => {
  const state = setup();
  assert.equal(id(state, { tree: true }), 'tree');
  assert.equal(id(state, { tree: true }), 'tree-again');
  assert.equal(id(state, {}), 'tree-recovery');
  assert.equal(id(state, { tree: true }), 'tree');
  assert.equal(id(state, { notice: 'Water · +1 penalty', tree: true,
    spell: { type: 'star' }, carry: 300 }), 'water');
  assert.equal(id(state, { notice: 'Out of bounds · +1 penalty', snap: 1 }), 'out');
  id(state, { kind: 'chunk' });
  assert.equal(id(state, { end: { x: 50, z: 35 } }), null, 'rough is not a solid-shot celebration');
});

test('sand and green transitions use actual starting and ending surfaces', () => {
  const state = setup();
  state.round.hole.hazards = [{ type: 'sand', x: 100, z: 0, rx: 10, rz: 10 }];
  assert.equal(id(state, {}), 'bunker');
  assert.equal(id(state, { start: { x: 100, z: 0 }, end: { x: 295, z: 0 } }), 'bunker-recovery');
  assert.equal(id(state, { start: { x: 295, z: 0 }, end: { x: 270, z: 0 } }), 'green-exit');
});

test('hole-out priority preserves ace, short chip and long hole-out over score and spells', () => {
  const state = setup();
  assert.deepEqual(result(state, { holed: true, strokes: 1, spell: { type: 'star' }, carry: 280 }),
    { id: 'ace', important: true });
  assert.equal(id(state, { start: { x: 300 - 30 * METERS_PER_YARD, z: 0 }, holed: true, strokes: 2 }), 'chip-in');
  assert.equal(id(state, { start: { x: 300 - 30 * METERS_PER_YARD - .01, z: 0 }, holed: true, strokes: 2 }), 'hole-out');
});

test('Royal success and failure use the 90 percent threshold; plain long putts start at 25 feet', () => {
  const state = setup();
  assert.deepEqual(result(state, { start: { x: 290, z: 0 }, club: 'putter', holed: true, strokes: 3,
    spell: { type: 'royal-flush', purity: .90 } }), { id: 'royal', important: true });
  assert.equal(id(state, { start: { x: 290, z: 0 }, club: 'putter', spell: { type: 'royal-flush', purity: .899 } }), 'royal-fail');
  state.narration.beginRound();
  assert.equal(id(state, { start: { x: 300 - 25 * FT, z: 0 }, club: 'putter', holed: true }), 'long-putt');
  state.narration.beginRound();
  assert.equal(id(state, { start: { x: 300 - 25 * FT + .001, z: 0 }, club: 'putter', holed: true }), 'par');
});

test('rare scores, penalty par saves and three-putts take precedence over ordinary score lines', () => {
  const state = setup();
  const short = { start: { x: 299, z: 0 }, club: 'putter', holed: true };
  state.round.hole.par = 5;
  assert.deepEqual(result(state, { ...short, strokes: 2 }), { id: 'albatross', important: true });
  state.narration.beginRound();
  assert.equal(id(state, { ...short, strokes: 3 }), 'eagle');
  state.round.hole.par = 4;
  state.narration.beginRound();
  id(state, { notice: 'Water · +1 penalty' });
  assert.equal(id(state, { ...short, strokes: 4 }), 'par-save');
  state.narration.beginRound();
  for (let i = 0; i < 2; i++) id(state, { start: { x: 299, z: 0 }, end: { x: 299, z: 0 }, club: 'putter' });
  assert.equal(id(state, { ...short, strokes: 5 }), 'three-putt');
  state.round.index = 1;
  state.round.holes.push(state.round.holes[0]);
  assert.equal(id(state, { ...short, strokes: 5 }), 'bogey', 'new hole clears putts and penalty');
});

test('birdie-or-better streak counts holes once and only celebrates the third', () => {
  const state = setup();
  const short = { start: { x: 299, z: 0 }, club: 'putter', holed: true, strokes: 3 };
  for (const [index, expected] of ['birdie', 'birdie', 'birdie-streak', 'birdie'].entries()) {
    state.round.index = index;
    state.round.holes[index] = state.round.holes[0];
    assert.equal(id(state, short), expected);
  }
  state.round.index = 4;
  state.round.holes[4] = state.round.holes[0];
  assert.equal(id(state, { ...short, strokes: 4 }), 'par');
  state.round.index = 5;
  state.round.holes[5] = state.round.holes[0];
  assert.equal(id(state, short), 'birdie');
});

test('lag and short miss have inclusive distance boundaries', () => {
  const state = setup();
  assert.equal(id(state, { club: 'putter', start: { x: 300 - 30 * FT, z: 0 }, end: { x: 300 - 3 * FT, z: 0 } }), 'lag');
  assert.equal(id(state, { club: 'putter', start: { x: 300 - 30 * FT + .001, z: 0 }, end: { x: 300 - 3 * FT, z: 0 } }), null);
  assert.equal(id(state, { club: 'putter', start: { x: 300 - 5 * FT, z: 0 }, end: { x: 300 - 2 * FT, z: 0 } }), 'short-miss');
});

function simulate({ round, practice: p, narration: n }, { spell = null, putt, drift = 0, early = false, centered = false } = {}) {
  if (putt === undefined) {
    p.beginStroke(.5, .3);
    p.moveStroke(.5, .75);
    p.moveStroke(.5 + drift, .5);
    assert.ok(p.releaseStroke(.5, .3, spell));
    if (round) assert.ok(round.startShot(spell?.type));
  } else assert.ok(round.putt(p, putt, spell, spell?.type));
  n.beginShot(round, p, Boolean(spell));
  for (let i = 0; i < 16 / STEP; i++) {
    if (early && p.phase === 'swing' && p.castAt === null) p.snap();
    if (centered && p.snapCue && p.castAt === null) p.snap();
    p.step();
    n.observe(round, p);
    if (round) {
      round.track(p);
      if (round.status !== 'playing') break;
    } else if (p.phase === 'result' && !p.ball.vx && !p.ball.vy && !p.ball.vz) break;
  }
  return n.finish(round, p);
}

test('real practice shots classify divots, clean snaps and whiffs without a Round', () => {
  const state = { round: null, practice: new Practice(), narration: new ShotNarration() };
  assert.equal(simulate(state, { early: true }).id, 'chunk-first');
  state.practice.reset();
  assert.equal(simulate(state, { centered: true }).id, 'redemption');
  state.practice.reset();
  assert.equal(simulate(state, { centered: true }).id, 'clean-snap');
  state.practice.reset();
  assert.equal(simulate(state, { drift: .22 }).id, 'whiff');
});

test('an actual fast cup-crossing putt is hot while an observed near miss without speed is ordinary', () => {
  const state = setup();
  state.round.lie = { x: 297, z: 0 };
  state.round.prepare(state.practice);
  assert.equal(simulate(state, { putt: .8 }).id, 'hot-putt');
  assert.equal(state.round.status, 'shot-over');
  assert.equal(id(setup(), { start: { x: 290, z: 0 }, end: { x: 305, z: 0 }, club: 'putter' }), null,
    'a settled endpoint alone cannot prove a fast pass');
});

test('Star needs at least 260 yards carry and a safe solid landing', () => {
  const state = setup();
  const spell = { type: 'star', purity: 1, potency: 1 };
  assert.equal(id(state, { spell, carry: 260 * METERS_PER_YARD }), 'star');
  assert.equal(id(state, { spell, carry: 260 * METERS_PER_YARD - .001 }), null);
  assert.equal(id(state, { spell, carry: 300, end: { x: 100, z: 30 } }), null);
  state.practice.reset();
  state.round.prepare(state.practice);
  assert.equal(simulate(state, { spell }).id, 'star');
});

test('Crescent celebrates actual mirrored dogleg routes and never a straight fairway', () => {
  for (const [name, direction] of [['Briar Gate', 1], ['Witchwood Elbow', -1]]) {
    const round = new Round([COURSE.find(hole => hole.name === name)]);
    const practice = new Practice();
    round.prepare(practice);
    assert.equal(simulate({ round, practice, narration: new ShotNarration() },
      { spell: { type: 'crescent', purity: .95, potency: .57, direction, guided: true } })?.id, 'crescent', name);
  }
  const state = setup();
  assert.equal(simulate(state, { spell: { type: 'crescent', purity: 1, potency: .57, direction: 1 } }), null);
});

test('Spear requires an observed actual narrow gap rather than just a successful spell', () => {
  const spell = { type: 'spear', purity: 1, potency: 1 };
  assert.equal(simulate(setup(), { spell }), null);
  const state = setup();
  state.round.hole.hazards = [-1, 1].map(side => ({ type: 'sand', x: 90, z: 8 * side, rx: 12, rz: 5 }));
  assert.equal(simulate(state, { spell })?.id, 'spear');
  const oneSided = setup();
  oneSided.round.hole.hazards = [{ type: 'sand', x: 90, z: 8, rx: 12, rz: 5 }];
  assert.equal(simulate(oneSided, { spell }), null);
});

test('Texas Wedge celebrates reaching the green in the actual simulation', () => {
  const state = setup();
  state.round.lie = { x: 281, z: 0 };
  state.round.prepare(state.practice);
  state.round.selectClub('putter', state.practice);
  assert.equal(simulate(state, { putt: .55, spell: { type: 'texas-wedge', purity: 1 } })?.id, 'texas');
});
