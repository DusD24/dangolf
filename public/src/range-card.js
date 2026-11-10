import { FULL_PULL, METERS_PER_YARD, Practice, STEP } from './practice.js';

export const POWER_MARKS = [25, 50, 75, 100];
const cards = new Map();

function yardage(club, power, snap) {
  const practice = new Practice();
  practice.configure(club);
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
  return Math.round((practice.carry ?? practice.distance) / METERS_PER_YARD);
}

export function rangeCard(club) {
  if (!cards.has(club)) {
    cards.set(club, POWER_MARKS.map(power => ({
      power,
      stock: yardage(club, power, false),
      snap: club === 'putter' ? null : yardage(club, power, true),
    })));
  }
  return cards.get(club);
}
