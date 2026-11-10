import { createShotAudio, shotCue } from './audio.js';
import { COURSE_NAME } from './course.js';
import { drawHoleMap } from './course-view.js';
import { Round } from './round.js';
import { BALL_RADIUS, FULL_PULL, METERS_PER_YARD, Practice, PUTT_PULL, STEP } from './practice.js';
import { drawScene } from './scene.js';
import { analyzeStroke, runeExit, RUNES } from './spells.js';

const canvas = document.querySelector('#tee');
const ctx = canvas.getContext('2d');
const header = document.querySelector('.masthead');
const resetButton = document.querySelector('#reset');
const playCourse = document.querySelector('#play-course');
const clubChoice = document.querySelector('#club-choice');
const courseName = document.querySelector('#course-name');
const roundNext = document.querySelector('#round-next');
const holeInfo = document.querySelector('#hole-info');
const toPin = document.querySelector('#to-pin');
const dialog = document.querySelector('#round-dialog');
const mapCanvas = document.querySelector('#map-canvas');
const mapTip = document.querySelector('#map-tip');
const mapContent = document.querySelector('#map-content');
const cardContent = document.querySelector('#card-content');
const aimAtPin = document.querySelector('#aim-at-pin');
const mode = document.querySelector('#spell-mode');
const guideSelect = document.querySelector('#rune-guide');
const phase = document.querySelector('#phase');
const prompt = document.querySelector('#prompt');
const load = document.querySelector('#load');
const carry = document.querySelector('#carry');
const distance = document.querySelector('#distance');

const practice = new Practice();
const audio = createShotAudio();
const flight = [];
let round = null;
let mapPoint = null;
let width = 0;
let height = 0;
let pointer = null;
let points = [];
let pullStarted = false;
let unrecognized = false;
let soundedShot = false;
let guideLayout = null;
let lastFrame = performance.now();
let accumulator = 0;

function layoutGuide() {
  const shortSide = Math.min(width, height);
  const pull = FULL_PULL * shortSide;
  const scale = Math.min(94, shortSide * .25);
  const preferredY = header.getBoundingClientRect().bottom + scale + 12;
  guideLayout = {
    x: width * .76,
    y: Math.min(preferredY, height - pull - 15),
    scale,
    pull,
  };
}

function resize() {
  const bounds = canvas.getBoundingClientRect();
  if (pointer !== null && (bounds.width !== width || bounds.height !== height)) reset();
  width = bounds.width;
  height = bounds.height;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  layoutGuide();
}

function advance(now) {
  accumulator += Math.min(0.10, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  while (accumulator >= STEP) {
    practice.step();
    round?.track(practice);
    accumulator -= STEP;
  }
}

function clearInput() {
  const active = pointer;
  pointer = null;
  if (active !== null && canvas.hasPointerCapture(active)) canvas.releasePointerCapture(active);
  points = [];
  pullStarted = false;
}

function reset() {
  clearInput();
  practice.reset();
  flight.length = 0;
  unrecognized = false;
  soundedShot = false;
  accumulator = 0;
  updateFeedback();
  updateCourse();
  layoutGuide();
}

function sample(event) {
  const bounds = canvas.getBoundingClientRect();
  const shortSide = Math.min(width, height);
  return {
    x: (event.clientX - bounds.left) / shortSide,
    y: (event.clientY - bounds.top) / shortSide,
    t: event.timeStamp,
  };
}

function moveStroke(event, release = false) {
  const dot = sample(event);
  if (round?.club === 'putter') {
    practice.charge = Math.max(0, Math.min(1, (dot.y - points[0].y) / PUTT_PULL));
    return dot;
  }
  const latest = points.at(-1);
  if (release || Math.hypot(dot.x - latest.x, dot.y - latest.y) >= 0.0025) points.push(dot);
  if (!pullStarted && dot.y > points[0].y + 0.052) {
    pullStarted = true;
    const exit = runeExit(points);
    if (exit >= 0) {
      practice.cancelStroke();
      practice.beginStroke(points[exit].x, points[exit].y);
      for (const point of points.slice(exit + 1, -1)) practice.moveStroke(point.x, point.y);
    }
  }
  practice.moveStroke(dot.x, dot.y);
  return dot;
}

canvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  audio.unlock();
  advance(performance.now());
  if (practice.phase === 'swing') {
    practice.snap();
    return;
  }
  if (practice.phase !== 'ready' || (round && round.status !== 'ready')) return;
  pointer = event.pointerId;
  canvas.setPointerCapture(pointer);
  const dot = sample(event);
  points.push(dot);
  practice.beginStroke(dot.x, dot.y);
});

canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== pointer) return;
  for (const point of event.getCoalescedEvents?.() ?? []) moveStroke(point);
  moveStroke(event);
});

canvas.addEventListener('pointerup', event => {
  if (event.pointerId !== pointer) return;
  audio.unlock();
  advance(performance.now());
  const dot = moveStroke(event, true);
  let launched = false;
  if (round?.club === 'putter') {
    if (practice.charge >= .035) {
      practice.putt(practice.charge);
      launched = true;
    } else {
      practice.cancelStroke();
    }
  } else {
    const result = analyzeStroke(points, mode.value, guideSelect.value);
    launched = practice.releaseStroke(dot.x, dot.y, result.spell);
    unrecognized = launched && result.attempted && !result.spell;
  }
  if (launched) round?.startShot();
  clearInput();
});

function cancel(event) {
  if (event.pointerId !== pointer) return;
  reset();
}

canvas.addEventListener('pointercancel', cancel);
canvas.addEventListener('lostpointercapture', cancel);
resetButton.addEventListener('click', reset);
function resetReadyShot() {
  if (!round || round.status === 'ready') reset();
}

mode.addEventListener('change', resetReadyShot);
guideSelect.addEventListener('change', resetReadyShot);
window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey) resetReadyShot();
});

function show(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function formatYards(meters) {
  return Math.round(meters / METERS_PER_YARD) + ' yd';
}

function scoreLabel(score) {
  return score === 0 ? 'Even' : (score > 0 ? '+' : '−') + Math.abs(score);
}

function pinDistance(meters) {
  return meters < 12 ? Math.round(meters / .3048) + ' ft' : formatYards(meters);
}

function startRound() {
  round = new Round();
  round.prepare(practice);
  reset();
}

playCourse.addEventListener('click', () => {
  if (round?.status === 'playing') return;
  if (round) {
    round = null;
    practice.configure();
    reset();
  } else {
    startRound();
  }
});

clubChoice.addEventListener('change', () => {
  if (round?.selectClub(clubChoice.value, practice)) reset();
});

roundNext.addEventListener('click', () => {
  if (round.status === 'complete') {
    startRound();
  } else {
    round.next(practice);
    if (round.status === 'complete') openScorecard();
    else reset();
  }
});

function openScorecard() {
  document.querySelector('#dialog-title').textContent = COURSE_NAME + ' scorecard';
  mapContent.hidden = true;
  cardContent.hidden = false;
  const rows = document.querySelector('#card-rows');
  rows.replaceChildren();
  for (const [index, hole] of round.holes.entries()) {
    const row = rows.insertRow();
    if (index === round.index && round.status !== 'complete') row.setAttribute('aria-current', 'step');
    for (const value of [(index + 1) + ' · ' + hole.name, hole.par, hole.yards, round.card[index] ?? '—']) {
      row.insertCell().textContent = value;
    }
  }
  document.querySelector('#card-par').textContent = round.holes.reduce((sum, hole) => sum + hole.par, 0);
  document.querySelector('#card-yards').textContent = round.holes.reduce((sum, hole) => sum + hole.yards, 0);
  document.querySelector('#card-strokes').textContent = round.total;
  document.querySelector('#card-total').textContent =
    round.total + ' strokes · ' + scoreLabel(round.toPar) + ' · ' + round.card.length + ' of 9 holes';
  if (!dialog.open) dialog.showModal();
}

document.querySelector('#scorecard').addEventListener('click', openScorecard);
document.querySelector('#hole-map').addEventListener('click', () => {
  document.querySelector('#dialog-title').textContent = (round.index + 1) + ' · ' + round.hole.name;
  mapContent.hidden = false;
  cardContent.hidden = true;
  const ready = round.status === 'ready' && practice.phase === 'ready';
  mapTip.textContent = round.hole.tip + (ready ? ' Tap a spot to aim there.' : '');
  aimAtPin.hidden = !ready;
  const ball = round.landing ?? (ready ? round.lie : round.worldPoint(practice.ball));
  mapPoint = drawHoleMap(mapCanvas, round, ball);
  dialog.showModal();
});

function aimAt(target) {
  if (practice.phase === 'ready' && round?.setAim(target)) dialog.close();
}

mapCanvas.addEventListener('click', event => {
  const bounds = mapCanvas.getBoundingClientRect();
  aimAt(mapPoint((event.clientX - bounds.left) * mapCanvas.width / bounds.width,
    (event.clientY - bounds.top) * mapCanvas.height / bounds.height));
});
aimAtPin.addEventListener('click', () => aimAt(round.hole.pin));

const courseTools = document.querySelector('.course-tools');
const spellTools = document.querySelector('.spell-tools');
const pinStat = document.querySelector('#pin-stat');
const lieLabels = { fairway: 'Fairway', green: 'Green', rough: 'Rough', sand: 'Bunker' };

function updateCourse() {
  const putting = round?.club === 'putter';
  spellTools.hidden = putting;
  guideSelect.hidden = mode.value === 'hard';
  courseTools.hidden = !round;
  pinStat.hidden = !round;
  resetButton.hidden = Boolean(round);
  show(playCourse, round ? 'Practice' : 'Play 9');
  show(courseName, round ? COURSE_NAME : 'Wizard golf');
  if (!round) return;
  playCourse.disabled = round.status === 'playing';
  const ready = round.status === 'ready' && practice.phase === 'ready';
  clubChoice.disabled = !ready;
  if (clubChoice.value !== round.club) clubChoice.value = round.club;
  const hole = round.hole;
  const lie = round.atTee ? 'Tee' : lieLabels[round.surface];
  show(holeInfo, 'Hole ' + (round.index + 1) + '/9 · Par ' + hole.par + ' · ' + hole.yards + ' yd · ' +
    (round.status === 'complete' ? scoreLabel(round.toPar) : lie + ' · ' + round.strokes + ' strokes'));
  const ball = round.landing ?? (round.status === 'playing' ? round.worldPoint(practice.ball) : round.lie);
  show(toPin, pinDistance(Math.hypot(hole.pin.x - ball.x, hole.pin.z - ball.z)));
  roundNext.hidden = !['shot-over', 'holed', 'complete'].includes(round.status);
  show(roundNext, round.status === 'shot-over' ? 'Play next shot' :
    round.status === 'complete' ? 'Play again' : round.index === 8 ? 'Finish round' : 'Next hole');
}

function spellResult() {
  const { spell, impact, turfAt, castLabel } = practice;
  const purity = Math.round(spell.purity * 100) + '% purity';
  if (turfAt !== null && (!impact || turfAt <= impact.at)) {
    return [spell.name + ' · Turf strike', purity + ' · Keep the return straighter.'];
  }
  if (!impact) return [spell.name + ' · Whiff', purity + ' · Keep the return straighter.'];

  const details = [];
  if (spell.type === 'star') details.push(Math.floor(impact.spellEnergy * 100 + 1e-8) + '% power');
  if (impact.snapEnergy > 1) details.push('Snap +' + Math.round((impact.snapEnergy - 1) * 100) + '% energy');
  else if (castLabel) details.push(castLabel);
  const scores = [
    [spell.geometry, 'Trace the shape more closely.'],
    [spell.pace, 'Draw the rune a little faster.'],
    [spell.rhythm, 'Keep the motion flowing into the return.'],
  ];
  const [score, tip] = scores.reduce((lowest, item) => item[0] < lowest[0] ? item : lowest);
  if (score < 0.96) details.push(tip);
  return [spell.name + ' · ' + purity, details.join(' · ') || 'Pure release'];
}

function updateFeedback() {
  let title = 'Practice tee';
  let hint = mode.value === 'guided' ? 'Start at the gold dot. Trace, pull, then swipe up.' : 'Start at the gold dot. Draw, pull, then swipe up.';

  if (practice.phase === 'drawing') {
    title = pullStarted ? 'Loading the swing' : 'Drawing the spell';
    hint = pullStarted ? 'Swipe straight back up and lift.' : 'Draw the rune and flow into the pull.';
  } else if (practice.phase === 'swing') {
    title = practice.spell ? practice.spell.name + ' released' : 'Downswing';
    hint = practice.spell ? 'Tap just before contact for a bonus.' : 'Tap just before the head reaches the ball.';
  } else if (practice.phase === 'result') {
    if (practice.spell) {
      [title, hint] = spellResult();
    } else if (practice.castLabel === 'Early cast' && practice.turfAt !== null) {
      title = 'Early cast · Turf strike';
      hint = 'Wait for the club to get closer before tapping.';
    } else if (!practice.impact) {
      title = practice.turfAt === null ? 'Whiff' : 'Turf strike';
      hint = 'Try a straighter return to bring the head through.';
    } else if (practice.castLabel === 'Clean snap') {
      title = 'Clean snap';
      hint = 'The tether whipped the club through the ball.';
    } else if (practice.castLabel) {
      title = practice.castLabel;
      hint = 'Tap as the club head closes in on the ball.';
    } else {
      title = 'Plain strike';
      hint = unrecognized ? 'Rune unrecognized. Practice the shape in Guided.' : 'A snap just before impact adds power.';
    }
  }

  if (round) {
    if (round.status === 'complete') {
      title = 'Round complete';
      hint = round.total + ' strokes · ' + scoreLabel(round.toPar);
    } else if (round.status === 'holed') {
      title = 'Holed · ' + round.strokes + (round.strokes === 1 ? ' stroke' : ' strokes');
      hint = round.hole.name + ' · ' + scoreLabel(round.strokes - round.hole.par);
    } else if (round.notice) {
      title = round.notice;
      hint = 'Play again from the previous lie.';
    } else if (round.club === 'putter') {
      title = round.status === 'shot-over' ? 'Putt finished' : practice.phase === 'drawing' ? 'Set putt power' : round.hole.name;
      hint = practice.phase === 'drawing' ? 'About ' + pinDistance(22 * practice.charge ** 2) + ' of roll. Lift to putt.' :
        round.status === 'playing' ? 'Rolling toward the cup.' : 'Pull back and lift to putt.';
    } else if (practice.phase === 'ready') {
      title = round.hole.name;
    }
  }

  show(phase, title);
  show(prompt, hint);
  show(load, practice.phase === 'ready' ? '—' : Math.round(practice.charge * 100) + '%');
  show(carry, practice.carry === null ? '—' : formatYards(practice.carry));
  show(distance, practice.impact ? formatYards(practice.distance) : '—');
}

function frame() {
  advance(performance.now());
  if (!soundedShot) {
    const cue = shotCue(practice);
    if (cue) {
      audio.play(cue);
      soundedShot = true;
    }
  }
  const { ball } = practice;
  const lastSample = flight.at(-1);
  if (practice.impact && practice.carry === null && ball.y > BALL_RADIUS &&
      (!lastSample || practice.elapsed - lastSample.at >= 1 / 60)) {
    flight.push({ x: ball.x, y: ball.y, z: ball.z, at: practice.elapsed });
  }
  const putting = round?.club === 'putter';
  const drawing = practice.phase === 'drawing' && !putting;
  const showingStart = !putting && (practice.phase === 'ready' || drawing);
  const rune = showingStart && mode.value === 'guided' ? RUNES.find(item => item.id === guideSelect.value) : null;
  const guide = showingStart ? { ...guideLayout, path: rune?.path, channelOnly: pullStarted } : null;
  const shortSide = Math.min(width, height);
  const trace = drawing ? points.map(point => ({ x: point.x * shortSide, y: point.y * shortSide })) : [];
  drawScene(ctx, width, height, practice, trace, flight, guide, round);
  updateFeedback();
  updateCourse();
  requestAnimationFrame(frame);
}

resize();
if (new URLSearchParams(location.search).has('course')) startRound();
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(frame);
