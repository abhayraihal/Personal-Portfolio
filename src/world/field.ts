// A grid over the valley (plus the stream's run into the hills) holding the signed distance to the
// stream's water edge. Baked once; the ground mask texture, the scatter and the hills sample it.
import { STREAM_COARSE } from './geo.ts';
import { clamp } from './rand.ts';

// Screen-space rectangle covered by the field and the ground mask texture.
export const FIELD = { u0: -272, v0: -178, u1: 164, v1: 202, w: 1024, h: 896 };
const SU = (FIELD.u1 - FIELD.u0) / FIELD.w; // metres per texel
const SV = (FIELD.v1 - FIELD.v0) / FIELD.h;
export const FIELD_MAX = 24; // distances are clamped to this

let field: Float32Array | null = null;

export function streamField(): Float32Array {
  if (field) return field;
  const f = new Float32Array(FIELD.w * FIELD.h).fill(FIELD_MAX);
  const p = STREAM_COARSE;
  const reach = FIELD_MAX + 5;
  for (let i = 0; i < p.pts.length - 1; i++) {
    const [au, av] = p.pts[i];
    const [bu, bv] = p.pts[i + 1];
    const wa = p.w[i];
    const wb = p.w[i + 1];
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv || 1;
    const i0 = Math.max(0, Math.floor((Math.min(au, bu) - reach - FIELD.u0) / SU));
    const i1 = Math.min(FIELD.w - 1, Math.ceil((Math.max(au, bu) + reach - FIELD.u0) / SU));
    const j0 = Math.max(0, Math.floor((Math.min(av, bv) - reach - FIELD.v0) / SV));
    const j1 = Math.min(FIELD.h - 1, Math.ceil((Math.max(av, bv) + reach - FIELD.v0) / SV));
    for (let j = j0; j <= j1; j++) {
      const v = FIELD.v0 + (j + 0.5) * SV;
      const row = j * FIELD.w;
      for (let k = i0; k <= i1; k++) {
        const u = FIELD.u0 + (k + 0.5) * SU;
        let t = ((u - au) * du + (v - av) * dv) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const e = Math.hypot(u - au - du * t, v - av - dv * t) - (wa + (wb - wa) * t);
        if (e < f[row + k]) f[row + k] = e;
      }
    }
  }
  field = f;
  return f;
}

// Bilinear lookup of the stream edge distance; FIELD_MAX outside the field.
export function streamEdgeAt(u: number, v: number): number {
  const f = streamField();
  const x = (u - FIELD.u0) / SU - 0.5;
  const y = (v - FIELD.v0) / SV - 0.5;
  if (x < 0 || y < 0 || x >= FIELD.w - 1 || y >= FIELD.h - 1) return FIELD_MAX;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const o = j * FIELD.w + i;
  const a = f[o] + (f[o + 1] - f[o]) * fx;
  const b = f[o + FIELD.w] + (f[o + FIELD.w + 1] - f[o + FIELD.w]) * fx;
  return a + (b - a) * fy;
}

// Texel helpers for stamping into mask channels.
export function texelRange(u: number, v: number, r: number) {
  return {
    i0: clamp(Math.floor((u - r - FIELD.u0) / SU), 0, FIELD.w - 1),
    i1: clamp(Math.ceil((u + r - FIELD.u0) / SU), 0, FIELD.w - 1),
    j0: clamp(Math.floor((v - r - FIELD.v0) / SV), 0, FIELD.h - 1),
    j1: clamp(Math.ceil((v + r - FIELD.v0) / SV), 0, FIELD.h - 1),
  };
}
export const texelU = (i: number) => FIELD.u0 + (i + 0.5) * SU;
export const texelV = (j: number) => FIELD.v0 + (j + 0.5) * SV;
