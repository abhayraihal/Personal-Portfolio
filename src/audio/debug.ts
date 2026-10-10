import type { SoundName } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { Engine } from './engine.ts';
import type { EngineInput } from './engine.ts';
import { MASTER_VOLUME, masterChain } from './manager.ts';
import type { AudioManager } from './manager.ts';
import { makeBank, playImpact, playSound } from './synth.ts';
import type { ImpactMaterial } from './synth.ts';

// ?debug or ?inspect only: window.__audio renders sounds offline (no speakers needed) and reports
// peak and RMS after the master chain, so levels can be checked from the screenshot harness.
type Level = { peak: number; rms: number; peakDb: number; rmsDb: number };

declare global {
  interface Window {
    __audio?: {
      state: () => string;
      render: (name: SoundName, seconds?: number) => Promise<Level>;
      renderImpact: (strength: number, material?: ImpactMaterial) => Promise<Level>;
      renderEngine: (p: Partial<EngineInput>, seconds?: number) => Promise<Level>;
      live: () => Level | null;
      setSound: (on: boolean) => void;
      played: string[];
      store: typeof useStore.getState;
    };
  }
}

const RATE = 44100;
const db = (x: number) => +(20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);

function level(data: Float32Array, from = 0): Level {
  let peak = 0;
  let sum = 0;
  for (let i = from; i < data.length; i++) {
    const v = Math.abs(data[i]);
    if (v > peak) peak = v;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, data.length - from));
  return { peak: +peak.toFixed(4), rms: +rms.toFixed(4), peakDb: db(peak), rmsDb: db(rms) };
}

async function offline(seconds: number, build: (ctx: OfflineAudioContext, out: GainNode) => void, measureFrom = 0): Promise<Level> {
  const ctx = new OfflineAudioContext(1, Math.ceil(RATE * seconds), RATE);
  const chain = masterChain(ctx);
  chain.input.gain.value = MASTER_VOLUME;
  build(ctx, chain.input);
  const buf = await ctx.startRendering();
  return level(buf.getChannelData(0), Math.floor(measureFrom * RATE));
}

export function exposeAudioDebug(audio: AudioManager) {
  let analyser: AnalyserNode | null = null;
  const played: string[] = [];
  audio.onPlay = (name) => {
    played.push(name);
    if (played.length > 100) played.shift();
  };
  window.__audio = {
    played,
    store: useStore.getState,
    state: () => audio.ctx?.state ?? 'none',
    render: (name, seconds = 1.2) => offline(seconds, (ctx, out) => playSound({ ctx, out, bank: makeBank(ctx) }, name)),
    renderImpact: (strength, material) => offline(0.8, (ctx, out) => playImpact({ ctx, out, bank: makeBank(ctx) }, strength, material)),
    renderEngine: (p, seconds = 1.5) => offline(seconds, (ctx, out) => {
      const e = new Engine(ctx, out, makeBank(ctx));
      e.update({ speed: 0, throttle: 0, boost: false, slip: 0, airborne: false, active: 1, ...p });
    }, seconds - 0.5),
    setSound: (on) => {
      if (useStore.getState().sound !== on) useStore.getState().toggleSound();
    },
    live: () => {
      if (!audio.ctx || !audio.output) return null;
      if (!analyser) {
        analyser = audio.ctx.createAnalyser();
        analyser.fftSize = 2048;
        audio.output.connect(analyser);
      }
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      return level(data);
    },
  };
}
