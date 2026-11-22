/**
 * Hit Your Shot sound maker. Synthesizes every sound effect from scratch (oscillators, filtered noise from a seeded generator) and writes
 * assets/sfx/<id>.wav: 16-bit mono PCM at 22.05 kHz, peak-normalized to the level each sound has in the mix, with a short fade in and out
 * so nothing clicks. No samples, no downloads: the output is license-clean and the same bytes on every run.
 *
 * The mix lives here, in PEAK below: the release is quiet, the swish is the loudest and most satisfying sound of the game.
 * src/services/audio.ts can trim each sound at runtime with its VOLUME table.
 *
 * Run from the repository root:
 *     npx tsx tools/make-sfx.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RATE = 22050;
const OUT_DIR = resolve(__dirname, '..', 'assets', 'sfx');
const TAU = 2 * Math.PI;

// ---------- Basics ----------

/** mulberry32: small, fast, good enough for noise; seeded per sound so every file is reproducible on its own. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buffer(sec: number): Float64Array {
  return new Float64Array(Math.ceil(sec * RATE));
}

/** Adds src into dst starting at atSec, scaled by gain. */
function mix(dst: Float64Array, src: Float64Array, atSec = 0, gain = 1): void {
  const off = Math.round(atSec * RATE);
  for (let i = 0; i < src.length && off + i < dst.length; i++) dst[off + i]! += src[i]! * gain;
}

/** Attack then exponential decay. tau is the decay time constant in seconds. */
function env(t: number, attack: number, tau: number): number {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / tau);
}

/** Smooth 0..1..0 window for swells (raised cosine attack, hold, raised cosine release). */
function swell(t: number, attack: number, hold: number, release: number): number {
  if (t < 0) return 0;
  if (t < attack) return 0.5 - 0.5 * Math.cos((Math.PI * t) / attack);
  if (t < attack + hold) return 1;
  const r = t - attack - hold;
  if (r < release) return 0.5 + 0.5 * Math.cos((Math.PI * r) / release);
  return 0;
}

/** RBJ cookbook biquad. Coefficients can change every sample (sweeps). */
class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  set(kind: 'lp' | 'hp' | 'bp', freq: number, q: number): this {
    const f = Math.min(Math.max(freq, 10), RATE * 0.45);
    const w = (TAU * f) / RATE;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    let b0: number;
    let b1: number;
    let b2: number;
    if (kind === 'lp') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (kind === 'hp') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      // Band-pass with 0 dB peak gain.
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** A sine whose frequency follows freq(t); phase is accumulated so sweeps stay smooth. */
function sweepSine(sec: number, freq: (t: number) => number, amp: (t: number) => number): Float64Array {
  const out = buffer(sec);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    out[i] = Math.sin(phase) * amp(t);
    phase += (TAU * freq(t)) / RATE;
  }
  return out;
}

/** Filtered noise with a moving filter and an amplitude envelope. */
function noise(
  sec: number,
  rng: () => number,
  kind: 'lp' | 'hp' | 'bp',
  freq: (t: number) => number,
  q: number,
  amp: (t: number) => number,
): Float64Array {
  const out = buffer(sec);
  const f = new Biquad();
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    if (i % 16 === 0) f.set(kind, freq(t), q);
    out[i] = f.run(rng() * 2 - 1) * amp(t);
  }
  return out;
}

/** A warm mallet note: fundamental, a softer octave, a quick bright partial at 4x (marimba-like), a faint detuned twin for width. */
function mallet(freq: number, sec: number, tau: number): Float64Array {
  const out = buffer(sec);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const a = env(t, 0.004, tau);
    out[i] =
      a * (Math.sin(TAU * freq * t) + 0.35 * Math.sin(TAU * freq * 1.003 * t)) +
      0.3 * env(t, 0.003, tau * 0.6) * Math.sin(TAU * freq * 2 * t) +
      0.22 * env(t, 0.002, tau * 0.18) * Math.sin(TAU * freq * 4 * t);
  }
  return out;
}

/** Bell-like coin chime: fundamental plus inharmonic shimmer that dies fast. */
function chime(freq: number, sec: number, tau: number): Float64Array {
  const out = buffer(sec);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    out[i] =
      env(t, 0.002, tau) * Math.sin(TAU * freq * t) +
      0.4 * env(t, 0.002, tau * 0.5) * Math.sin(TAU * freq * 2.0 * t) +
      0.18 * env(t, 0.001, tau * 0.2) * Math.sin(TAU * freq * 3.01 * t) +
      0.08 * env(t, 0.001, tau * 0.12) * Math.sin(TAU * freq * 5.4 * t);
  }
  return out;
}

const note = (semitonesFromA4: number): number => 440 * Math.pow(2, semitonesFromA4 / 12);
const G5 = note(10);
const B5 = note(14);
const C6 = note(15);
const E6 = note(19);
const G6 = note(22);

// ---------- The sounds ----------

/** Release: a short airy whoosh (band-passed noise sweeping up) over a light thump of the ball leaving the hand. */
function shot(): Float64Array {
  const rng = makeRng(101);
  const sec = 0.24;
  const out = buffer(sec);
  mix(out, noise(sec, rng, 'bp', (t) => 700 + 2600 * Math.min(1, t / 0.14), 1.1, (t) => swell(t, 0.045, 0.02, 0.15)), 0, 0.9);
  mix(out, sweepSine(0.09, (t) => 150 - 500 * t, (t) => env(t, 0.003, 0.025)), 0, 0.55);
  return out;
}

/** The swish: a net brushing the ball. Two noise bands sweeping down, a fast attack, a smooth tail, and the tick of net strings. */
function hit(): Float64Array {
  const rng = makeRng(202);
  const sec = 0.55;
  const out = buffer(sec);
  // The body of the swish: a falling band, like "shhhh" closing.
  mix(out, noise(sec, rng, 'bp', (t) => 4200 - 2400 * Math.min(1, t / 0.3), 1.4, (t) => env(t, 0.008, 0.11) * (1 + 0.25 * Math.sin(TAU * 34 * t))), 0, 1);
  // Air on top.
  mix(out, noise(sec, rng, 'hp', () => 5500, 0.7, (t) => env(t, 0.004, 0.05)), 0, 0.35);
  // Soft low body: the net catching the ball.
  mix(out, noise(0.2, rng, 'lp', () => 500, 0.8, (t) => env(t, 0.006, 0.04)), 0.01, 0.5);
  // Net strings: sparse short ticks thinning out.
  const ticks = buffer(sec);
  const tickFilter = new Biquad().set('bp', 3000, 3);
  for (let i = 0; i < ticks.length; i++) {
    const t = i / RATE;
    const density = 0.012 * Math.exp(-t / 0.12);
    ticks[i] = tickFilter.run(rng() < density ? (rng() * 2 - 1) * 6 : 0);
  }
  mix(out, ticks, 0, 0.35);
  return out;
}

/** Rim clank: a struck steel ring (inharmonic partials with their own decays), the click of contact and the dull hit of the ball. */
function rim(): Float64Array {
  const rng = makeRng(303);
  const sec = 0.65;
  const out = buffer(sec);
  const f0 = 520;
  const partials: [number, number, number][] = [
    [1, 1, 0.28],
    [2.76, 0.6, 0.17],
    [5.4, 0.35, 0.09],
    [8.93, 0.2, 0.05],
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    let s = 0;
    for (const [ratio, amp, tau] of partials) s += amp * env(t, 0.001, tau) * Math.sin(TAU * f0 * ratio * t + ratio);
    out[i] = s * 0.6;
  }
  mix(out, noise(0.02, rng, 'hp', () => 2500, 0.7, (t) => env(t, 0.0005, 0.004)), 0, 0.7);
  mix(out, sweepSine(0.1, (t) => 190 - 600 * t, (t) => env(t, 0.002, 0.03)), 0, 0.6);
  return out;
}

/** Ball on the floor: a rubbery low thump that drops in pitch, with a soft slap on contact. */
function floor(): Float64Array {
  const rng = makeRng(404);
  const sec = 0.26;
  const out = buffer(sec);
  mix(out, sweepSine(sec, (t) => 70 + 120 * Math.exp(-t / 0.025), (t) => env(t, 0.002, 0.06)), 0, 1);
  mix(out, noise(0.05, rng, 'lp', () => 1800, 0.8, (t) => env(t, 0.001, 0.01)), 0, 0.35);
  return out;
}

/** Purchase: two bright notes going up, the second one ringing. */
function buy(): Float64Array {
  const sec = 0.55;
  const out = buffer(sec);
  mix(out, chime(B5, 0.2, 0.06), 0, 0.8);
  mix(out, chime(E6, sec - 0.075, 0.18), 0.075, 1);
  return out;
}

/** Round end: one short two-note phrase, the same every time (design rules section 11). */
function roundEnd(): Float64Array {
  const sec = 0.75;
  const out = buffer(sec);
  mix(out, mallet(G5, 0.3, 0.09), 0, 0.85);
  mix(out, mallet(C6, sec - 0.13, 0.22), 0.13, 1);
  return out;
}

/** Crowd cheer: a swelling bed of filtered noise, many voices sliding up ("whoo"), scattered claps. */
function cheerBuffer(seed: number, sec: number): Float64Array {
  const rng = makeRng(seed);
  const out = buffer(sec);
  // The bed: several noise bands with slow wobble, swelling in and out.
  for (let b = 0; b < 6; b++) {
    const center = 600 + rng() * 2000;
    const wob = 2 + rng() * 4;
    const phase = rng() * TAU;
    mix(out, noise(sec, rng, 'bp', (t) => center * (1 + 0.12 * Math.sin(TAU * wob * t + phase)), 1.6, (t) => swell(t, 0.22, sec * 0.3, sec * 0.5)), 0, 0.5);
  }
  // Voices: buzzy tones through a vowel filter, each rising a little.
  for (let v = 0; v < 18; v++) {
    const start = rng() * 0.3;
    const len = 0.5 + rng() * (sec - start - 0.55);
    const pitch = 170 + rng() * 260;
    const rise = 1.08 + rng() * 0.25;
    const vib = 5 + rng() * 2;
    const formant = 700 + rng() * 600;
    const voice = buffer(len);
    const f = new Biquad().set('bp', formant, 2.2);
    const lp = new Biquad().set('lp', 2200, 0.7);
    let phase = rng();
    for (let i = 0; i < voice.length; i++) {
      const t = i / RATE;
      const k = Math.min(1, t / (len * 0.6));
      const fr = pitch * (1 + (rise - 1) * Math.sin((Math.PI / 2) * k)) * (1 + 0.015 * Math.sin(TAU * vib * t));
      phase += fr / RATE;
      phase -= Math.floor(phase);
      const saw = 2 * phase - 1;
      voice[i] = lp.run(f.run(saw)) * swell(t, 0.08, len * 0.4, len * 0.6 - 0.08);
    }
    mix(out, voice, start, 0.22);
  }
  // Claps.
  for (let c = 0; c < 26; c++) {
    const at = 0.05 + rng() * (sec - 0.3);
    mix(out, noise(0.04, rng, 'bp', () => 1200 + rng() * 900, 1.2, (t) => env(t, 0.0008, 0.008)), at, 0.35 + rng() * 0.25);
  }
  return out;
}

function cheer(): Float64Array {
  return cheerBuffer(505, 1.5);
}

/** New best: the round-end phrase with a third note on top (design rules section 11), then the crowd. */
function newBest(): Float64Array {
  const sec = 1.9;
  const out = buffer(sec);
  mix(out, mallet(G5, 0.3, 0.09), 0, 0.8);
  mix(out, mallet(C6, 0.35, 0.12), 0.12, 0.9);
  mix(out, mallet(E6, 0.35, 0.12), 0.24, 0.9);
  mix(out, mallet(G6, 1.2, 0.35), 0.36, 1);
  const crowd = cheerBuffer(606, 1.5);
  let peak = 0;
  for (const s of crowd) peak = Math.max(peak, Math.abs(s));
  mix(out, crowd, 0.3, 0.45 / (peak || 1));
  return out;
}

/** A new character walks in: two soft steps, then nothing. */
function footsteps(): Float64Array {
  const rng = makeRng(707);
  const sec = 0.62;
  const out = buffer(sec);
  const step = (at: number, pitch: number, gain: number): void => {
    mix(out, sweepSine(0.12, (t) => pitch * (1 - 0.8 * t), (t) => env(t, 0.003, 0.03)), at, gain);
    mix(out, noise(0.12, rng, 'bp', () => 900, 0.9, (t) => env(t, 0.006, 0.03)), at, gain * 0.6);
  };
  step(0, 95, 1);
  step(0.3, 85, 0.85);
  return out;
}

/** Refused action: a soft low double buzz, rounded off with a low-pass so it never rasps. */
function error(): Float64Array {
  const sec = 0.36;
  const out = buffer(sec);
  const buzz = (at: number, freq: number): void => {
    const len = 0.12;
    const b = buffer(len);
    const lp = new Biquad().set('lp', 650, 0.7);
    for (let i = 0; i < b.length; i++) {
      const t = i / RATE;
      const sq = Math.tanh(3 * Math.sin(TAU * freq * t));
      b[i] = lp.run(sq) * swell(t, 0.01, len - 0.05, 0.04);
    }
    mix(out, b, at, 1);
  };
  buzz(0, 165);
  buzz(0.17, 147);
  return out;
}

// ---------- Mix and output ----------

/** Target peak of each file: the mix. The release sits low, the swish is the loudest. */
const SOUNDS: { id: string; make: () => Float64Array; peak: number; drive?: number }[] = [
  { id: 'shot', make: shot, peak: 0.32 },
  { id: 'hit', make: hit, peak: 0.95, drive: 2 },
  { id: 'rim', make: rim, peak: 0.65 },
  { id: 'floor', make: floor, peak: 0.6 },
  { id: 'buy', make: buy, peak: 0.5 },
  { id: 'roundEnd', make: roundEnd, peak: 0.55 },
  { id: 'newBest', make: newBest, peak: 0.65 },
  { id: 'cheer', make: cheer, peak: 0.6 },
  { id: 'footsteps', make: footsteps, peak: 0.65 },
  { id: 'error', make: error, peak: 0.3 },
];

/** Removes DC, optionally saturates softly (drive lifts a peaky noise burst so it sounds fuller), fades the ends (2 ms in, 12 ms out)
 * and scales to the target peak. */
function finish(x: Float64Array, peak: number, drive = 0): Float64Array {
  const hp = new Biquad().set('hp', 25, 0.7);
  for (let i = 0; i < x.length; i++) x[i] = hp.run(x[i]!);
  if (drive > 0) {
    let m = 0;
    for (const s of x) m = Math.max(m, Math.abs(s));
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh((drive * x[i]!) / (m || 1));
  }
  const fadeIn = Math.round(0.002 * RATE);
  const fadeOut = Math.round(0.012 * RATE);
  for (let i = 0; i < fadeIn && i < x.length; i++) x[i]! *= i / fadeIn;
  for (let i = 0; i < fadeOut && i < x.length; i++) x[x.length - 1 - i]! *= i / fadeOut;
  let max = 0;
  for (const s of x) max = Math.max(max, Math.abs(s));
  const g = max > 0 ? peak / max : 0;
  for (let i = 0; i < x.length; i++) x[i]! *= g;
  return x;
}

function wav(samples: Float64Array): Buffer {
  const data = samples.length * 2;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + data, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    b.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return b;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { id, make, peak, drive } of SOUNDS) {
  const samples = finish(make(), peak, drive);
  const bytes = wav(samples);
  writeFileSync(resolve(OUT_DIR, `${id}.wav`), bytes);
  console.log(`${id}.wav  ${(samples.length / RATE).toFixed(2)} s  ${(bytes.length / 1024).toFixed(1)} KB`);
}
