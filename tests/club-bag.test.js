import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLUBS } from '../public/src/clubs.js';
import { rangeCard } from '../public/src/range-card.js';
import { Round } from '../public/src/round.js';
import { Practice } from '../public/src/practice.js';
import { RUNES } from '../public/src/spells.js';

test('a complete bag is selectable at both the range and a course lie', () => {
  assert.equal(Object.keys(CLUBS).length, 14);
  const practice = new Practice();
  const round = new Round();
  round.prepare(practice);
  for (const [id, club] of Object.entries(CLUBS)) {
    assert.ok(club.name && club.length > .8 && club.head);
    assert.equal(round.selectClub(id, practice), true);
    assert.equal(practice.clubType, id);
  }
});

test('the 7 iron range card gives repeatable power and clean-snap yardages', () => {
  const card = rangeCard('iron7');
  assert.deepEqual(card, rangeCard('iron7'));
  assert.deepEqual(card.map(row => row.power), [25, 50, 75, 100]);
  assert.ok(card[0].stock < card[2].stock && card[2].stock < card[3].stock);
  assert.ok(card[2].snap > card[2].stock);
  assert.ok(rangeCard('iron5')[2].snap > card[2].snap);
  assert.ok(rangeCard('iron9')[2].snap < card[2].snap);
});

test('Guided locks a near miss on a marked load while Hard keeps the precise input', () => {
  const practice = new Practice();
  for (const [guided, expected] of [[true, .75], [false, .744]]) {
    practice.configure('iron7');
    practice.beginStroke(0, 0, guided);
    practice.moveStroke(0, .45 * .744);
    practice.releaseStroke(0, 0);
    assert.ok(Math.abs(practice.charge - expected) < 1e-8);
  }
});

test('full power carry tracks the chart for plain, snap, pure Star and pure Star with snap', () => {
  const star = RUNES.find(rune => rune.id === 'star');
  for (const [id, expected] of [
    ['driver', [220, 250, 280, 296]],
    ['iron7', [140, 150, 165, 185]],
    ['wedge', [100, 110, 135, 146]],
  ]) {
    const { stock, snap, spell, spellSnap } = rangeCard(id, star).at(-1);
    assert.deepEqual([stock, snap, spell, spellSnap], expected);
  }
});
