import { FULL_PULL, METERS_PER_YARD, Practice, STEP } from './practice.js';

export const POWER_MARKS = [25, 50, 75, 100];
export const PREVIEW_PURITY = .95;
const ranges = new Map();

function simulate(club, power, snap, surface, spell = null) {
  const practice = new Practice();
  practice.configure(club, () => surface);
  if (club === 'putter') {
    practice.putt(power / 100);
  } else {
    practice.beginStroke(0, 0, spell?.guided);
    practice.moveStroke(0, FULL_PULL * power / 100);
    practice.releaseStroke(0, 0, spell);
  }
  for (let step = 0; step < 12 / STEP; step++) {
    if (snap && practice.contact && practice.snapCue) practice.snap();
    practice.step();
    if (practice.carry !== null) break;
    const { vx, vy, vz } = practice.ball;
    if (practice.phase === 'result' && !vx && !vy && !vz) break;
  }
  return {
    distance: practice.carry ?? practice.distance,
    landing: { x: practice.ball.x, z: practice.ball.z },
  };
}

export function shotRanges(club, surface = 'fairway', rune = null, mode = 'hard') {
  const putting = club === 'putter';
  const spell = !putting && rune ? { ...rune, purity: PREVIEW_PURITY, guided: mode === 'guided',
    potency: PREVIEW_PURITY * (mode === 'guided' ? .6 : 1) } : null;
  const key = [club, surface, spell?.id, spell?.guided].join('/');
  if (!ranges.has(key)) {
    ranges.set(key, POWER_MARKS.map(power => {
      const stock = simulate(club, power, false, surface).distance;
      const snap = putting ? null : simulate(club, power, true, surface).distance;
      if (!spell) return { power, stock, snap };
      const pure = simulate(club, power, false, surface, spell);
      const pureSnap = simulate(club, power, true, surface, spell);
      return {
        power, stock, snap, spell: pure.distance, spellSnap: pureSnap.distance,
        spellLanding: pure.landing, spellSnapLanding: pureSnap.landing,
      };
    }));
  }
  return ranges.get(key);
}

export function rangeCard(club, rune, mode) {
  const yards = meters => Math.round(meters / METERS_PER_YARD);
  return shotRanges(club, 'fairway', rune, mode).map(({ power, stock, snap, spell, spellSnap }) => ({
    power, stock: yards(stock), snap: snap === null ? null : yards(snap),
    ...(spell === undefined ? {} : { spell: yards(spell), spellSnap: yards(spellSnap) }),
  }));
}
