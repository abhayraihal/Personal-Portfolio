import type { SoundName } from '../state/events.ts';

// Synthesized sounds, no audio files. Every recipe takes any BaseAudioContext (so a test can
// render it offline) and an output node. Nodes are created per sound and dropped when they stop.

export type Bank = { white: AudioBuffer; brown: AudioBuffer };
export type Out = { ctx: BaseAudioContext; out: AudioNode; bank: Bank };
export type ImpactMaterial = 'wood' | 'metal' | 'stone' | 'soft';

export function makeBank(ctx: BaseAudioContext): Bank {
  const n = Math.floor(ctx.sampleRate * 2);
  const white = ctx.createBuffer(1, n, ctx.sampleRate);
  const brown = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0);
  const b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.random() * 2 - 1;
    w[i] = r;
    last = (last + 0.02 * r) / 1.02;
    b[i] = last * 3.5;
  }
  return { white, brown };
}

const SILENT = 0.0001;

// Exponential attack-decay envelope on a fresh gain node.
function envGain(o: Out, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), t + attack);
  g.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay);
  g.connect(o.out);
  return g;
}

function tone(o: Out, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, attack = 0.006, dest?: AudioNode) {
  const osc = o.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + attack + dur);
  const g = envGain(o, t, peak, attack, dur);
  if (dest) {
    g.disconnect();
    g.connect(dest);
  }
  osc.connect(g);
  osc.start(t);
  osc.stop(t + attack + dur + 0.05);
}

// Filtered noise burst; the filter frequency glides from f0 to f1.
function noise(o: Out, t: number, dur: number, peak: number, type: BiquadFilterType, f0: number, f1: number, q = 1, attack = 0.004, rate = 1, buffer: 'white' | 'brown' = 'white') {
  const src = o.ctx.createBufferSource();
  src.buffer = o.bank[buffer];
  src.playbackRate.value = rate;
  const f = o.ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + attack + dur);
  const g = envGain(o, t, peak, attack, dur);
  src.connect(f).connect(g);
  const offset = Math.random() * (src.buffer.duration - dur - 0.1);
  src.start(t, Math.max(0, offset));
  src.stop(t + attack + dur + 0.05);
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// A thud for a collision. strength is the closing speed in m/s.
export function playImpact(o: Out, strength: number, material?: ImpactMaterial, volume = 1) {
  const t = o.ctx.currentTime + 0.005;
  const s = Math.min(1, Math.max(0, (strength - 1.2) / 12));
  const vol = (0.18 + 0.62 * s) * volume;
  const pitch = rand(0.85, 1.18);
  const soft = material === 'soft';
  const cutoff = (soft ? 260 : material === 'stone' ? 900 : 1300) * (0.5 + s) * pitch;
  // Body: a short falling sine gives the weight.
  tone(o, 'sine', 120 * pitch * (soft ? 0.8 : 1), 42 * pitch, t, 0.12 + 0.12 * s, vol * 0.9, 0.003);
  // Crunch: lowpassed noise.
  noise(o, t, 0.06 + 0.16 * s, vol * (soft ? 0.5 : 0.8), 'lowpass', cutoff, cutoff * 0.35, 0.8, 0.002, pitch, soft ? 'brown' : 'white');
  if (material === 'wood') {
    tone(o, 'triangle', 240 * pitch, 190 * pitch, t, 0.09, vol * 0.45, 0.002);
    noise(o, t, 0.05, vol * 0.4, 'bandpass', 900 * pitch, 700 * pitch, 2.5, 0.002);
  } else if (material === 'metal') {
    for (const [f, a] of [[523, 0.22], [1187, 0.14], [2093, 0.08]] as const) tone(o, 'sine', f * pitch, f * pitch * 0.995, t, 0.35 + 0.3 * s, vol * a, 0.002);
  }
}

// The rest of the events 'sound' names. volume scales the recipe (0..1).
export function playSound(o: Out, name: SoundName, volume = 1) {
  const t = o.ctx.currentTime + 0.005;
  const v = volume;
  switch (name) {
    case 'click':
      tone(o, 'sine', 1250, 880, t, 0.05, 0.42 * v, 0.002);
      break;
    case 'open':
      tone(o, 'triangle', 523.25, 523.25, t, 0.11, 0.24 * v);
      tone(o, 'triangle', 783.99, 783.99, t + 0.07, 0.16, 0.22 * v);
      break;
    case 'close':
      tone(o, 'triangle', 783.99, 783.99, t, 0.09, 0.2 * v);
      tone(o, 'triangle', 523.25, 493.88, t + 0.06, 0.14, 0.2 * v);
      break;
    case 'pad':
      tone(o, 'sine', 620, 980, t, 0.1, 0.36 * v, 0.004);
      tone(o, 'sine', 1240, 1960, t + 0.02, 0.08, 0.1 * v, 0.004);
      break;
    case 'zone':
      tone(o, 'triangle', 587.33, 587.33, t, 0.5, 0.16 * v, 0.008);
      tone(o, 'triangle', 880, 880, t + 0.09, 0.6, 0.15 * v, 0.008);
      tone(o, 'sine', 1760, 1760, t + 0.09, 0.4, 0.04 * v, 0.008);
      break;
    case 'goal': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone(o, 'triangle', f, f, t + i * 0.08, i === notes.length - 1 ? 0.45 : 0.1, 0.18 * v));
      noise(o, t + 0.05, 0.7, 0.1 * v, 'bandpass', 1400, 1000, 0.7, 0.12);
      break;
    }
    case 'win': {
      const lp = o.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      lp.connect(o.out);
      const seq: [number, number, number][] = [[392, 0, 0.1], [523.25, 0.1, 0.1], [659.25, 0.2, 0.1], [783.99, 0.3, 0.16], [1046.5, 0.48, 0.55]];
      for (const [f, at, d] of seq) tone(o, 'square', f, f, t + at, d, 0.07 * v, 0.006, lp);
      for (const [f, at, d] of seq) tone(o, 'triangle', f * 0.5, f * 0.5, t + at, d, 0.06 * v, 0.006);
      break;
    }
    case 'horn': {
      // Two notes a major third apart, like a small car horn, softened by a lowpass.
      const lp = o.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1900;
      lp.Q.value = 2;
      const g = o.ctx.createGain();
      g.gain.setValueAtTime(SILENT, t);
      g.gain.exponentialRampToValueAtTime(0.11 * v, t + 0.015);
      g.gain.setValueAtTime(0.11 * v, t + 0.27);
      g.gain.exponentialRampToValueAtTime(SILENT, t + 0.34);
      lp.connect(g).connect(o.out);
      for (const f of [370, 466]) {
        const osc = o.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.setValueAtTime(f, t + 0.26);
        osc.frequency.exponentialRampToValueAtTime(f * 0.94, t + 0.34);
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + 0.4);
      }
      break;
    }
    case 'teleport':
      tone(o, 'sine', 300, 1400, t, 0.3, 0.24 * v, 0.01);
      tone(o, 'triangle', 600, 2800, t + 0.03, 0.26, 0.08 * v, 0.01);
      noise(o, t, 0.35, 0.16 * v, 'bandpass', 500, 3000, 1.1, 0.06);
      break;
    case 'coin':
      tone(o, 'square', 987.77, 987.77, t, 0.07, 0.12 * v, 0.002);
      tone(o, 'square', 1318.5, 1318.5, t + 0.07, 0.28, 0.12 * v, 0.002);
      break;
    case 'whoosh':
      noise(o, t, 0.42, 0.5 * v, 'bandpass', 320, 1700, 1.2, 0.14);
      break;
    case 'thud':
      playImpact(o, 7, undefined, v);
      break;
    case 'splash':
      // A wash of lowpassed noise plus a few falling droplet blips.
      noise(o, t, 0.55, 0.42 * v, 'lowpass', 2200, 420, 0.7, 0.02);
      noise(o, t + 0.03, 0.25, 0.22 * v, 'bandpass', 1400, 800, 1.6, 0.01);
      for (let i = 0; i < 4; i++) tone(o, 'sine', rand(700, 1300), rand(250, 420), t + 0.05 + i * rand(0.04, 0.09), 0.06, 0.07 * v, 0.002);
      break;
  }
}
