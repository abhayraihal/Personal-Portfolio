// Screen-space geometry for the valley: roads, the stream centreline, distances used for scatter
// exclusion, and the hill height field outside BOUNDS. Everything here is plain math in screen
// coordinates (u right, v up the screen); a group rotated by FACE_CAMERA_Y maps local (x, z) to (u, -v).
import { BOUNDS, ROADS, ROUNDABOUT, STREAM, ZONES, inArea } from '../config/layout.ts';
import type { Area } from '../config/layout.ts';
import { clamp, fbm, smoothstep, vnoise } from './rand.ts';

export type V2 = [number, number];

// Local (x, z) inside the FACE_CAMERA_Y group for a screen point.
export const local = (u: number, v: number): [number, number] => [u, -v];

// Distance from p to segment ab, and the clamped parameter along it.
export function segDist(pu: number, pv: number, au: number, av: number, bu: number, bv: number): number {
  const du = bu - au;
  const dv = bv - av;
  const len2 = du * du + dv * dv;
  const t = len2 > 0 ? clamp(((pu - au) * du + (pv - av) * dv) / len2, 0, 1) : 0;
  return Math.hypot(pu - au - du * t, pv - av - dv * t);
}

export function segParam(pu: number, pv: number, au: number, av: number, bu: number, bv: number): number {
  const du = bu - au;
  const dv = bv - av;
  const len2 = du * du + dv * dv;
  return len2 > 0 ? ((pu - au) * du + (pv - av) * dv) / len2 : 0;
}

// ---------------------------------------------------------------- roads

export type Seg = { a: V2; b: V2; half: number; kind: 'asphalt' | 'dirt'; id: string };

export const SEGMENTS: Seg[] = ROADS.flatMap((r) =>
  r.points.slice(1).map((b, i) => ({ a: r.points[i], b, half: r.width / 2, kind: r.kind, id: r.id })),
);
export const ASPHALT = SEGMENTS.filter((s) => s.kind === 'asphalt');
export const DIRT = SEGMENTS.filter((s) => s.kind === 'dirt');
export const RING = { u: ROUNDABOUT.u, v: ROUNDABOUT.v, r: ROUNDABOUT.r, half: ROUNDABOUT.width / 2 };
export const ISLAND_R = RING.r - RING.half; // grass island radius

// Signed distance to the nearest road surface edge (negative on a road). The roundabout counts as
// a solid disc (ring plus island).
export function roadDist(u: number, v: number): number {
  let d = Math.hypot(u - RING.u, v - RING.v) - (RING.r + RING.half);
  for (const s of SEGMENTS) {
    const e = segDist(u, v, s.a[0], s.a[1], s.b[0], s.b[1]) - s.half;
    if (e < d) d = e;
  }
  return d;
}

// ---------------------------------------------------------------- zones

function areaDist(a: Area, u: number, v: number): number {
  if (a.kind === 'circle') return Math.hypot(u - a.u, v - a.v) - a.r;
  const dx = Math.max(a.u0 - u, 0, u - a.u1);
  const dy = Math.max(a.v0 - v, 0, v - a.v1);
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  return -Math.min(u - a.u0, a.u1 - u, v - a.v0, a.v1 - v);
}

// Signed distance to the nearest zone area (negative inside one).
export function zoneDist(u: number, v: number): number {
  let d = Infinity;
  for (const z of ZONES) d = Math.min(d, areaDist(z.area, u, v));
  return d;
}

export const inAnyZone = (u: number, v: number) => ZONES.some((z) => inArea(z.area, u, v));

// ---------------------------------------------------------------- bounds

const BC = { u: (BOUNDS.u0 + BOUNDS.u1) / 2, v: (BOUNDS.v0 + BOUNDS.v1) / 2, hu: (BOUNDS.u1 - BOUNDS.u0) / 2, hv: (BOUNDS.v1 - BOUNDS.v0) / 2 };

// Signed distance to the BOUNDS rectangle: positive outside (where the hills are).
export function outside(u: number, v: number): number {
  const dx = Math.abs(u - BC.u) - BC.hu;
  const dy = Math.abs(v - BC.v) - BC.hv;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}

// ---------------------------------------------------------------- stream

export type StreamPath = {
  pts: V2[]; // centreline, about 1 m apart
  s: number[]; // arc length at each point
  w: number[]; // half width of the water at each point
  t: V2[]; // unit tangent (downstream)
  n: V2[]; // unit normal (left of the flow)
  length: number;
};

// Centripetal Catmull-Rom point between p1 and p2.
function catmull(p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 {
  const k = (a: V2, b: V2) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-4);
  const t0 = 0;
  const t1 = t0 + k(p0, p1);
  const t2 = t1 + k(p1, p2);
  const t3 = t2 + k(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const mix = (a: V2, b: V2, ta: number, tb: number): V2 => {
    const f = (tt - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

function extend(a: V2, b: V2, len: number): V2 {
  const du = a[0] - b[0];
  const dv = a[1] - b[1];
  const l = Math.hypot(du, dv);
  return [a[0] + (du / l) * len, a[1] + (dv / l) * len];
}

// The stream is drawn past both ends of STREAM.points so it disappears into the hills.
function buildStream(spacing: number): StreamPath {
  const c = STREAM.points;
  const ctrl: V2[] = [extend(c[0], c[1], 48), ...c, extend(c[c.length - 1], c[c.length - 2], 42)];
  const dense: V2[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = i > 0 ? ctrl[i - 1] : extend(ctrl[0], ctrl[1], 10);
    const p3 = i + 2 < ctrl.length ? ctrl[i + 2] : extend(ctrl[ctrl.length - 1], ctrl[ctrl.length - 2], 10);
    for (let k = 0; k < 40; k++) dense.push(catmull(p0, ctrl[i], ctrl[i + 1], p3, k / 40));
  }
  dense.push(ctrl[ctrl.length - 1]);
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = acc[acc.length - 1];
  const count = Math.ceil(total / spacing);
  const pts: V2[] = [];
  const s: number[] = [];
  let j = 0;
  for (let i = 0; i <= count; i++) {
    const target = (i / count) * total;
    while (j < acc.length - 2 && acc[j + 1] < target) j++;
    const f = (target - acc[j]) / Math.max(acc[j + 1] - acc[j], 1e-6);
    pts.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f]);
    s.push(target);
  }
  const t: V2[] = [];
  const n: V2[] = [];
  const w: number[] = [];
  const base = STREAM.width / 2;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[Math.min(i + 1, pts.length - 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tu = (b[0] - a[0]) / l;
    const tv = (b[1] - a[1]) / l;
    t.push([tu, tv]);
    n.push([-tv, tu]);
    // Gentle width variation so the banks do not look ruled.
    w.push(base * (1 + 0.13 * (2 * vnoise(s[i] / 16, 4.2) - 1)));
  }
  return { pts, s, w, t, n, length: total };
}

export const STREAM_PATH = buildStream(1);
export const STREAM_COARSE = buildStream(2);

// Signed distance to the water edge (negative in the water), brute force over the coarse path.
// Use the baked field (mask.ts) when calling this in bulk.
export function streamEdgeExact(u: number, v: number): number {
  const p = STREAM_COARSE;
  let best = Infinity;
  for (let i = 0; i < p.pts.length - 1; i++) {
    const a = p.pts[i];
    const b = p.pts[i + 1];
    const tt = clamp(segParam(u, v, a[0], a[1], b[0], b[1]), 0, 1);
    const d = Math.hypot(u - a[0] - (b[0] - a[0]) * tt, v - a[1] - (b[1] - a[1]) * tt) - (p.w[i] + (p.w[i + 1] - p.w[i]) * tt);
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------- bridge

// STREAM.bridges[0] is where the road meets the raw polyline; the smoothed stream crosses the road
// about 2 m away, so the deck is centred on the real crossing along the same road.
function bridgeCrossing() {
  const br = STREAM.bridges[0];
  let seg = SEGMENTS[0];
  let segD = Infinity;
  for (const s of SEGMENTS) {
    const d = segDist(br.u, br.v, s.a[0], s.a[1], s.b[0], s.b[1]);
    if (d < segD) {
      segD = d;
      seg = s;
    }
  }
  let best = { u: br.u, v: br.v, e: Infinity };
  for (let t = 0; t <= 1; t += 0.001) {
    const u = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
    const v = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
    if (Math.hypot(u - br.u, v - br.v) > 8) continue;
    const e = streamEdgeExact(u, v);
    if (e < best.e) best = { u, v, e };
  }
  const len = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
  return { u: best.u, v: best.v, dir: [(seg.b[0] - seg.a[0]) / len, (seg.b[1] - seg.a[1]) / len] as V2, roadHalf: seg.half };
}

const BC0 = bridgeCrossing();
export const BRIDGE = {
  ...BC0,
  length: 13.5, // deck length along the road (m)
  width: 6.2, // deck width (m)
};

// ---------------------------------------------------------------- hills

// Height of the valley walls at a screen point (0 inside BOUNDS). `streamEdge` is the distance to
// the water edge so the stream gets a gorge where it leaves the valley.
export function hillHeight(u: number, v: number, streamEdge: number): number {
  const s = outside(u, v);
  if (s <= 0) return 0;
  const n1 = fbm(u / 70, v / 70, 3);
  const n2 = fbm(u / 34 + 11.3, v / 34 - 4.1, 3);
  const ridge = 1 - Math.abs(2 * n2 - 1);
  const foot = 2.4 * smoothstep(0, 4, s);
  const near = (11 + 14 * n1) * smoothstep(1, 24, s);
  const far = (22 + 34 * ridge * ridge) * smoothstep(30, 92, s);
  const bumps = (4.5 * (vnoise(u / 12, v / 12) - 0.5) + 2 * (vnoise(u / 5, v / 5) - 0.5)) * smoothstep(3, 12, s);
  let h = foot + near + far + bumps;
  // Towards the camera (below v0) the hills stay under a 30 deg line so they never hide the car.
  const below = BOUNDS.v0 - v;
  h = Math.min(h, below > 0 ? 0.55 * below : 3 * -below + 0.5);
  // Gorge for the stream; it closes again far outside the valley, hiding the stream's ends.
  const open = 1 - smoothstep(30, 46, s);
  if (open > 0) {
    const g = smoothstep(3, 28, streamEdge);
    h *= 1 - open * (1 - g);
    h = h + (-1.6 - h) * open * (1 - smoothstep(1, 6.5, streamEdge));
  }
  return h;
}

// Snow line height for the far ring.
export const snowLine = (u: number, v: number) => 34 + 8 * (vnoise(u / 23, v / 23) - 0.5);

// True on (or just around) the bridge deck.
export function onBridge(u: number, v: number, margin = 0.5): boolean {
  const du = u - BRIDGE.u;
  const dv = v - BRIDGE.v;
  const along = du * BRIDGE.dir[0] + dv * BRIDGE.dir[1];
  const across = -du * BRIDGE.dir[1] + dv * BRIDGE.dir[0];
  return Math.abs(along) < BRIDGE.length / 2 + margin && Math.abs(across) < BRIDGE.width / 2 + margin;
}
