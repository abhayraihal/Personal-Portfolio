import { Sphere, Vector3 } from 'three';
import { useStore } from '../../state/store.ts';

// Plaza coordinates are screen metres from the zone centre: u to the right, v up the screen.
// Inside <ZoneFrame> that is local [u, y, -v].
export const at = (u: number, v: number, y = 0): [number, number, number] => [u, y, -v];

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// 0 before a, 1 after b, linear in between.
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeInCubic = (x: number) => x * x * x;
export const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const easeOutBack = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2);
// Ball-like drop: falls from 1 to 0 and makes one small bounce.
export function dropBounce(x: number) {
  if (x < 0.72) return 1 - (x / 0.72) ** 2;
  const b = (x - 0.72) / 0.28;
  return 0.12 * 4 * b * (1 - b);
}

export type ToyPhase = 'idle' | 'play' | 'hold' | 'rewind';

// Timeline for a station toy. The pad's onEnter starts it, the end state stays while the car is
// parked, and it rewinds a few seconds after the car has left. Parking again during the hold or
// the rewind replays it. With reduced motion the timeline jumps straight to its end state.
export class ToyClock {
  phase: ToyPhase = 'idle';
  t = 0; // seconds into the timeline
  r = 0; // rewind progress, 0..1
  private held = 0;
  private near = false;
  private again = false;
  readonly length: number;
  readonly minHold: number;
  readonly rewindSeconds: number;

  constructor(length: number, minHold = 5, rewindSeconds = 0.9) {
    this.length = length;
    this.minHold = minHold;
    this.rewindSeconds = rewindSeconds;
  }

  enter() {
    this.near = true;
    if (this.phase === 'idle') this.begin();
    else if (this.phase !== 'play') this.again = true;
  }

  leave() {
    this.near = false;
  }

  private begin() {
    this.phase = 'play';
    this.again = false;
    this.t = useStore.getState().reducedMotion ? this.length : 0;
  }

  step(dt: number) {
    if (this.phase === 'play') {
      this.t = Math.min(this.length, this.t + dt);
      if (this.t >= this.length) {
        this.phase = 'hold';
        this.held = 0;
      }
    } else if (this.phase === 'hold') {
      this.held += dt;
      if (this.again || (!this.near && this.held > this.minHold)) {
        this.phase = 'rewind';
        this.r = 0;
      }
    } else if (this.phase === 'rewind') {
      this.r = Math.min(1, this.r + dt / this.rewindSeconds);
      if (this.r >= 1) {
        this.phase = 'idle';
        this.t = 0;
        if (this.again) this.begin();
      }
    }
  }

  // Time to draw: the play head while playing or holding, 0 when idle. During the rewind toys
  // usually blend from the end state back to the start with `1 - r`.
  get time() {
    return this.phase === 'idle' ? 0 : this.t;
  }
}

// Frame delta clamped so a stalled tab does not jump timelines.
export const frameDt = (delta: number) => Math.min(delta, 0.05);

// Animated InstancedMeshes keep a fixed bounding sphere around their toy, so frustum culling (and
// the shadow pass) still works while instances move or start at scale 0.
export function fixBounds(mesh: { boundingSphere: Sphere | null } | null, radius: number, cx = 0, cy = 1, cz = 0) {
  if (mesh) mesh.boundingSphere = new Sphere(new Vector3(cx, cy, cz), radius);
}
