import { FULL_PULL, METERS_PER_YARD, Practice, STEP } from './practice.js';

export const POWER_MARKS = [25, 50, 75, 100];
const ranges = new Map();
const cards = new Map();

function carry(club, power, snap, surface) {
  const practice = new Practice();
  practice.configure(club, () => surface);
  if (club === 'putter') {
    practice.putt(power / 100);
  } else {
    practice.beginStroke(0, 0);
    practice.moveStroke(0, FULL_PULL * power / 100);
    practice.releaseStroke(0, 0);
  }
  for (let step = 0; step < 12 / STEP; step++) {
    if (snap && practice.snapCue && practice.approachTime <= .055) practice.snap();
    practice.step();
    const { vx, vy, vz } = practice.ball;
    if (practice.phase === 'result' && !vx && !vy && !vz) break;
  }
  return practice.carry ?? practice.distance;
}

export function shotRanges(club, surface = 'fairway') {
  const key = club + '/' + surface;
  if (!ranges.has(key)) {
    ranges.set(key, POWER_MARKS.map(power => ({
      power,
      stock: carry(club, power, false, surface),
      snap: club === 'putter' ? null : carry(club, power, true, surface),
    })));
  }
  return ranges.get(key);
}

export function rangeCard(club) {
  if (!cards.has(club)) {
    const yards = meters => Math.round(meters / METERS_PER_YARD);
    cards.set(club, shotRanges(club).map(({ power, stock, snap }) => ({
      power, stock: yards(stock), snap: snap === null ? null : yards(snap),
    })));
  }
  return cards.get(club);
}
