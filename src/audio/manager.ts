import { car } from '../state/car.ts';
import type { SoundName } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { Engine } from './engine.ts';
import { makeBank, playImpact, playSound } from './synth.ts';
import type { Bank, ImpactMaterial, Out } from './synth.ts';

// One AudioContext for the page, created on the first user gesture after sound is switched on.
// Chain: sounds -> master gain -> compressor -> speakers. Suspended while muted or hidden.

export const MASTER_VOLUME = 0.4;
const IMPACT_VOICES = 6; // thuds playing at once
const IMPACT_GAP_MS = 30;
const REPEAT_MS = 45; // the same UI sound twice within this plays once

type Ctor = typeof AudioContext;

// Master gain into a gentle compressor so stacked sounds never clip.
export function masterChain(ctx: BaseAudioContext): { input: GainNode; output: DynamicsCompressorNode } {
  const input = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  input.connect(comp);
  comp.connect(ctx.destination);
  return { input, output: comp };
}

export class AudioManager {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  output: AudioNode | null = null;
  bank: Bank | null = null;
  engine: Engine | null = null;
  private out: Out | null = null;
  private raf = 0;
  private lastPlayed = new Map<SoundName, number>();
  private impactEnds: number[] = [];
  private lastImpact = 0;
  private suspendTimer = 0;
  onPlay: ((name: string) => void) | null = null; // debug hook

  // Sound is on, the tab is visible and the context has started.
  get audible(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && useStore.getState().sound && !document.hidden;
  }

  // Create (first time) and resume the context. Call from a user gesture, or from a store change
  // that a gesture caused; browsers keep a context suspended until the page has been interacted with.
  enable() {
    if (!useStore.getState().sound || document.hidden) return;
    if (!this.ctx) {
      const AC: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'interactive' });
      const chain = masterChain(ctx);
      chain.input.gain.value = 0;
      this.ctx = ctx;
      this.master = chain.input;
      this.output = chain.output;
      this.bank = makeBank(ctx);
      this.out = { ctx, out: chain.input, bank: this.bank };
      this.engine = new Engine(ctx, chain.input, this.bank);
    }
    clearTimeout(this.suspendTimer);
    const ctx = this.ctx;
    const start = () => {
      if (!useStore.getState().sound || document.hidden || !this.master) return;
      this.master.gain.setTargetAtTime(MASTER_VOLUME, ctx.currentTime, 0.08);
      this.startLoop();
    };
    if (ctx.state === 'running') start();
    else ctx.resume().then(start, () => {});
  }

  // Fade out and suspend (sound switched off, or the tab hidden).
  pause() {
    this.stopLoop();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      if (!useStore.getState().sound || document.hidden) ctx.suspend().catch(() => {});
    }, 300);
  }

  play(name: SoundName, volume = 1) {
    if (!this.audible || !this.out) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? -Infinity) < REPEAT_MS) return;
    this.lastPlayed.set(name, now);
    playSound(this.out, name, volume);
    this.onPlay?.(name);
  }

  impact(strength: number, material?: ImpactMaterial) {
    if (!this.audible || !this.out) return;
    const now = performance.now();
    if (now - this.lastImpact < IMPACT_GAP_MS) return;
    this.impactEnds = this.impactEnds.filter((t) => t > now);
    if (this.impactEnds.length >= IMPACT_VOICES) return;
    this.lastImpact = now;
    this.impactEnds.push(now + 450);
    playImpact(this.out, strength, material);
    this.onPlay?.(`impact:${material ?? ''}:${strength.toFixed(1)}`);
  }

  private startLoop() {
    if (this.raf) return;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (!this.engine || !this.audible) return;
      const s = useStore.getState();
      const driving = (s.phase === 'play' || s.phase === 'intro') && car.ready && !s.classicOpen;
      const active = driving ? (s.panel ? 0.3 : 1) : 0;
      this.engine.update({ speed: car.speed, throttle: car.throttle, boost: car.boosting, slip: car.slip, braking: car.braking && car.brakeLight, airborne: car.airborne, active });
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.stopLoop();
    clearTimeout(this.suspendTimer);
    this.engine?.dispose();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.engine = null;
    this.out = null;
  }
}
