import { CLUB_HEADS, CLUBS } from './clubs.js';
import { manaPlan, MAX_MANA, puttManaPlan, spellManaCost, SPELL_MANA_COST } from './mana.js';
import { PREVIEW_PURITY, rangeCard } from './range-card.js';
import { PUTTING_RUNES, RUNES } from './spells.js';

const SVG = 'http://www.w3.org/2000/svg';
const runeLabel = rune => rune.type === 'crescent' ? rune.name + (rune.direction > 0 ? ' →' : ' ←') : rune.name;

function icon(path, viewBox, filled = false) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(SVG, 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill', filled ? 'currentColor' : 'none');
  shape.setAttribute('stroke', 'currentColor');
  shape.setAttribute('stroke-width', filled ? '.7' : '1.45');
  shape.setAttribute('stroke-linejoin', 'round');
  svg.append(shape);
  return svg;
}

function runeIcon(rune) {
  const path = rune.path.map(([x, y], i) => (i ? 'L' : 'M') +
    (x * 18).toFixed(2) + ' ' + (y * 18 + 9).toFixed(2)).join(' ');
  return icon(path, '-13 -13 26 26');
}

function clubIcon(club) {
  return icon(CLUB_HEADS[club.head], '-16 -14 32 28', true);
}

function textElement(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function setSlot(button, mark, label, value) {
  const copy = document.createElement('span');
  copy.append(textElement('small', label), textElement('strong', value));
  button.replaceChildren(mark, copy);
}

export function createGear({ equip, changeSpell }) {
  const modeButton = document.querySelector('#spell-mode');
  const spellButton = document.querySelector('#rune-guide');
  const cancelSpell = document.querySelector('#cancel-spell');
  const bagButton = document.querySelector('#club-choice');
  const dialog = document.querySelector('#gear-dialog');
  const title = document.querySelector('#gear-title');
  const spellbook = document.querySelector('#spellbook');
  const bag = document.querySelector('#club-bag');
  const loadoutGrid = document.querySelector('#spell-loadout');
  const runeGrid = document.querySelector('#rune-grid');
  const puttGrid = document.querySelector('#putting-runes');
  const puttNote = document.querySelector('#putting-rune-note');
  const spellbookNote = document.querySelector('#spellbook-note');
  const spellbookMana = document.querySelector('#spellbook-mana');
  const manaStat = document.querySelector('#mana-stat');
  const manaValue = document.querySelector('#mana-value');
  const clubGrid = document.querySelector('#club-grid');
  const bagRows = document.querySelector('#bag-ranges');
  const bagManaPlan = document.querySelector('#bag-mana-plan');
  const equipButton = document.querySelector('#equip-club');
  const modeIcon = 'M0 -11L3 -4L11 0L3 4L0 11L-3 4L-11 0L-3 -4Z M0 -5V5 M-5 0H5';
  let mode = 'guided';
  const loadout = ['crescent-right', 'spear', 'star'].map(id => RUNES.find(rune => rune.id === id));
  let activeSlot = 0;
  let armed = true;
  let puttRune = null;
  let puttingLie = null;
  let shownMana;
  let equipped = null;
  let preview = null;
  const clubs = new Map();
  const runes = new Map();
  const puttRunes = new Map();
  const slotButtons = loadout.map((_, index) => {
    const button = document.createElement('button');
    button.className = 'gear-slot';
    button.type = 'button';
    button.addEventListener('click', () => {
      activeSlot = index;
      armed = true;
      drawSpellSlots();
      changeSpell();
    });
    loadoutGrid.append(button);
    return button;
  });

  function drawSpellSlots() {
    const rune = loadout[activeSlot];
    const putting = equipped === 'putter';
    const selected = putting ? puttRune : armed ? rune : null;
    setSlot(modeButton, icon(modeIcon, '-14 -14 28 28'), 'Casting', mode === 'guided' ? 'Guided' : 'Hard');
    modeButton.setAttribute('aria-pressed', String(mode === 'hard'));
    const shot = selected ? runeLabel(selected) : putting ? 'Plain putt' : 'Plain shot';
    const mark = selected ? runeIcon(selected) : icon('M0 -8V8 M-5 3L0 8L5 3', '-13 -13 26 26');
    setSlot(spellButton, mark, 'Spellbook', shot);
    spellButton.classList.toggle('putt-spell', putting && Boolean(selected));
    spellButton.setAttribute('aria-label', 'Spellbook, ' + shot);
    spellbookNote.textContent = mode === 'guided'
      ? 'Pick a slot to arm its trace, or tap a rune below to equip it.'
      : 'Pick a slot to arm casting. Draw any equipped rune. The selected slot sets the planner.';
    for (const node of [spellbookNote, loadoutGrid, runeGrid]) node.hidden = putting;
    puttGrid.hidden = puttNote.hidden = !putting && !puttingLie;
    for (const [index, slot] of slotButtons.entries()) {
      const item = loadout[index];
      setSlot(slot, runeIcon(item), 'Slot ' + (index + 1), runeLabel(item));
      slot.setAttribute('aria-pressed', String(armed && index === activeSlot));
    }
    for (const [id, { button, status }] of runes) {
      const slot = loadout.findIndex(item => item.id === id);
      button.setAttribute('aria-pressed', String(armed && id === rune.id));
      status.textContent = slot === -1 ? 'Available' : 'Equipped · Slot ' + (slot + 1);
    }
    for (const [option, { button, status }] of puttRunes) {
      const cost = spellManaCost(option.type);
      const valid = option.type === puttingLie;
      const short = Math.max(0, cost - shownMana);
      button.disabled = !valid || short > 0;
      button.setAttribute('aria-pressed', String(puttRune === option));
      status.textContent = cost + ' mana · ' + (valid ? short > 0 ? 'Need ' + short + ' more' : 'Ready' :
        option.type === 'royal-flush' ? 'On the green only' : 'From the fringe only');
    }
  }

  function previewClub(id) {
    preview = id;
    for (const [key, button] of clubs) button.setAttribute('aria-pressed', String(key === id));
    const club = CLUBS[id];
    const putting = id === 'putter';
    const rune = loadout[activeSlot];
    document.querySelector('#bag-selected').textContent = club.name;
    document.querySelector('#bag-metric').textContent = putting ? 'Roll · yd' : 'Carry · yd';
    document.querySelector('#bag-range-note').textContent = putting ? 'Flat range estimate.' :
      'Spell uses ' + runeLabel(rune) + ' at ' + Math.round(PREVIEW_PURITY * 100) + '% purity on a fairway.';
    bagManaPlan.hidden = shownMana === null;
    if (shownMana !== null) bagManaPlan.textContent = putting ? puttManaPlan(shownMana, puttingLie) : manaPlan(shownMana);
    for (const heading of bag.querySelectorAll('[data-spell-range]')) heading.hidden = putting;
    bagRows.replaceChildren();
    for (const row of rangeCard(id, rune, mode)) {
      const item = document.createElement('tr');
      item.append(textElement('th', row.power + '%'), textElement('td', row.stock),
        textElement('td', row.snap ?? '—'));
      if (!putting) item.append(textElement('td', row.spell), textElement('td', row.spellSnap));
      bagRows.append(item);
    }
    equipButton.textContent = 'Equip ' + club.name;
  }

  for (const option of RUNES) {
    const button = document.createElement('button');
    button.type = 'button';
    const description = option.type === 'crescent' ? 'Bend the flight' :
      option.type === 'spear' ? 'Low running shot' : 'Extra launch power';
    const status = textElement('small', '');
    status.className = 'rune-status';
    button.append(runeIcon(option), textElement('strong', runeLabel(option)),
      textElement('small', description), status);
    button.addEventListener('click', () => {
      const slot = loadout.indexOf(option);
      if (slot === -1) loadout[activeSlot] = option;
      else activeSlot = slot;
      armed = true;
      drawSpellSlots();
      dialog.close();
      changeSpell();
    });
    runeGrid.append(button);
    runes.set(option.id, { button, status });
  }

  for (const option of PUTTING_RUNES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.puttRune = option.id;
    const description = option.type === 'royal-flush' ? '90% purity sinks the putt' : 'Roll smoothly from the fringe';
    const status = textElement('small', '');
    status.className = 'rune-status';
    button.append(runeIcon(option), textElement('strong', option.name), textElement('small', description), status);
    button.addEventListener('click', () => {
      if (equipped !== 'putter' && !equip('putter')) return;
      puttRune = option;
      drawSpellSlots();
      dialog.close();
      changeSpell();
    });
    puttGrid.append(button);
    puttRunes.set(option, { button, status });
  }

  for (const [id, club] of Object.entries(CLUBS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.club = id;
    button.setAttribute('aria-label', club.name);
    button.append(clubIcon(club), textElement('strong', club.short), textElement('small', club.name));
    button.addEventListener('click', () => previewClub(id));
    clubGrid.append(button);
    clubs.set(id, button);
  }

  modeButton.addEventListener('click', () => {
    mode = mode === 'guided' ? 'hard' : 'guided';
    drawSpellSlots();
    changeSpell();
  });
  cancelSpell.addEventListener('click', () => {
    armed = false;
    puttRune = null;
    drawSpellSlots();
    changeSpell();
  });
  spellButton.addEventListener('click', () => {
    title.textContent = 'Spellbook';
    spellbook.hidden = false;
    bag.hidden = true;
    dialog.showModal();
  });
  bagButton.addEventListener('click', () => {
    title.textContent = 'The Club Bag';
    spellbook.hidden = true;
    bag.hidden = false;
    previewClub(equipped);
    dialog.showModal();
  });
  equipButton.addEventListener('click', () => {
    if (equip(preview)) dialog.close();
  });

  drawSpellSlots();
  return {
    get mode() { return mode; },
    get swingRune() { return loadout[activeSlot]; },
    get rune() { return equipped === 'putter' ? puttRune : loadout[activeSlot]; },
    get armed() { return equipped === 'putter' ? Boolean(puttRune) : armed; },
    setShotSpell(id) {
      puttRune = null;
      const slot = loadout.findIndex(rune => rune.id === id);
      armed = slot >= 0;
      if (armed) activeSlot = slot;
      drawSpellSlots();
    },
    hasRune(id) { return loadout.some(rune => rune.id === id); },
    update(club, enabled, mana = null, lieRune = null) {
      const refreshSpells = mana !== shownMana || club !== equipped || lieRune !== puttingLie;
      puttingLie = lieRune;
      if (club !== 'putter' || puttRune?.type !== puttingLie) puttRune = null;
      if (mana !== shownMana) {
        shownMana = mana;
        manaStat.hidden = mana === null;
        const balance = mana === null ? '' : mana + '/' + MAX_MANA;
        manaValue.textContent = balance;
        spellbookMana.textContent = (mana === null ? 'Unlimited practice mana. ' : balance + ' mana. ') +
          'Swing spells cost ' + SPELL_MANA_COST + ' mana. Purity and contact determine refunds.';
      }
      if (club !== equipped) {
        equipped = club;
        const profile = CLUBS[club];
        const label = profile.head === 'wedge' ? profile.short : profile.name;
        setSlot(bagButton, clubIcon(profile), 'Club bag', label);
        bagButton.setAttribute('aria-label', 'Club bag, ' + profile.name + ' equipped');
      }
      if (refreshSpells) drawSpellSlots();
      for (const button of [modeButton, spellButton, bagButton, cancelSpell]) {
        if (button.disabled === enabled) button.disabled = !enabled;
      }
    },
  };
}
