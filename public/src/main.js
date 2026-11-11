import { createShotAudio, shotCue } from './audio.js';
import { createNarrator } from './narrator.js';
import { ShotNarration } from './narration-triggers.js';
import { COURSE, COURSE_NAME, surfaceAt } from './course.js';
import { greenRead, pinDistance, puttAimTarget } from './course-map.js';
import { createGear } from './gear.js';
import { createCourseMaps } from './course-maps.js';
import { ROYAL_FLUSH_PURITY, spellManaCost, SPELL_MANA_COST } from './mana.js';
import { Round } from './round.js';
import { PracticeRange } from './practice-range.js';
import { CLUBS } from './clubs.js';
import { BALL_RADIUS, FULL_PULL, METERS_PER_YARD, Practice, PUTT_PULL, STEP } from './practice.js';
import { drawScene } from './scene.js';
import { analyzePutt, analyzeStroke, runeExit } from './spells.js';

const canvas = document.querySelector('#tee');
const ctx = canvas.getContext('2d');
const header = document.querySelector('.masthead');
const controls = document.querySelector('.thumb-controls');
const resetButton = document.querySelector('#reset');
const cancelSpell = document.querySelector('#cancel-spell');
const playCourse = document.querySelector('#play-course');
const holeMapButton = document.querySelector('#hole-map');
const scorecardButton = document.querySelector('#scorecard');
const courseName = document.querySelector('#course-name');
const roundNext = document.querySelector('#round-next');
const holeInfo = document.querySelector('#hole-info');
const toPin = document.querySelector('#to-pin');
const dialog = document.querySelector('#round-dialog');
const mapContent = document.querySelector('#map-content');
const cardContent = document.querySelector('#card-content');
const phase = document.querySelector('#phase');
const prompt = document.querySelector('#prompt');
const load = document.querySelector('#load');
const carry = document.querySelector('#carry');
const distance = document.querySelector('#distance');
const muteButton = document.querySelector('#narration-mute');
const rangeLast = document.querySelector('#range-last');

const practice = new Practice();
const range = new PracticeRange();
range.restart(practice);
const audio = createShotAudio();
const narrator = createNarrator();
const shotNarration = new ShotNarration();
narrator.say('title', { delay: 0 });
let narrationActive = false;
let narrationShot = 0;
const flight = [];
let round = null;
const gear = createGear({ equip: equipClub, changeSpell: resetReadyShot });
const courseMaps = createCourseMaps({
  dialog, equipClub,
  setAim: target => practice.phase === 'ready' && (round ?? range).setAim(target),
  selectedSpell: () => ({ rune: gear.swingRune, mode: gear.mode }),
  selectRangeMode,
  selectRangeTarget,
});
let width = 0;
let height = 0;
let pointer = null;
let points = [];
let pullStarted = false;
let puttTrace = null;
let unrecognized = false;
let spellNotice = '';
let soundedShot = false;
let soundedSwing = false;
let soundedCup = false;
let guideLayout = null;
let lastFrame = performance.now();
let accumulator = 0;

function layoutGuide() {
  const shortSide = Math.min(width, height);
  const pull = (practice.clubType === 'putter' ? PUTT_PULL : FULL_PULL) * shortSide;
  const guideTop = header.getBoundingClientRect().bottom + 12;
  const bottom = controls.getBoundingClientRect().top - pull - 8;
  const scale = Math.min(94, shortSide * .25, Math.max(shortSide * .10, bottom - guideTop));
  const minY = guideTop + scale;
  const maxY = Math.max(minY, bottom);
  const preferredY = Math.min(Math.max(minY, height * .40), maxY);
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
    const session = round ?? range;
    practice.step();
    session.track(practice);
    if (narrationActive) {
      shotNarration.observe(session, practice);
      const settled = session.status !== 'playing';
      if (settled) {
        const line = shotNarration.finish(session, practice);
        if (line) narrator.say(line.id, { important: line.important, shot: narrationShot });
        narrationActive = false;
      }
    }
    accumulator -= STEP;
  }
}

function clearInput() {
  const active = pointer;
  pointer = null;
  if (active !== null && canvas.hasPointerCapture(active)) canvas.releasePointerCapture(active);
  points = [];
  pullStarted = false;
  puttTrace = null;
}

function reset() {
  narrationActive = false;
  shotNarration.cancelShot();
  narrator.clearCommon();
  clearInput();
  if (round) practice.reset();
  else range.restart(practice);
  flight.length = 0;
  unrecognized = false;
  spellNotice = '';
  soundedShot = false;
  soundedSwing = false;
  soundedCup = false;
  accumulator = 0;
  updateFeedback();
  updateCourse();
  layoutGuide();
}

function narrateShot(attempted) {
  shotNarration.beginShot(round ?? range, practice, attempted);
  narrationActive = true;
  narrationShot++;
  if (practice.spell?.purity > .95) narrator.say('damn-son', { delay: 100, shot: narrationShot });
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
  if (practice.clubType === 'putter') {
    puttTrace = analyzePutt(points, gear.mode, gear.rune);
    practice.charge = puttTrace.drawing ? 0 : Math.max(0, Math.min(1, (dot.y - puttTrace.start.y) / PUTT_PULL));
    pullStarted = practice.charge > .035;
    return dot;
  }
  if (!pullStarted && dot.y > points[0].y + 0.052) {
    pullStarted = true;
    const exit = gear.armed ? runeExit(points) : -1;
    if (exit >= 0) {
      practice.cancelStroke();
      practice.beginStroke(points[exit].x, points[exit].y, gear.mode === 'guided');
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
  if (practice.phase !== 'ready' || (round ?? range).status !== 'ready') return;
  pointer = event.pointerId;
  canvas.setPointerCapture(pointer);
  const dot = sample(event);
  points.push(dot);
  practice.beginStroke(dot.x, dot.y, gear.mode === 'guided');
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
  const session = round ?? range;
  let launched = false;
  let castAttempted = false;
  if (practice.clubType === 'putter') {
    if (practice.charge >= .035) {
      const { charge } = practice;
      const { spell, attempted } = puttTrace;
      const attempt = attempted && gear.rune.type;
      if (!session.putt(practice, charge, spell, attempt)) {
        if (attempt) spellNotice = 'Casting requires ' + spellManaCost(attempt) + ' mana from the right lie.';
        if (attempt && !session.canCast(attempt)) narrator.say('no-mana');
        session.putt(practice, charge);
      } else if (attempt && !spell) {
        spellNotice = round ? 'Miscast · ' + spellManaCost(attempt) + ' mana spent.' : 'Miscast · Try the trace again.';
      } else if (spell) {
        const purity = spell.purity < ROYAL_FLUSH_PURITY ? Math.floor(spell.purity * 100) : Math.round(spell.purity * 100);
        const needed = spell.type === 'royal-flush' && !practice.impact.royal ? ' · 90% needed' : '';
        spellNotice = spell.name + ' · ' + purity + '% purity' + needed + '.';
      }
      if (practice.impact?.putt && session.status === 'playing') {
        narrateShot(session.attemptedSpell);
      }
    } else {
      practice.cancelStroke();
    }
  } else {
    const result = gear.armed ? analyzeStroke(points, gear.mode, gear.rune.id) : { spell: null, attempted: false };
    let spell = result.spell;
    if (spell && !gear.hasRune(spell.id)) {
      spellNotice = spell.name + ' needs an equipped slot.';
      spell = null;
    } else if (result.attempted && round && !round.canCast()) {
      spellNotice = 'Casting requires ' + SPELL_MANA_COST + ' mana.';
      narrator.say('no-mana');
      spell = null;
    } else {
      castAttempted = result.attempted;
    }
    launched = practice.releaseStroke(dot.x, dot.y, spell);
    unrecognized = launched && result.attempted && !result.spell && !spellNotice;
    if (unrecognized && round) spellNotice = 'Miscast · ' + SPELL_MANA_COST + ' mana spent.';
  }
  if (launched && session.startShot(castAttempted)) narrateShot(castAttempted);
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

function prepareCourseShot() {
  gear.setShotSpell(round.atTee && round.strokes === 0 && round.canCast() ? 'star' : null);
  reset();
}

function startRound() {
  shotNarration.beginRound();
  round = new Round();
  round.prepare(practice);
  prepareCourseShot();
  narrator.say('round-start', { delay: 700 });
}

playCourse.addEventListener('click', () => {
  if (round?.status === 'playing') return;
  if (round) {
    round = null;
    shotNarration.beginRound();
    range.restart(practice);
    gear.setShotSpell(range.club === 'putter' ? null : gear.swingRune.id);
    reset();
  } else {
    startRound();
  }
});

function equipClub(club) {
  if (round) {
    if (practice.phase !== 'ready' || !round.selectClub(club, practice)) return false;
  } else {
    if (range.status === 'playing') return false;
    if (range.status !== 'ready') range.restart(practice);
    if (!range.selectClub(club, practice)) return false;
  }
  reset();
  return true;
}

function selectRangeMode(mode) {
  if (round || pointer !== null || !range.setMode(mode, practice)) return false;
  gear.setShotSpell(range.club === 'putter' ? null : gear.swingRune.id);
  reset();
  return true;
}

function selectRangeTarget(id) {
  if (round || pointer !== null || !range.selectTarget(id, practice)) return false;
  reset();
  return true;
}

function updateMute() {
  muteButton.setAttribute('aria-pressed', String(narrator.muted));
  muteButton.setAttribute('aria-label', narrator.muted ? 'Unmute narrator' : 'Mute narrator');
  muteButton.title = narrator.muted ? 'God voice muted' : 'Mute god voice';
  document.querySelector('#voice-waves').toggleAttribute('hidden', narrator.muted);
  document.querySelector('#voice-silent').toggleAttribute('hidden', !narrator.muted);
}
muteButton.addEventListener('click', () => {
  narrator.setMuted(!narrator.muted);
  updateMute();
});
updateMute();

roundNext.addEventListener('click', () => {
  if (round.status === 'complete') {
    startRound();
  } else {
    const previousHole = round.index;
    round.next(practice);
    if (round.status === 'complete') {
      narrateRoundEnd();
      openScorecard();
    } else {
      prepareCourseShot();
      if (round.index !== previousHole && round.index === 9) narrator.say('back-nine');
      if (round.index !== previousHole && round.index === 17) narrator.say('final-hole');
    }
  }
});

function narrateRoundEnd() {
  let best = null;
  try {
    const saved = localStorage.getItem('dangolf.moonfen-best');
    const value = Number(saved);
    if (saved !== null && Number.isInteger(value) && value >= round.holes.length) best = value;
    if (best === null || round.total < best) localStorage.setItem('dangolf.moonfen-best', String(round.total));
  } catch { /* Narration and the scorecard also work with storage disabled. */ }
  const record = best !== null && round.total < best;
  narrator.say(record ? 'personal-best' : round.toPar < 0 ? 'round-under' : round.toPar === 0 ? 'round-even' : 'round-over');
}

function openScorecard() {
  dialog.classList.remove('chart-dialog');
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
    round.total + ' strokes · ' + scoreLabel(round.toPar) + ' · ' + round.card.length + ' of ' + round.holes.length + ' holes';
  if (!dialog.open) dialog.showModal();
  const scroll = document.querySelector('.scorecard-scroll');
  scroll.scrollTop = 0;
  if (round.index >= 9) {
    scroll.scrollTop = rows.rows[round.index].getBoundingClientRect().top - scroll.getBoundingClientRect().top -
      scroll.querySelector('thead').offsetHeight;
  }
}

scorecardButton.addEventListener('click', openScorecard);
holeMapButton.addEventListener('click', () => courseMaps.open());

const choices = document.querySelector('.choices');
const spellTools = document.querySelector('.spell-tools');
const pinStat = document.querySelector('#pin-stat');
const puttingControls = document.querySelector('#putting-controls');
const puttAimLeft = document.querySelector('#putt-aim-left');
const puttAimRight = document.querySelector('#putt-aim-right');
const puttAimOffset = document.querySelector('#putt-aim-offset');
const lieLabels = { fairway: 'Fairway', green: 'Green', rough: 'Rough', sand: 'Bunker' };

function aimPutt(direction) {
  const session = round ?? range;
  if (pointer !== null || session.status === 'playing' || practice.phase === 'drawing') return;
  if (round) {
    if (round.status !== 'ready' || round.club !== 'putter') return;
    round.setAim(puttAimTarget(round, direction));
  } else {
    if (range.status !== 'ready') reset();
    range.nudgeAim(direction);
  }
  updateCourse();
}
puttAimLeft.addEventListener('click', () => aimPutt(-1));
puttAimRight.addEventListener('click', () => aimPutt(1));

function updateCourse() {
  const session = round ?? range;
  const ready = pointer === null && session.status === 'ready' && practice.phase === 'ready';
  const canEquip = pointer === null && session.status !== 'playing' && practice.phase !== 'drawing';
  spellTools.hidden = false;
  gear.update(practice.clubType, canEquip, round?.mana ?? null, session.puttingRune);
  cancelSpell.hidden = !ready || !gear.armed;
  holeInfo.hidden = false;
  pinStat.hidden = false;
  holeMapButton.hidden = false;
  scorecardButton.hidden = !round;
  resetButton.hidden = Boolean(round);
  const canAdvance = round && ['shot-over', 'holed', 'complete'].includes(round.status);
  puttingControls.hidden = Boolean(round && (round.status !== 'ready' || practice.clubType !== 'putter'));
  puttingControls.setAttribute('aria-label', round ? 'Putt aim' : 'Practice shot aim');
  puttAimLeft.disabled = puttAimRight.disabled = !canEquip;
  puttAimLeft.setAttribute('aria-label', round || range.club === 'putter' ? 'Aim half a degree left' : 'Aim one degree left');
  puttAimRight.setAttribute('aria-label', round || range.club === 'putter' ? 'Aim half a degree right' : 'Aim one degree right');
  if (!puttingControls.hidden) {
    const pinAngle = Math.atan2(session.hole.pin.z - session.lie.z, session.hole.pin.x - session.lie.x);
    const angle = Math.atan2(Math.sin(session.aim - pinAngle), Math.cos(session.aim - pinAngle)) * 180 / Math.PI;
    show(puttAimOffset, Math.abs(angle) < .05 ? round || range.club === 'putter' ? 'At cup' : 'At target' :
      Math.abs(angle).toFixed(1).replace(/\.0$/, '') + '° ' + (angle < 0 ? 'left' : 'right'));
  }
  roundNext.hidden = !canAdvance;
  choices.hidden = Boolean(canAdvance);
  playCourse.disabled = session.status === 'playing';
  show(playCourse, round ? 'Practice' : 'Play ' + COURSE.length);
  show(courseName, round ? COURSE_NAME : 'Moonfen range');
  header.classList.add('course-hud');
  document.querySelector('#practice').classList.toggle('range-hud', !round);
  show(holeMapButton, round ? 'Aim / Map' : 'Targets');
  show(resetButton, 'Next ball');
  show(document.querySelector('#pin-label'), round ? 'To pin' : range.club === 'putter' ? 'To cup' : 'Target');
  const hole = session.hole;
  const lie = round?.atTee ? 'Tee' : lieLabels[session.surface];
  const station = { driving: 'Tee bay', rough: 'Rough', sand: 'Bunker', putting: 'Putting green', fringe: 'Fringe' }[range.mode];
  show(holeInfo, round ? 'Hole ' + (round.index + 1) + '/' + round.holes.length + ' · Par ' + hole.par + ' · ' + hole.yards + ' yd · ' +
    (round.status === 'complete' ? scoreLabel(round.toPar) : lie + ' · ' + round.strokes + ' strokes') :
    station + ' · Unlimited mana');
  rangeLast.hidden = Boolean(round || !range.lastShot);
  if (!rangeLast.hidden) {
    const shot = range.lastShot;
    const roll = Math.max(0, shot.total - shot.carry);
    const unit = shot.mode === 'putting' || shot.mode === 'fringe' ? meters => pinDistance(meters, true) : formatYards;
    show(rangeLast, 'Last · ' + CLUBS[shot.club].short + ' · ' + Math.round(shot.power * 100) + '% · ' +
      (shot.mode === 'putting' || shot.mode === 'fringe' ? unit(shot.total) + ' roll' :
        unit(shot.carry) + ' carry · ' + unit(roll) + ' roll') + ' · ' + unit(shot.error) + ' from target');
  }
  const ball = session.landing ?? (session.status === 'playing' ? session.worldPoint(practice.ball) : session.lie);
  show(toPin, pinDistance(Math.hypot(hole.pin.x - ball.x, hole.pin.z - ball.z),
    session.club === 'putter' || surfaceAt(hole, ball) === 'green'));
  courseMaps.update(session, ball, ready);
  if (round) show(roundNext, round.status === 'shot-over' ? 'Play next shot' :
    round.status === 'complete' ? 'Play again' : round.index === round.holes.length - 1 ? 'Finish round' : 'Next hole');
}

function spellResult() {
  const { spell, impact, turfAt, castLabel } = practice;
  const purity = Math.round(spell.purity * 100) + '% purity';
  if (impact?.kind === 'top') return [spell.name + ' · Topped', purity + ' · Tap closer to contact.'];
  if (turfAt !== null && (!impact || turfAt <= impact.at)) {
    return [spell.name + ' · Chunked', purity + ' · The club dug into the turf.'];
  }
  if (!impact) return [spell.name + ' · Whiff', purity + ' · Keep the return straighter.'];

  const details = [];
  if (castLabel) details.push(castLabel);
  const scores = [
    [spell.geometry, 'Trace the shape more closely.'],
    [spell.pace, 'Draw the rune a little faster.'],
    [spell.rhythm, 'Keep the motion flowing into the return.'],
  ];
  const [score, tip] = scores.reduce((lowest, item) => item[0] < lowest[0] ? item : lowest);
  if (score < 0.96) details.push(tip);
  return [(impact.pure ? 'Pure ' : '') + spell.name + ' · ' + purity,
    details.join(' · ') || 'Pure release'];
}

function updateFeedback() {
  const session = round ?? range;
  let title = 'Practice tee';
  let hint = gear.mode === 'guided' ? 'Start at the gold dot. Trace, pull, then swipe up.' : 'Start at the gold dot. Draw, pull, then swipe up.';
  if (!gear.armed) hint = 'Plain shot · Pull down, then swipe up.';

  if (practice.phase === 'drawing') {
    title = pullStarted || !gear.armed ? 'Loading the swing' : 'Drawing the spell';
    hint = pullStarted ? 'Swipe straight back up and lift.' :
      gear.armed ? 'Draw the rune and flow into the pull.' : 'Pull down to set power.';
  } else if (practice.phase === 'swing' && !practice.impact) {
    title = practice.spell ? practice.spell.name + ' released' : 'Downswing';
    hint = 'Tap at contact for a bonus.';
  } else if (practice.phase === 'result' || practice.impact) {
    if (practice.spell) {
      [title, hint] = spellResult();
    } else if (practice.impact?.kind === 'chunk') {
      title = 'Chunked';
      hint = practice.castLabel === 'Early snap' ? 'Tap closer to contact.' : 'The club dug into the turf.';
    } else if (practice.impact?.kind === 'top') {
      title = 'Topped';
      hint = session.surface === 'rough' ? 'The rough stopped the rollout.' : 'Late tap sent the ball out low with topspin.';
    } else if (!practice.impact) {
      title = practice.turfAt === null ? 'Whiff' : 'Turf strike';
      hint = 'Try a straighter return to bring the head through.';
    } else if (practice.castLabel === 'Clean snap') {
      title = 'Clean snap';
      hint = 'Centered contact added carry.';
    } else if (practice.castLabel) {
      title = practice.castLabel;
      hint = 'Tap closer to contact.';
    } else {
      title = 'Plain strike';
      hint = unrecognized ? 'Rune unrecognized. Practice the shape in Guided.' : 'Tap at contact to add carry.';
    }
  }

  if (practice.clubType === 'putter') {
    title = session.hole.name;
    if (practice.phase === 'drawing') {
      title = gear.armed && !pullStarted ? 'Drawing ' + gear.rune.name : 'Set putt pace';
      const spell = puttTrace?.spell;
      hint = gear.armed && !pullStarted ? 'Return to the gold dot, then pull down.' :
        spell?.type === 'royal-flush' && spell.purity >= ROYAL_FLUSH_PURITY ? 'Royal Flush ready. Lift to sink it.' :
        'About ' + pinDistance(practice.puttEstimate(spell), true) + ' of roll. Lift to putt.';
    } else if (gear.armed) {
      hint = 'Draw ' + gear.rune.name + ', pull down, then lift.';
    } else {
      const read = session.puttingRune ? greenRead(session) : '';
      const lag = session.remaining > 7 ? 'Lag it close.' : 'Pull down and lift.';
      hint = read ? read + ' · ' + lag : 'Pull down and lift to putt.';
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
    } else if (round.hitTree) {
      title = 'Hit a tree';
      hint = 'Play the ball from where it dropped.';
    } else if (round.club === 'putter' && round.status !== 'ready') {
      title = round.status === 'shot-over' ? 'Putt finished' : round.hole.name;
      const left = round.landing && Math.hypot(round.landing.x - round.hole.pin.x, round.landing.z - round.hole.pin.z);
      hint = round.status === 'playing' ? 'Ball rolling.' : pinDistance(left, true) + ' left to the cup.';
    } else if (practice.phase === 'ready') {
      title = round.hole.name;
    }
  } else if (range.status === 'holed') {
    title = 'Practice cup holed';
    hint = 'A new ball is ready when you are.';
  } else if (range.hitTree) {
    title = 'Hit a tree';
    hint = 'Turn the aim or try a Crescent. Tap Next ball.';
  } else if (practice.phase === 'ready') {
    title = range.mode === 'driving' ? 'Practice tee' : range.hole.name;
  }

  if (spellNotice && (practice.phase === 'swing' || practice.phase === 'result')) hint = spellNotice + ' ' + hint;
  if (round?.manaRecovered > 0) hint += ' · +' + round.manaRecovered + ' mana';

  header.classList.toggle('pure-strike', Boolean(practice.impact?.pure));
  show(phase, title);
  show(prompt, hint);
  show(load, practice.phase === 'ready' ? '—' : Math.round(practice.charge * 100) + '%');
  show(carry, practice.carry === null ? '—' : formatYards(practice.carry));
  show(distance, practice.impact ? practice.impact.putt ? pinDistance(practice.distance, true) : formatYards(practice.distance) : '—');
}

function frame() {
  advance(performance.now());
  if (!soundedSwing && practice.phase === 'swing' && practice.elapsed >= .13) {
    audio.play({ base: 'swing' });
    soundedSwing = true;
  }
  if (!soundedShot) {
    const cue = shotCue(practice);
    if (cue) {
      audio.play(cue);
      soundedShot = true;
    }
  }
  if (!soundedCup && (round ?? range).status === 'holed') {
    audio.play({ base: 'cup' });
    soundedCup = true;
  }
  const { ball } = practice;
  const lastSample = flight.at(-1);
  const enchantedRoll = practice.impact?.putt && (practice.impact.royal || practice.spell?.type === 'texas-wedge') &&
    (round ?? range).status === 'playing';
  if (practice.impact && practice.carry === null && (ball.y > BALL_RADIUS || enchantedRoll) &&
      (!lastSample || practice.elapsed - lastSample.at >= 1 / 60)) {
    flight.push({ x: ball.x, y: ball.y, z: ball.z, at: practice.elapsed });
  }
  const putting = practice.clubType === 'putter';
  const drawing = practice.phase === 'drawing';
  const showingStart = practice.phase === 'ready' || drawing;
  const marked = gear.mode === 'guided' || (putting && !gear.armed);
  const guidedRune = gear.mode === 'guided' && gear.armed ? gear.rune : null;
  const guide = showingStart ? { ...guideLayout, marked, path: guidedRune?.path, shaft: guidedRune?.type === 'spear',
    channelOnly: pullStarted, charge: practice.charge } : null;
  const shortSide = Math.min(width, height);
  const trace = drawing && (!putting || gear.armed) ? points.map(point => ({ x: point.x * shortSide, y: point.y * shortSide })) : [];
  drawScene(ctx, width, height, practice, trace, flight, guide, round ?? range);
  updateFeedback();
  updateCourse();
  requestAnimationFrame(frame);
}

resize();
if (new URLSearchParams(location.search).has('course')) startRound();
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(frame);
