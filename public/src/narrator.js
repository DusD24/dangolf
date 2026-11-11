import { SECOND_TOP_LINES, THIRD_TOP_LINES, voiceUrl } from './voice-lines.js';

const FEATURED = new Set([...SECOND_TOP_LINES, ...THIRD_TOP_LINES,
  'title', 'damn-son', 'chunk-dwarf', 'chunk-delving', 'ace', 'chip-in',
  'hole-out', 'long-putt', 'royal', 'albatross', 'eagle', 'birdie-streak', 'par-save',
  'round-under', 'round-even', 'round-over', 'personal-best']);
const OPENERS = new Set(['round-start', 'back-nine', 'final-hole']);
const COMMON_GAP = 14000;
const REPEAT_GAP = 90000;

export function createNarrator(audio = new Audio()) {
  audio.preload = 'auto';
  audio.volume = .85;
  const events = globalThis.document;
  let muted = false;
  try { muted = globalThis.localStorage?.getItem('dangolf.narration-muted') === 'true'; } catch { /* Storage is optional. */ }
  audio.muted = muted;
  const gestures = ['pointerup', 'click', 'keydown'];
  const lastPlayed = new Map();
  let queue = [];
  let current = null;
  let starting = false;
  let blocked = false;
  let timer;
  let nextAt = 0;
  let lastSpeech = -Infinity;
  let parCount = 0;
  let sequence = 0;

  function wake(delay) {
    clearTimeout(timer);
    timer = setTimeout(pump, Math.max(0, delay));
  }

  function start() {
    starting = true;
    const entry = current;
    audio.play().then(() => {
      if (current !== entry) return;
      starting = false;
      lastSpeech = Date.now();
      lastPlayed.set(entry.id, lastSpeech);
    }).catch(error => {
      if (current !== entry) return;
      starting = false;
      current = null;
      if (error.name === 'NotAllowedError') {
        blocked = true;
        queue.push(entry);
      } else {
        wake(350);
      }
    });
  }

  function pump() {
    if (muted || current || blocked) return;
    const now = Date.now();
    queue = queue.filter(entry => entry.expires > now);
    if (!queue.length) return;
    if (now < nextAt) {
      wake(nextAt - now);
      return;
    }
    const ready = queue.filter(entry => entry.at <= now)
      .sort((a, b) => b.priority - a.priority || a.order - b.order);
    if (!ready.length) {
      wake(Math.min(...queue.map(entry => entry.at)) - now);
      return;
    }
    const entry = ready[0];
    queue = queue.filter(item => item !== entry);
    if (!entry.important && !OPENERS.has(entry.id) &&
        (now - lastSpeech < COMMON_GAP || now - (lastPlayed.get(entry.id) ?? -Infinity) < REPEAT_GAP)) {
      pump();
      return;
    }
    current = entry;
    audio.src = voiceUrl(entry.id);
    start();
  }

  function completed() {
    current = null;
    starting = false;
    nextAt = Date.now() + 350;
    wake(350);
  }
  audio.addEventListener('ended', completed);
  audio.addEventListener('error', completed);

  function gesture() {
    if (muted) return;
    blocked = false;
    if (current && audio.paused && !starting) start();
    else pump();
  }
  for (const event of gestures) events?.addEventListener(event, gesture, true);

  return {
    get muted() { return muted; },
    setMuted(value) {
      muted = Boolean(value);
      audio.muted = muted;
      try { globalThis.localStorage?.setItem('dangolf.narration-muted', String(muted)); } catch { /* Storage is optional. */ }
      if (muted) {
        audio.pause();
        queue = [];
        current = null;
        starting = false;
        blocked = false;
        clearTimeout(timer);
        nextAt = Date.now();
      }
    },
    say(id, { important = FEATURED.has(id), delay = 300, shot = null } = {}) {
      voiceUrl(id);
      if (muted) return;
      if (id === 'par' && ++parCount % 3 !== 0) return;
      const now = Date.now();
      if (!important && !OPENERS.has(id) &&
          (current || now - lastSpeech < COMMON_GAP || now - (lastPlayed.get(id) ?? -Infinity) < REPEAT_GAP)) return;
      if (queue.some(entry => entry.id === id && entry.shot === shot)) return;
      const priority = id === 'title' ? 100 : id === 'damn-son' ? 90 : important ? 80 : OPENERS.has(id) ? 30 : 10;
      queue.push({ id, important, priority, shot, order: sequence++, at: now + delay,
        expires: id === 'title' ? Infinity : important ? now + 30000 : now + 7000 });
      // Only the strongest pending common observation is worth retaining.
      const common = queue.filter(entry => !entry.important).sort((a, b) => b.priority - a.priority || b.order - a.order);
      queue = queue.filter(entry => entry.important || entry === common[0]);
      pump();
    },
    clearCommon() {
      queue = queue.filter(entry => entry.important);
    },
  };
}
