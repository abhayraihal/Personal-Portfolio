import { DRIVE } from '../vehicle/tuning.ts';
import type { Bank } from './synth.ts';

// Continuous car sound: two detuned saws and a sub through a soft clipper and a lowpass (the
// engine), brown-noise rumble, a boost layer, wind at speed and tyre scrub while sliding. All
// sources run for the life of the context; only gains, pitches and the filter move.

export type EngineInput = {
  speed: number; // m/s, signed
  throttle: number; // -1..1
  boost: boolean;
  slip: number; // m/s sideways
  braking: boolean; // player brake (space or opposite throttle)
  airborne: boolean;
  active: number; // 0 = silent (card up), 1 = driving, in between while a panel is open
};

const MAX_SPEED = DRIVE.maxSpeed;
const BOOST_SPEED = DRIVE.boostMaxSpeed;
const GEARS = 3;

function softClip(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

export class Engine {
  private ctx: BaseAudioContext;
  private sources: AudioScheduledSourceNode[] = [];
  private osc1: OscillatorNode;
  private osc2: OscillatorNode;
  private sub: OscillatorNode;
  private boostOsc: OscillatorNode;
  private whistle: OscillatorNode;
  private lowpass: BiquadFilterNode;
  private engineGain: GainNode;
  private rumbleGain: GainNode;
  private boostGain: GainNode;
  private whistleGain: GainNode;
  private windGain: GainNode;
  private scrubGain: GainNode;
  private rpm = 0.15;

  constructor(ctx: BaseAudioContext, out: AudioNode, bank: Bank) {
    this.ctx = ctx;
    const gain = (v: number, to: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(to);
      return g;
    };
    const osc = (type: OscillatorType, f: number, to: AudioNode, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(to);
      this.sources.push(o);
      return o;
    };
    const loop = (buffer: AudioBuffer, to: AudioNode, rate = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.playbackRate.value = rate;
      s.connect(to);
      this.sources.push(s);
      return s;
    };
    const filter = (type: BiquadFilterType, f: number, q: number, to: AudioNode) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      b.connect(to);
      return b;
    };

    this.engineGain = gain(0, out);
    this.lowpass = filter('lowpass', 600, 1.1, this.engineGain);
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClip(2.2);
    shaper.connect(this.lowpass);
    const mix = gain(0.32, shaper);
    this.osc1 = osc('sawtooth', 60, mix);
    this.osc2 = osc('sawtooth', 60, mix, 11);
    this.sub = osc('triangle', 30, gain(0.9, mix));

    this.rumbleGain = gain(0, out);
    loop(bank.brown, filter('lowpass', 170, 0.7, this.rumbleGain));

    this.boostGain = gain(0, out);
    this.boostOsc = osc('square', 120, filter('bandpass', 1300, 2.5, this.boostGain));
    this.whistleGain = gain(0, out);
    this.whistle = osc('sine', 2400, this.whistleGain);

    this.windGain = gain(0, out);
    loop(bank.white, filter('bandpass', 650, 0.5, this.windGain), 0.5);
    this.scrubGain = gain(0, out);
    loop(bank.white, filter('bandpass', 1050, 1.3, this.scrubGain), 0.8);

    const t = ctx.currentTime;
    for (const s of this.sources) s.start(t);
  }

  update(p: EngineInput) {
    const t = this.ctx.currentTime;
    const speed = Math.abs(p.speed);
    const load = Math.min(1, Math.abs(p.throttle));
    const speedN = Math.min(speed / MAX_SPEED, BOOST_SPEED / MAX_SPEED);
    // Fake gearbox: pitch climbs within each gear and drops about a third at each shift.
    const span = 1 / GEARS;
    const gear = Math.min(Math.floor(speedN / span), GEARS - 1);
    const inGear = Math.min((speedN - gear * span) / span, 1.6);
    let rpm = 0.15 + 0.85 * (inGear * 0.45 + speedN * 0.55);
    if (p.airborne && load > 0.1) rpm += 0.35 * load; // wheels spin free in the air
    rpm = Math.min(rpm, 1.35);
    this.rpm += (rpm - this.rpm) * 0.25;
    const f = 44 + 110 * this.rpm + 14 * load;
    const on = p.active;

    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f, t, 0.05);
    this.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
    this.lowpass.frequency.setTargetAtTime(220 + f * (2.2 + 2.6 * load) + (p.boost ? 900 : 0), t, 0.06);
    this.engineGain.gain.setTargetAtTime(on * (0.065 + 0.045 * load + 0.03 * Math.min(speedN, 1)), t, 0.08);
    this.rumbleGain.gain.setTargetAtTime(on * (0.03 + 0.05 * load), t, 0.1);

    const boost = p.boost && load > 0.1 ? 1 : 0;
    this.boostOsc.frequency.setTargetAtTime(f * 2, t, 0.05);
    this.boostGain.gain.setTargetAtTime(on * boost * 0.025, t, 0.12);
    this.whistle.frequency.setTargetAtTime(2200 + 1400 * Math.min(speedN, 1.6), t, 0.1);
    this.whistleGain.gain.setTargetAtTime(on * boost * 0.007 * Math.min(1, speedN), t, 0.15);

    const wind = Math.min(speed / BOOST_SPEED, 1);
    this.windGain.gain.setTargetAtTime(on * 0.08 * wind * wind, t, 0.2);
    const skid = p.braking && load < 0.1 ? Math.min(1, Math.max(0, (speed - 6) / 10)) * 0.6 : 0;
    const scrub = Math.max(skid, Math.min(1, Math.max(0, (p.slip - 2) / 6)));
    this.scrubGain.gain.setTargetAtTime(on * 0.07 * scrub, t, 0.06);
  }

  dispose() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
      s.disconnect();
    }
    this.sources = [];
  }
}
