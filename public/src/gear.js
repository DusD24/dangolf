import { CLUB_HEADS, CLUBS } from './clubs.js';
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
  const runeGrid = document.querySelector('#rune-grid');
  const clubGrid = document.querySelector('#club-grid');
  const bagRows = document.querySelector('#bag-ranges');
  const equipButton = document.querySelector('#equip-club');
  const modeIcon = 'M0 -11L3 -4L11 0L3 4L0 11L-3 4L-11 0L-3 -4Z M0 -5V5 M-5 0H5';
  let mode = 'guided';
  let rune = RUNES.find(item => item.id === 'crescent-right');
  let equipped = null;
  let preview = null;
  const clubs = new Map();
  const runes = new Map();

  function drawSpellSlots() {
    setSlot(modeButton, icon(modeIcon, '-14 -14 28 28'), 'Casting', mode === 'guided' ? 'Guided' : 'Hard');
    modeButton.setAttribute('aria-pressed', String(mode === 'hard'));
    setSlot(spellButton, runeIcon(rune), 'Spellbook', runeLabel(rune));
    spellButton.hidden = mode === 'hard';
  }

  function previewClub(id) {
    preview = id;
    for (const [key, button] of clubs) button.setAttribute('aria-pressed', String(key === id));
    const club = CLUBS[id];
    document.querySelector('#bag-selected').textContent = club.name;
    document.querySelector('#bag-metric').textContent = id === 'putter' ? 'Roll · yd' : 'Carry · yd';
    bagRows.replaceChildren();
    for (const row of rangeCard(id)) {
      const item = document.createElement('tr');
      item.append(textElement('th', row.power + '%'), textElement('td', row.stock),
        textElement('td', row.snap ?? '—'));
      bagRows.append(item);
    }
    equipButton.textContent = 'Equip ' + club.name;
  }

  for (const option of RUNES) {
    const button = document.createElement('button');
    button.type = 'button';
    const description = option.type === 'crescent' ? 'Bend the flight' :
      option.type === 'spear' ? 'Low running shot' : 'Extra launch power';
    button.append(runeIcon(option), textElement('strong', runeLabel(option)), textElement('small', description));
    button.addEventListener('click', () => {
      rune = option;
      drawSpellSlots();
      dialog.close();
      changeSpell();
    });
    runeGrid.append(button);
    runes.set(option.id, button);
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
    for (const [id, button] of runes) button.setAttribute('aria-pressed', String(rune.id === id));
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
    get rune() { return rune; },
    update(club, enabled) {
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
