import { MAX_MANA } from './mana.js';
import { METERS_PER_YARD } from './practice.js';
import { Round } from './round.js';

const meters = yards => yards * METERS_PER_YARD;
const MODES = ['driving', 'rough', 'sand', 'putting', 'fringe'];
const DEFAULT_CLUB = { driving: 'driver', rough: 'iron7', sand: 'sand', putting: 'putter', fringe: 'putter' };
const SHORT_GAME = mode => mode === 'putting' || mode === 'fringe';
const DEGREES = Math.PI / 180;

function makeTargets() {
  return [50, 100, 150, 200, 250, 300].map((yards, index) => ({
    id: String(yards), label: yards + ' yd', yards,
    x: meters(yards), z: meters([-15, 20, -24, 25, 0, 32][index]),
    rx: meters(6 + index * 1.3), rz: meters(5 + index),
  }));
}

function perimeterTrees(shortGame = false) {
  const trees = [];
  for (const side of [-1, 1]) {
    for (const row of [0, 1]) {
      for (let yard = shortGame ? -15 : 24; yard < (shortGame ? 72 : 396); yard += 11 + row * 4) {
        const seed = yard + side * 73 + row * 29;
        const radius = meters(4.6 + Math.sin(seed * 2.4));
        const edge = shortGame ? 30 : Math.min(196, 27 + yard * .76);
        trees.push({
          x: meters(yard + 2 * Math.sin(seed)),
          z: side * meters(edge + row * 12 + 2 * Math.cos(seed)),
          radius, height: 12 + 2.5 * Math.cos(seed * 1.6),
        });
      }
    }
  }
  return trees;
}

function makeField(mode, targets, selected) {
  const greens = targets.map(target => ({ ...target, slope: { x: 0, z: 0 } }));
  const green = greens.find(item => item.id === selected.id);
  return {
    name: { driving: 'Moonfen Driving Range', rough: 'Rough Practice', sand: 'Bunker Practice' }[mode],
    par: 0, yards: selected.yards, tee: { x: 0, z: 0 },
    pin: { x: selected.x, z: selected.z }, target: { x: selected.x, z: selected.z },
    green, greens,
    fairway: [[-10, 18], [0, 20], [50, 32], [100, 48], [200, 85], [350, 140], [400, 155]]
      .map(([x, width]) => ({ x: meters(x), z: 0, width: meters(width) })),
    hazards: mode === 'driving' ? [] : [{ type: mode, x: 0, z: 0, rx: 6, rz: 8 }],
    trees: perimeterTrees(),
    bounds: { minX: meters(-30), maxX: meters(400), minZ: meters(-220), maxZ: meters(220) },
    tip: 'Choose a target, set your aim, and practice any shot. Mana is unlimited.',
  };
}

function makeShortGame(mode) {
  const pin = { x: 24, z: 0 };
  const green = { ...pin, rx: 14, rz: 14, slope: { x: -.012, z: .025 } };
  const tee = { x: pin.x - (mode === 'putting' ? 9 : green.rx + 2.3), z: 0 };
  return {
    name: mode === 'putting' ? 'Moonfen Putting Green' : 'Moonfen Fringe Practice',
    par: 0, yards: (pin.x - tee.x) / METERS_PER_YARD, tee, pin, target: { ...pin },
    green, greens: [green],
    fairway: [{ x: -10, z: 0, width: 21 }, { x: 60, z: 0, width: 21 }],
    hazards: mode === 'fringe' ? [{ type: 'rough', ...tee, rx: 2, rz: 3 }] : [],
    trees: perimeterTrees(true),
    bounds: { minX: -30, maxX: 90, minZ: -60, maxZ: 60 },
    tip: mode === 'putting' ? 'Read the slope or draw a Royal Flush. Mana is unlimited.' :
      'Putt through the fringe or draw a Texas Wedge. Mana is unlimited.',
  };
}

export class PracticeRange extends Round {
  constructor() {
    const targets = makeTargets();
    super([makeField('driving', targets, targets[4])]);
    this.isPractice = true;
    this.mode = 'driving';
    this.targets = targets;
    this.targetId = targets[4].id;
    this.modeClubs = {};
    this.history = [];
    this.club = 'driver';
    this.setAim(this.hole.pin);
  }

  get selectedTarget() {
    if (SHORT_GAME(this.mode)) return { id: 'cup', label: 'Practice cup', yards: this.hole.yards, ...this.hole.green };
    return this.targets.find(target => target.id === this.targetId);
  }

  get lastShot() { return this.history.at(-1) ?? null; }

  restart(practice) {
    const target = this.aimTarget ?? this.hole.pin;
    this.teeOff();
    this.notice = '';
    this.hitTree = false;
    this.landing = null;
    this.previous = null;
    this.attemptedSpell = false;
    this.mana = MAX_MANA;
    this.manaRecovered = 0;
    this.card.length = 0;
    this.setAim(target);
    this.configure(practice);
    return true;
  }

  prepare(practice) { return this.restart(practice); }

  next(practice) { return this.restart(practice); }

  setMode(mode, practice) {
    if (!MODES.includes(mode) || this.status === 'playing') return false;
    this.modeClubs[this.mode] = this.club;
    const changed = mode !== this.mode;
    this.mode = mode;
    const selected = this.targets.find(target => target.id === this.targetId);
    this.holes = [SHORT_GAME(mode) ? makeShortGame(mode) : makeField(mode, this.targets, selected)];
    this.club = this.modeClubs[mode] ?? DEFAULT_CLUB[mode];
    if (changed) this.aimTarget = { ...this.hole.pin };
    return this.restart(practice);
  }

  selectTarget(id, practice) {
    if (SHORT_GAME(this.mode) || this.status === 'playing') return false;
    const target = this.targets.find(item => item.id === String(id));
    if (!target) return false;
    this.targetId = target.id;
    this.hole.pin = { x: target.x, z: target.z };
    this.hole.target = { ...this.hole.pin };
    this.hole.green = this.hole.greens.find(green => green.id === target.id);
    this.hole.yards = target.yards;
    this.aimTarget = { ...this.hole.pin };
    return this.restart(practice);
  }

  selectClub(club, practice) {
    if (!super.selectClub(club, practice)) return false;
    this.modeClubs[this.mode] = club;
    return true;
  }

  nudgeAim(direction) {
    if (this.status !== 'ready' || !Number.isFinite(direction) || !direction) return false;
    const short = SHORT_GAME(this.mode);
    let angle = this.aim + Math.sign(direction) * (short ? .5 : 1) * DEGREES;
    if (!short) angle = Math.max(-35 * DEGREES, Math.min(35 * DEGREES, angle));
    const distance = Math.max(1, Math.hypot(this.aimTarget.x - this.lie.x, this.aimTarget.z - this.lie.z));
    return this.setAim({ x: this.lie.x + Math.cos(angle) * distance, z: this.lie.z + Math.sin(angle) * distance });
  }

  canCast() { return true; }

  startShot(attemptedSpell = false) {
    if (!super.startShot(false)) return false;
    this.attemptedSpell = attemptedSpell;
    this.strokes = 0;
    this.mana = MAX_MANA;
    return true;
  }

  track(practice) {
    super.track(practice);
    // Round still performs the real cup capture, but practice never builds a scorecard.
    this.card.length = 0;
    this.strokes = 0;
  }

  endShot(practice, lie) {
    if (this.status !== 'playing') return;
    this.mana = MAX_MANA;
    super.endShot(practice, lie);
    if (!practice.impact) return;
    const point = this.worldPoint(practice.ball);
    const target = { ...this.selectedTarget };
    this.history.push({
      mode: this.mode, club: this.club, power: practice.charge,
      purity: practice.spell?.purity ?? null, spell: practice.spell?.type ?? null,
      snap: Boolean(practice.impact.snapQuality), carry: practice.carry ?? 0,
      total: practice.distance, point, target,
      error: Math.hypot(point.x - target.x, point.z - target.z),
    });
    if (this.history.length > 8) this.history.shift();
  }
}
