// Ground mask texture over FIELD (see field.ts), sampled by the ground and water shaders:
//   R: signed distance to the stream's water edge, (e + 4) / 16
//   G: lamp light pools (night)
//   B: contact shading under trees, rocks and poles
//   A: white water around boulders in the stream; the bike trail on dry ground (never overlap)
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, UnsignedByteType } from 'three';
import { FIELD, FIELD_MAX, streamField, texelRange, texelU, texelV } from './field.ts';
import { TRAIL, TRAIL_HALF, segDist } from './geo.ts';
import type { Plan } from './plan.ts';

export const MASK_RECT = [FIELD.u0, FIELD.v0, 1 / (FIELD.u1 - FIELD.u0), 1 / (FIELD.v1 - FIELD.v0)] as const;
export const STREAM_ENC = { offset: 4, range: 16 }; // e = R * range - offset

const TREE_AO: Record<string, number> = {
  'tree-deodar-tall': 2.3, 'tree-deodar': 2.2, 'tree-pine-full': 2.9, 'tree-pine-cone': 2.4, 'tree-pine-snow': 2.9,
};

function stamp(data: Float32Array, u: number, v: number, radius: number, strength: number, mode: 'add' | 'max') {
  const { i0, i1, j0, j1 } = texelRange(u, v, radius);
  for (let j = j0; j <= j1; j++) {
    const dv = texelV(j) - v;
    for (let i = i0; i <= i1; i++) {
      const du = texelU(i) - u;
      const d = Math.sqrt(du * du + dv * dv) / radius;
      if (d >= 1) continue;
      const f = (1 - d) * (1 - d) * (1 + 2 * d) * strength; // smooth falloff
      const k = j * FIELD.w + i;
      data[k] = mode === 'add' ? data[k] + f : Math.max(data[k], f);
    }
  }
}

export function buildMask(plan: Plan): DataTexture {
  const n = FIELD.w * FIELD.h;
  const stream = streamField();
  const glow = new Float32Array(n);
  const ao = new Float32Array(n);
  const foam = new Float32Array(n);

  for (const l of plan.lamps) stamp(glow, l.head[0], l.head[1], l.kind === 'street' ? 7.5 : 5.8, l.kind === 'street' ? 1 : 0.85, 'add');
  for (const t of plan.trees) stamp(ao, t.u, t.v, (TREE_AO[t.name] ?? 2.4) * t.s, 0.85, 'add');
  for (const t of plan.hillTrees) stamp(ao, t.u, t.v, (TREE_AO[t.name] ?? 2.4) * t.s, 0.6, 'add');
  for (const k of plan.rocks) stamp(ao, k.u, k.v, 1.25 * k.s + 0.4, 0.55, 'add');
  for (const k of plan.props) if (k.name !== 'stones-river-flat') stamp(ao, k.u, k.v, 0.9 * k.s + 0.3, 0.45, 'add');
  for (const p of plan.poles) stamp(ao, p.u, p.v, 0.9, 0.35, 'add');
  for (const d of plan.darchog) stamp(ao, d.u, d.v, 0.7, 0.3, 'add');
  for (const l of plan.lamps) stamp(ao, l.u, l.v, 0.8, 0.35, 'add');
  for (const f of plan.foam) stamp(foam, f.u, f.v, f.r, 1, 'max');
  // Bike trail: a soft-edged line into the same channel.
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [au, av] = TRAIL[i];
    const [bu, bv] = TRAIL[i + 1];
    const reach = TRAIL_HALF + 1;
    const { i0, i1, j0, j1 } = texelRange((au + bu) / 2, (av + bv) / 2, Math.hypot(bu - au, bv - av) / 2 + reach);
    for (let j = j0; j <= j1; j++) {
      const v = texelV(j);
      for (let k = i0; k <= i1; k++) {
        const d = segDist(texelU(k), v, au, av, bu, bv);
        const t = Math.min(1, Math.max(0, (TRAIL_HALF + 0.55 - d) / 0.9));
        const o = j * FIELD.w + k;
        if (t > foam[o]) foam[o] = t;
      }
    }
  }

  const data = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const e = Math.min(stream[k], FIELD_MAX);
    data[k * 4] = Math.max(0, Math.min(255, Math.round(((e + STREAM_ENC.offset) / STREAM_ENC.range) * 255)));
    data[k * 4 + 1] = Math.min(255, Math.round(Math.min(glow[k], 1) * 255));
    data[k * 4 + 2] = Math.min(255, Math.round(Math.min(ao[k], 1) * 255));
    data[k * 4 + 3] = Math.min(255, Math.round(Math.min(foam[k], 1) * 255));
  }
  const tex = new DataTexture(data, FIELD.w, FIELD.h, RGBAFormat, UnsignedByteType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
