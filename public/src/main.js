import { createShotAudio, shotCue } from './audio.js';
import { BALL_RADIUS, FULL_PULL, METERS_PER_YARD, Practice, STEP } from './practice.js';
import { drawScene } from './scene.js';
import { analyzeStroke, runeExit, RUNES } from './spells.js';

const canvas = document.querySelector('#tee');
const ctx = canvas.getContext('2d');
const header = document.querySelector('.masthead');
const resetButton = document.querySelector('#reset');
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
  if (practice.phase !== 'ready') return;
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
  const result = analyzeStroke(points, mode.value, guideSelect.value);
  const launched = practice.releaseStroke(dot.x, dot.y, result.spell);
  unrecognized = launched && result.attempted && !result.spell;
  clearInput();
});

function cancel(event) {
  if (event.pointerId !== pointer) return;
  reset();
}

canvas.addEventListener('pointercancel', cancel);
canvas.addEventListener('lostpointercapture', cancel);
resetButton.addEventListener('click', reset);
mode.addEventListener('change', () => {
  guideSelect.hidden = mode.value === 'hard';
  reset();
});
guideSelect.addEventListener('change', reset);
window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey) reset();
});

function show(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function formatYards(meters) {
  return Math.round(meters / METERS_PER_YARD) + ' yd';
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
  const drawing = practice.phase === 'drawing';
  const showingStart = practice.phase === 'ready' || drawing;
  const rune = showingStart && mode.value === 'guided' ? RUNES.find(item => item.id === guideSelect.value) : null;
  const guide = showingStart ? { ...guideLayout, path: rune?.path, channelOnly: pullStarted } : null;
  const shortSide = Math.min(width, height);
  const trace = drawing ? points.map(point => ({ x: point.x * shortSide, y: point.y * shortSide })) : [];
  drawScene(ctx, width, height, practice, trace, flight, guide);
  updateFeedback();
  requestAnimationFrame(frame);
}

resize();
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(frame);
