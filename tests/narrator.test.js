import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createNarrator } from '../public/src/narrator.js';
import { VOICE_LINES, voiceUrl } from '../public/src/voice-lines.js';

class Voice extends EventTarget {
  paused = true;
  denied = false;
  played = [];
  play() {
    if (this.denied) return Promise.reject(Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' }));
    this.paused = false;
    this.played.push(this.src.split('/').at(-1));
    return Promise.resolve();
  }
  finish() {
    this.paused = true;
    this.dispatchEvent(new Event('ended'));
  }
  pause() { this.paused = true; }
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('every approved voice line has a bundled MP3 recording', () => {
  for (const [id, text] of Object.entries(VOICE_LINES)) {
    assert.ok(text.length > 0);
    const recording = readFileSync(new URL(voiceUrl(id)));
    assert.ok(recording.length > 2000, id);
    assert.equal(recording.subarray(0, 3).toString(), 'ID3', id);
  }
});

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const original = globalThis.document;
  const events = new EventTarget();
  globalThis.document = events;
  t.after(() => { globalThis.document = original; });
  const voice = new Voice();
  return { voice, events, narrator: createNarrator(voice) };
}

test('a blocked title survives a long wait and retries on a real gesture event', async t => {
  const { voice, events, narrator } = setup(t);
  voice.denied = true;
  narrator.say('title', { delay: 0 });
  await flush();
  t.mock.timers.tick(60000);
  voice.denied = false;
  events.dispatchEvent(new Event('pointerup'));
  await flush();
  assert.deepEqual(voice.played, ['dangolf.mp3']);
  voice.finish();
  t.mock.timers.tick(350);
  events.dispatchEvent(new Event('click'));
  assert.deepEqual(voice.played, ['dangolf.mp3']);
});

test('cast reactions and rare results serialize behind the title in priority order', async t => {
  const { voice, narrator } = setup(t);
  narrator.say('title', { delay: 0 });
  await flush();
  narrator.say('ace', { delay: 0, shot: 1 });
  narrator.say('damn-son', { delay: 0, shot: 1 });
  narrator.say('clean-snap', { delay: 0, shot: 1 });
  assert.deepEqual(voice.played, ['dangolf.mp3']);
  voice.finish();
  t.mock.timers.tick(350);
  await flush();
  assert.deepEqual(voice.played, ['dangolf.mp3', 'damn-son.mp3']);
  voice.finish();
  t.mock.timers.tick(350);
  await flush();
  assert.deepEqual(voice.played, ['dangolf.mp3', 'damn-son.mp3', 'ace.mp3']);
});

test('common quips cool down while every separate pure spell remains eligible', async t => {
  const { voice, narrator } = setup(t);
  narrator.say('tree', { delay: 0 });
  await flush();
  voice.finish();
  t.mock.timers.tick(15000);
  narrator.say('tree', { delay: 0 });
  narrator.say('damn-son', { delay: 0, shot: 2 });
  await flush();
  voice.finish();
  t.mock.timers.tick(350);
  narrator.say('damn-son', { delay: 0, shot: 3 });
  await flush();
  assert.deepEqual(voice.played, ['tree.mp3', 'damn-son.mp3', 'damn-son.mp3']);
});

test('reset discards common chatter and retains a third-chunk punchline', async t => {
  const { voice, narrator } = setup(t);
  narrator.say('clean-snap', { delay: 300 });
  narrator.say('chunk-dwarf', { delay: 300, shot: 3 });
  narrator.clearCommon();
  t.mock.timers.tick(300);
  await flush();
  assert.deepEqual(voice.played, ['chunk-dwarf.mp3']);
});

test('a failed clip releases the next queued voice instead of blocking narration', async t => {
  const { voice, narrator } = setup(t);
  narrator.say('damn-son', { delay: 0, shot: 1 });
  await flush();
  narrator.say('chip-in', { delay: 0, shot: 1 });
  voice.dispatchEvent(new Event('error'));
  t.mock.timers.tick(350);
  await flush();
  assert.deepEqual(voice.played, ['damn-son.mp3', 'chip-in.mp3']);
});

test('muting stops speech, clears queued jokes, and unmuting accepts only new reactions', async t => {
  const { voice, narrator } = setup(t);
  narrator.say('damn-son', { delay: 0, shot: 1 });
  await flush();
  narrator.say('chunk-dwarf', { delay: 0, shot: 2 });
  narrator.setMuted(true);
  assert.equal(narrator.muted, true);
  assert.equal(voice.paused, true);
  assert.equal(voice.muted, true);
  t.mock.timers.tick(5000);
  narrator.say('ace', { delay: 0 });
  narrator.setMuted(false);
  narrator.say('chip-in', { delay: 0, shot: 3 });
  await flush();
  assert.deepEqual(voice.played, ['damn-son.mp3', 'chip-in.mp3']);
});
