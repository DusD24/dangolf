import { Practice, STEP } from './practice.js';
import { drawScene } from './scene.js';

const canvas = document.querySelector('#tee');
const ctx = canvas.getContext('2d');
const resetButton = document.querySelector('#reset');
const phase = document.querySelector('#phase');
const prompt = document.querySelector('#prompt');
const load = document.querySelector('#load');
const carry = document.querySelector('#carry');
const distance = document.querySelector('#distance');

const practice = new Practice();
const camera = { x: 0, z: 0 };
let width = 0;
let height = 0;
let pointer = null;
let trace = [];
let lastFrame = performance.now();
let accumulator = 0;

function resize() {
  const bounds = canvas.getBoundingClientRect();
  width = bounds.width;
  height = bounds.height;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function advance(now) {
  accumulator += Math.min(0.10, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  while (accumulator >= STEP) {
    practice.step();
    accumulator -= STEP;
  }
}

function reset() {
  if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  pointer = null;
  trace = [];
  practice.reset();
  camera.x = 0;
  camera.z = 0;
  accumulator = 0;
}

function capturePoint(event) {
  const bounds = canvas.getBoundingClientRect();
  const dot = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  const latest = trace.at(-1);
  if (!latest || Math.hypot(dot.x - latest.x, dot.y - latest.y) >= 2) {
    trace.push(dot);
    if (trace.length > 100) trace.shift();
  }
  // Normalize both axes against the same touch scale in portrait and landscape.
  const gestureScale = Math.min(width, height);
  return [dot.x / gestureScale, dot.y / gestureScale];
}

canvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  advance(performance.now());
  if (practice.phase === 'swing') {
    practice.snap();
    return;
  }
  if (practice.phase !== 'ready') return;
  pointer = event.pointerId;
  canvas.setPointerCapture(pointer);
  practice.beginStroke(...capturePoint(event));
});

canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== pointer) return;
  for (const point of event.getCoalescedEvents?.() ?? []) {
    practice.moveStroke(...capturePoint(point));
  }
  practice.moveStroke(...capturePoint(event));
});

canvas.addEventListener('pointerup', event => {
  if (event.pointerId !== pointer) return;
  advance(performance.now());
  practice.releaseStroke(...capturePoint(event));
  pointer = null;
  trace = [];
});

function cancel(event) {
  if (event.pointerId !== pointer) return;
  pointer = null;
  trace = [];
  practice.cancelStroke();
}

canvas.addEventListener('pointercancel', cancel);
canvas.addEventListener('lostpointercapture', cancel);
resetButton.addEventListener('click', reset);
window.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey) reset();
});

function show(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function updateFeedback() {
  let title = 'Practice tee';
  let hint = 'Pull down, then swipe up and lift.';

  if (practice.phase === 'drawing') {
    title = 'Drawing the spell';
    hint = 'Pull down for power. Swipe straight back up.';
  } else if (practice.phase === 'swing') {
    title = 'Downswing';
    hint = 'Tap just before the head reaches the ball.';
  } else if (practice.phase === 'result') {
    if (practice.castLabel === 'Early cast' && practice.turfAt !== null) {
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
      hint = 'A snap just before impact adds power.';
    }
  }

  show(phase, title);
  show(prompt, hint);
  show(load, practice.phase === 'ready' ? '—' : Math.round(practice.charge * 100) + '%');
  show(carry, practice.carry === null ? '—' : practice.carry.toFixed(1) + ' m');
  show(distance, practice.impact ? practice.distance.toFixed(1) + ' m' : '—');
}

function frame() {
  const now = performance.now();
  const blend = 1 - Math.exp(-Math.max(0, now - lastFrame) / 175);
  advance(now);
  if (practice.impact) {
    camera.x += (Math.max(0, practice.ball.x - 0.78) - camera.x) * blend;
    camera.z += (practice.ball.z - camera.z) * blend;
  }
  drawScene(ctx, width, height, practice, camera, trace);
  updateFeedback();
  requestAnimationFrame(frame);
}

resize();
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(frame);
