import { CLUB_HEADS, CLUBS } from './clubs.js';
import { MAX_MANA, SPELL_MANA_COST } from './mana.js';
import { rangeCard } from './range-card.js';
import { RUNES } from './spells.js';

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
  const bagButton = document.querySelector('#club-choice');
  const dialog = document.querySelector('#gear-dialog');
  const title = document.querySelector('#gear-title');
  const spellbook = document.querySelector('#spellbook');
  const bag = document.querySelector('#club-bag');
  const loadoutGrid = document.querySelector('#spell-loadout');
  const runeGrid = document.querySelector('#rune-grid');
  const spellbookNote = document.querySelector('#spellbook-note');
  const spellbookMana = document.querySelector('#spellbook-mana');
  const manaStat = document.querySelector('#mana-stat');
  const manaValue = document.querySelector('#mana-value');
  const clubGrid = document.querySelector('#club-grid');
  const bagRows = document.querySelector('#bag-ranges');
  const equipButton = document.querySelector('#equip-club');
  const modeIcon = 'M0 -11L3 -4L11 0L3 4L0 11L-3 4L-11 0L-3 -4Z M0 -5V5 M-5 0H5';
  let mode = 'guided';
  const loadout = ['crescent-right', 'spear', 'star'].map(id => RUNES.find(rune => rune.id === id));
  let activeSlot = 0;
  let shownMana;
  let equipped = null;
  let preview = null;
  const clubs = new Map();
  const runes = new Map();
  const slotButtons = loadout.map((_, index) => {
    const button = document.createElement('button');
    button.className = 'gear-slot';
    button.type = 'button';
    button.addEventListener('click', () => {
      activeSlot = index;
      drawSpellSlots();
      changeSpell();
    });
    loadoutGrid.append(button);
    return button;
  });

  function drawSpellSlots() {
    const rune = loadout[activeSlot];
    setSlot(modeButton, icon(modeIcon, '-14 -14 28 28'), 'Casting', mode === 'guided' ? 'Guided' : 'Hard');
    modeButton.setAttribute('aria-pressed', String(mode === 'hard'));
    setSlot(spellButton, runeIcon(rune), 'Spellbook', runeLabel(rune));
    spellButton.setAttribute('aria-label', 'Spellbook, ' + runeLabel(rune) + ' active');
    spellbookNote.textContent = mode === 'guided'
      ? 'The active slot sets the trace. Tap a rune below to equip it there.'
      : 'Draw any equipped rune. The active slot sets the planner. Tap a rune below to equip it there.';
    for (const [index, slot] of slotButtons.entries()) {
      const item = loadout[index];
      setSlot(slot, runeIcon(item), 'Slot ' + (index + 1), runeLabel(item));
      slot.setAttribute('aria-pressed', String(index === activeSlot));
    }
    for (const [id, { button, status }] of runes) {
      const slot = loadout.findIndex(item => item.id === id);
      button.setAttribute('aria-pressed', String(id === rune.id));
      status.textContent = slot === -1 ? 'Available' : 'Equipped · Slot ' + (slot + 1);
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
      'Pure uses ' + runeLabel(rune) + ' at 100% purity on a fairway.';
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
      drawSpellSlots();
      dialog.close();
      changeSpell();
    });
    runeGrid.append(button);
    runes.set(option.id, { button, status });
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
    get rune() { return loadout[activeSlot]; },
    hasRune(id) { return loadout.some(rune => rune.id === id); },
    update(club, enabled, mana = null) {
      if (mana !== shownMana) {
        shownMana = mana;
        manaStat.hidden = mana === null;
        const balance = mana === null ? '' : mana + '/' + MAX_MANA;
        manaValue.textContent = balance;
        spellbookMana.textContent = (mana === null ? 'Unlimited practice mana. ' : balance + ' mana. ') +
          'Course casts cost ' + SPELL_MANA_COST + ' mana. Purity and contact determine refunds.';
      }
      if (club !== equipped) {
        equipped = club;
        const profile = CLUBS[club];
        const label = profile.head === 'wedge' ? profile.short : profile.name;
        setSlot(bagButton, clubIcon(profile), 'Club bag', label);
        bagButton.setAttribute('aria-label', 'Club bag, ' + profile.name + ' equipped');
      }
      for (const button of [modeButton, spellButton, bagButton]) {
        if (button.disabled === enabled) button.disabled = !enabled;
      }
    },
  };
}
