import { TEE_X } from './practice.js';

export function shotCue(practice) {
  const { phase, impact, turfAt, spell } = practice;
  const rune = spell?.type ?? null;
  if (turfAt !== null && (!impact || turfAt <= impact.at)) {
    return { base: 'turf', rune, success: false, blast: false };
  }
  if (impact?.putt) return { base: 'putt', rune: null, success: true, blast: false };
  if (impact) {
    const blast = rune === 'star' && impact.spellEnergy >= 1.25;
    const clean = Math.abs(practice.steer) < 0.22 &&
      (practice.castLabel === 'Clean snap' || (spell?.purity ?? 0) >= 0.86);
    const cue = { base: blast || clean || impact.pure ? 'pure' : 'strike', rune, success: true, blast };
    if (impact.pure) cue.celebrate = true;
    return cue;
  }
  if (phase === 'result' || (phase === 'swing' && practice.club.x > TEE_X + 0.15)) {
    return { base: 'whiff', rune, success: false, blast: false };
  }
  return null;
}

const noiseBuffers = new WeakMap();

function noiseBuffer(context) {
  if (noiseBuffers.has(context)) return noiseBuffers.get(context);
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.6), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 7341;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

function envelope(context, output, at, duration, volume, attack) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  gain.connect(output);
  return gain;
}

function noise(context, output, at, from, to, duration, volume, options = {}) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = options.type ?? 'bandpass';
  filter.Q.value = options.q ?? 0.7;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + duration);
  source.connect(filter).connect(envelope(context, output, at, duration, volume, options.attack ?? .002));
  source.start(at);
  source.stop(at + duration);
}

function tone(context, output, at, from, to, duration, volume, type = 'sine') {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  oscillator.connect(envelope(context, output, at, duration, volume, .003));
  oscillator.start(at);
  oscillator.stop(at + duration);
}

function baseSound(context, out, at, base) {
  if (base === 'swing') {
    noise(context, out, at, 430, 2800, .23, .30, { attack: .085, q: 1.12 });
    noise(context, out, at + .064, 950, 3600, .14, .12, { attack: .047 });
    return;
  }
  if (base === 'putt') {
    tone(context, out, at, 1120, 735, .048, .15);
    noise(context, out, at, 1640, 790, .031, .18);
    return;
  }
  if (base === 'cup') {
    // Three short rebounds, ending in the hollow knock at the bottom of the cup.
    noise(context, out, at + .024, 3100, 1500, .039, .34, { q: 1.25 });
    tone(context, out, at + .026, 1020, 710, .073, .22, 'triangle');
    noise(context, out, at + .061, 2450, 870, .041, .28);
    tone(context, out, at + .064, 690, 465, .080, .20);
    noise(context, out, at + .102, 1150, 380, .054, .23);
    tone(context, out, at + .104, 338, 245, .13, .27, 'triangle');
    return;
  }
  if (base === 'whiff') {
    noise(context, out, at, 480, 1950, .145, .55, { attack: .025, q: 1.1 });
    noise(context, out, at + .045, 1400, 430, .17, .22, { attack: .013 });
    return;
  }
  if (base === 'turf') {
    tone(context, out, at, 152, 55, .115, .29, 'triangle');
    noise(context, out, at, 1280, 240, .19, .61);
    noise(context, out, at + .048, 930, 390, .095, .23);
    noise(context, out, at + .105, 1500, 510, .085, .12);
    return;
  }
  if (base === 'strike') {
    noise(context, out, at, 2400, 840, .057, .38);
    tone(context, out, at, 575, 312, .075, .15, 'triangle');
    tone(context, out, at + .019, 1230, 810, .066, .08);
    return;
  }

  // A driver face has a very short crack, a bright ring, and a tight body hit.
  noise(context, out, at, 6800, 2900, .033, .89, { type: 'highpass' });
  noise(context, out, at + .001, 3200, 970, .055, .51);
  tone(context, out, at + .003, 2730, 2250, .106, .22);
  tone(context, out, at + .007, 3810, 3110, .074, .12);
  tone(context, out, at, 215, 106, .067, .21, 'triangle');
}

function runeSound(context, out, at, rune, success) {
  if (rune === 'crescent') {
    noise(context, out, at, success ? 1350 : 850, success ? 3850 : 260, .26, .20, { attack: .022 });
    tone(context, out, at + .015, success ? 630 : 460, success ? 1120 : 205, .27, .14);
    tone(context, out, at + .068, success ? 936 : 360, success ? 1520 : 160, .19, .085);
  } else if (rune === 'sword') {
    noise(context, out, at, success ? 5700 : 1900, success ? 2500 : 480, .13, .29, { q: 1.6 });
    tone(context, out, at + .009, success ? 1830 : 620, success ? 1570 : 450, .19, .15, 'triangle');
    tone(context, out, at + .043, success ? 2690 : 222, success ? 2160 : 108, .145, .09);
  } else if (rune === 'star') {
    const notes = success ? [784, 1175, 1568] : [460, 323, 176];
    for (const [index, note] of notes.entries()) {
      tone(context, out, at + index * .048, note, note * (success ? 1.07 : .73),
        .18, .16 - index * .025, success ? 'sine' : 'triangle');
    }
  }
}

export function playShotSound(context, cue, destination = context.destination) {
  const out = context.createGain();
  out.gain.value = .60;
  out.connect(destination);
  const at = context.currentTime + .006;
  baseSound(context, out, at, cue.base);
  if (cue.rune) runeSound(context, out, at + .02, cue.rune, cue.success);
  if (cue.celebrate) {
    tone(context, out, at + .033, 196, 147, .19, .20, 'triangle');
    tone(context, out, at + .050, 659, 657, .29, .13);
    tone(context, out, at + .089, 988, 985, .36, .12);
    tone(context, out, at + .14, 1319, 1314, .42, .105);
    noise(context, out, at + .055, 5100, 2520, .31, .15, { attack: .034, q: 1.3 });
  }
  if (cue.blast) {
    tone(context, out, at + .028, 125, 38, .30, .48, 'triangle');
    noise(context, out, at + .023, 1850, 125, .34, .65, { type: 'lowpass' });
    noise(context, out, at + .034, 3900, 1100, .155, .26);
  }
}

export function createShotAudio() {
  let context;
  return {
    unlock() {
      const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContext) return;
      context ??= new AudioContext();
      if (context.state !== 'running') context.resume().catch(() => {});
    },
    play(cue) {
      if (context?.state === 'running') playShotSound(context, cue);
    },
  };
}
