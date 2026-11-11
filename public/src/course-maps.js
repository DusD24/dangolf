import { CLUBS } from './clubs.js';
import { surfaceAt } from './course.js';
import { greenRead, hazardsOnAim, landingOnAim, pinDistance, puttAimTarget } from './course-map.js';
import { drawHoleMap } from './course-view.js';
import { METERS_PER_YARD } from './practice.js';
import { manaPlan, puttManaPlan } from './mana.js';
import { POWER_MARKS, PREVIEW_PURITY, shotRanges } from './range-card.js';

const labels = { fairway: 'Fairway', rough: 'Rough', green: 'Green', water: 'Water', sand: 'Bunker',
  trees: 'Trees', out: 'Out of bounds' };
const stockColor = '#b8f2dc';
const snapColor = '#dcb1ff';
const spellColor = '#f4d094';
const spellSnapColor = '#9dc8ff';
const yards = meters => Math.round(meters / METERS_PER_YARD) + ' yd';
const feet = meters => Math.round(meters / .3048) + ' ft';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function crossingLabel({ type, from, to }) {
  const near = Math.floor(from / METERS_PER_YARD);
  const far = Math.ceil(to / METERS_PER_YARD);
  return labels[type] + ' ' + near + '–' + far + ' yd';
}

function makeButton(text, title, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', action);
  return button;
}

export function createCourseMaps({ dialog, equipClub, setAim, selectedSpell, selectRangeMode, selectRangeTarget }) {
  const get = id => document.getElementById(id);
  const mini = get('mini-course');
  const miniCanvas = get('mini-map');
  const miniCaption = get('mini-caption');
  const map = get('map-content');
  const canvas = get('map-canvas');
  const aimAtPin = get('aim-at-pin');
  const clubs = new Map();
  const powers = new Map();
  const stations = new Map();
  const targets = new Map();
  const planDetails = [...map.querySelectorAll('[data-plan]')];
  let round;
  let ball;
  let ready = false;
  let power = 100;
  let crossings = [];
  let estimates = [];
  let screenToWorld = null;
  let previousKey = '';
  let previousAim = null;

  for (const [id, label] of Object.entries({ driving: 'Tee', rough: 'Rough', sand: 'Sand', putting: 'Green', fringe: 'Fringe' })) {
    const button = makeButton(label, 'Practice from ' + label.toLowerCase(), () => {
      if (selectRangeMode(id)) renderPlanner();
    });
    button.dataset.rangeMode = id;
    stations.set(id, button);
    get('range-stations').append(button);
  }

  for (const [id, club] of Object.entries(CLUBS)) {
    const button = makeButton(club.short, club.name, () => {
      if (ready && equipClub(id)) renderPlanner();
    });
    button.dataset.mapClub = id;
    clubs.set(id, button);
    get('map-clubs').append(button);
  }
  for (const value of POWER_MARKS) {
    const button = makeButton(value + '%', 'Preview ' + value + '% power', () => {
      power = value;
      renderPlanner();
      get('map-ranges').scrollIntoView({ block: 'nearest' });
    });
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.append(button);
    powers.set(value, button);
    get('map-powers').append(cell);
  }

  function renderChart() {
    screenToWorld = drawHoleMap(canvas, round, ball, { crossings, estimates });
    get('map-pin').textContent = pinDistance(distance(ball, round.hole.pin),
      round.club === 'putter' || surfaceAt(round.hole, ball) === 'green');
  }

  function renderRanges() {
    const putter = round.club === 'putter';
    const { rune, mode } = selectedSpell();
    const ranges = putter ? POWER_MARKS.map(power => {
      const { distance, point } = round.previewPutt(power / 100);
      return { power, stock: distance, point };
    }) : shotRanges(round.club, round.surface, rune, mode);
    const display = putter ? feet : yards;
    const selected = ranges.find(row => row.power === power);
    get('map-club-name').textContent = CLUBS[round.club].name;
    get('map-metric').textContent = (putter ? 'Roll · ft' : 'Carry · yd') + ' · ' +
      (!round.isPractice && round.atTee ? 'Tee' : labels[round.surface]);
    get('map-range-note').textContent = putter ? 'Plain roll from this aim, including slope. Marker shows where it would stop past the cup.' :
      'Spell uses ' + rune.name + ' at ' + Math.round(PREVIEW_PURITY * 100) + '% purity in ' +
      (mode === 'guided' ? 'Guided' : 'Hard') + '.';
    get('map-mana-plan').textContent = round.isPractice ? 'Unlimited practice mana. Try every spell and repeat the same shot.' :
      putter ? puttManaPlan(round.mana, round.puttingRune) : manaPlan(round.mana);

    for (const [id, button] of clubs) {
      button.setAttribute('aria-pressed', String(id === round.club));
    }
    for (const [value, button] of powers) button.setAttribute('aria-pressed', String(value === power));

    const rows = get('map-ranges');
    rows.replaceChildren();
    const modes = putter ? [['Roll', 'stock', stockColor]] : [
      ['Plain', 'stock', stockColor], ['Snap', 'snap', snapColor],
      ['Spell', 'spell', spellColor], ['Spell + snap', 'spellSnap', spellSnapColor],
    ];
    for (const [name, key] of modes) {
      const row = rows.insertRow();
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = name;
      row.append(heading);
      for (const item of ranges) {
        const cell = row.insertCell();
        cell.textContent = display(item[key]);
        cell.classList.toggle('picked', item.power === power);
      }
    }
    return modes.map(([name, key, color]) => {
      if (putter) return { name, color, point: selected.point, surface: surfaceAt(round.hole, selected.point) };
      const landing = selected[key + 'Landing'];
      if (!landing) return { name, color, ...landingOnAim(round, selected[key]) };
      const point = round.worldPoint(landing);
      return { name, color, point, surface: surfaceAt(round.hole, point) };
    });
  }

  function renderPlanner() {
    const putter = round.club === 'putter';
    const training = Boolean(round.isPractice);
    get('range-options').hidden = !training;
    if (training) {
      get('dialog-title').textContent = round.hole.name;
      for (const [mode, button] of stations) {
        button.setAttribute('aria-pressed', String(mode === round.mode));
        button.disabled = round.status === 'playing';
      }
      if (!targets.size) {
        for (const target of round.targets) {
          const button = makeButton(target.label, 'Aim at ' + target.label + ' target', () => {
            if (selectRangeTarget(target.id)) renderPlanner();
          });
          button.dataset.rangeTarget = target.id;
          targets.set(target.id, button);
          get('range-targets').append(button);
        }
      }
      const short = round.mode === 'putting' || round.mode === 'fringe';
      get('range-targets').hidden = get('range-target-label').hidden = short;
      for (const [id, button] of targets) {
        button.setAttribute('aria-pressed', String(id === round.selectedTarget.id));
        button.disabled = round.status === 'playing';
      }
    }
    get('map-planner').hidden = !ready;
    estimates = ready ? renderRanges() : [];
    for (const detail of planDetails) detail.hidden = !ready;
    map.querySelector('.key-stock').textContent = putter ? 'Roll' : 'Plain';
    map.querySelector('.key-snap').hidden = !ready || putter;
    map.querySelector('.key-spell').hidden = !ready || putter;
    map.querySelector('.key-spell-snap').hidden = !ready || putter;
    aimAtPin.hidden = !ready;
    aimAtPin.textContent = training && !putter ? 'Aim at target' : 'Aim at pin';
    get('putt-aim').hidden = !ready || !putter;
    get('map-target-wrap').hidden = !ready;
    get('map-target').textContent = pinDistance(distance(round.lie, round.aimTarget), putter || round.surface === 'green');
    get('map-hazards').textContent = putter && round.remaining < 33 ? greenRead(round) + ' · Arrows point downhill.' : crossings.length
      ? 'Along straight aim · ' + crossings.slice(0, 3).map(crossingLabel).join(' · ') +
        (crossings.length > 3 ? ' · +' + (crossings.length - 3) + ' more' : '')
      : 'Aim line clear of hazards and trees';
    get('map-landing').textContent = power + '% · ' +
      estimates.map(({ name, surface }) => name + ' → ' + labels[surface]).join(' · ');
    get('map-tip').textContent = putter ? 'Tap the map to pick a line. Use the aim buttons for ½° adjustments.' :
      round.hole.tip + (ready ? ' Tap the map to change aim.' : '');
    renderChart();
  }

  function aim(point) {
    if (ready && setAim(point)) {
      crossings = hazardsOnAim(round.hole, round.lie, round.forward);
      renderPlanner();
    }
  }

  aimAtPin.addEventListener('click', () => aim(round.hole.pin));
  function nudgeAim(direction) {
    aim(puttAimTarget(round, direction));
  }
  get('putt-left').addEventListener('click', () => nudgeAim(-1));
  get('putt-right').addEventListener('click', () => nudgeAim(1));
  canvas.addEventListener('click', event => {
    const bounds = canvas.getBoundingClientRect();
    if (screenToWorld) aim(screenToWorld(event.clientX - bounds.left - canvas.clientLeft,
      event.clientY - bounds.top - canvas.clientTop));
  });
  new ResizeObserver(() => {
    if (dialog.open && !map.hidden) renderChart();
  }).observe(canvas);

  return {
    open() {
      if (!round || dialog.open) return;
      get('dialog-title').textContent = round.isPractice ? round.hole.name : (round.index + 1) + ' · ' + round.hole.name;
      get('card-content').hidden = true;
      map.hidden = false;
      dialog.classList.add('chart-dialog');
      dialog.showModal();
      renderPlanner();
    },
    update(activeRound, activeBall, canPlan) {
      mini.hidden = !activeRound;
      if (!activeRound) {
        round = null;
        previousAim = null;
        previousKey = '';
        return;
      }
      const plannerChanged = round !== activeRound || ready !== canPlan || previousAim !== activeRound.aimTarget;
      if (round !== activeRound || previousAim !== activeRound.aimTarget) {
        crossings = hazardsOnAim(activeRound.hole, activeRound.lie, activeRound.forward);
        previousAim = activeRound.aimTarget;
      }
      if (round !== activeRound) power = 100;
      round = activeRound;
      ball = activeBall;
      ready = canPlan;
      const caption = round.club === 'putter' && round.remaining < 33 ? 'Green read' : round.isPractice ? round.selectedTarget.label + ' target' :
        ready && crossings.length ? crossingLabel(crossings[0]) : 'Hole map';
      if (miniCaption.textContent !== caption) miniCaption.textContent = caption;
      const key = [round.index, round.mode, round.history?.length, round.status, round.club, round.aim, ball.x, ball.z,
        miniCanvas.clientWidth, miniCanvas.clientHeight].join('/');
      const moved = plannerChanged || key !== previousKey;
      if (moved) {
        drawHoleMap(miniCanvas, round, ball, { compact: true, crossings });
        previousKey = key;
      }
      if (dialog.open && !map.hidden) {
        if (plannerChanged) renderPlanner();
        else if (moved) renderChart();
      }
    },
  };
}
