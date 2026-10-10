// Outline, rail line, cliff faces and collider boxes of the ridge, in the ridge frame (see
// profile.ts). Plain arrays and math, shared by the meshes, the colliders and the headless sim.
import { CHAMFER, FLARE_S0, FLARE_S1, MOUTH_PEAK, MOUTH_S0, MOUTH_S1, RAIL_INSET, S_END, deckY, hwAt } from './profile.ts';

export const DECK_S0 = MOUTH_S0; // the deck mesh starts on the approach road, before the ramp
export const RAIL_S0 = MOUTH_PEAK; // rails start a little way up the ramp, where the funnel is widest
// Collider heights above the deck. Taller than the visible rail so a car that hops a crest still
// meets it; the summit plaza and its far end are taller again because cars arrive there boosting.
export const RAIL_H = 1.7;
export const PLAZA_RAIL_H = 2.4;
export const END_WALL_H = 3.2;
export const RAIL_T = 0.7; // collider thickness (the extra sits outside, over the cliff edge)
export const RAIL_VIS_T = 0.26; // visible beam and post width
export const FACE_FOOT = -0.25; // faces run a little below the ground
// Horizontal run of the cliff per metre of height: steep on the camera side, gentle at the back.
const RUN_FRONT = 0.28;
const RUN_BACK = 0.95;
const RUN_END = 0.45;

export type V2 = { x: number; z: number };
export type OutlinePoint = V2 & { s: number; y: number; n: V2 }; // n: outward normal (unit, xz)

// Distances along the road where the outline gets a vertex: `step` apart on the straight road,
// finer through the funnel at the foot and the flared mouth of the plaza.
export function outlineS(step: number, from = DECK_S0): number[] {
  const out: number[] = [];
  const push = (s: number) => {
    if (!out.length || s > out[out.length - 1] + 1e-6) out.push(s);
  };
  const run = (a: number, b: number, st: number) => {
    if (b <= a) return;
    const n = Math.max(1, Math.ceil((b - a) / st - 1e-9));
    for (let i = 0; i <= n; i++) push(a + ((b - a) * i) / n);
  };
  run(from, MOUTH_S1, Math.min(step, 0.5));
  run(Math.max(from, MOUTH_S1), FLARE_S0, step);
  run(Math.max(from, FLARE_S0), FLARE_S1, Math.min(step, 0.5));
  run(Math.max(from, FLARE_S1), S_END - CHAMFER, step);
  push(S_END);
  return out;
}

const norm = (x: number, z: number): V2 => {
  const l = Math.hypot(x, z) || 1;
  return { x: x / l, z: z / l };
};

// Outward normals for an open polyline whose interior lies on the left of travel (miter-averaged at
// inner vertices, so offset copies stay parallel).
function normals(pts: V2[]): { n: V2; miter: number }[] {
  const seg: V2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const d = norm(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    seg.push({ x: d.z, z: -d.x });
  }
  return pts.map((_, i) => {
    const a = seg[Math.max(0, i - 1)];
    const b = seg[Math.min(seg.length - 1, i)];
    const n = norm(a.x + b.x, a.z + b.z);
    const cos = Math.max(0.35, n.x * a.x + n.z * a.z);
    return { n, miter: 1 / cos };
  });
}

// The deck edge as one U-shaped polyline: up the camera side (+z) to the far end of the plaza, across
// it, and back down the far side (-z). Heights are the deck height at each point.
export function outline(step: number, from = DECK_S0): OutlinePoint[] {
  const ss = outlineS(step, from);
  const front = ss.map((s) => ({ s, x: -s, z: hwAt(s) }));
  const back = ss.map((s) => ({ s, x: -s, z: -hwAt(s) })).toReversed();
  const pts = [...front, ...back];
  const ns = normals(pts);
  return pts.map((p, i) => ({ ...p, y: deckY(p.s), n: ns[i].n }));
}

// Rail centre line: the deck outline moved inwards by RAIL_INSET.
export function railLine(step: number): OutlinePoint[] {
  const ss = outlineS(step, RAIL_S0);
  const front = ss.map((s) => ({ s, x: -s, z: hwAt(s) }));
  const back = ss.map((s) => ({ s, x: -s, z: -hwAt(s) })).toReversed();
  const pts = [...front, ...back];
  const ns = normals(pts);
  return pts.map((p, i) => {
    const { n, miter } = ns[i];
    const x = p.x - n.x * RAIL_INSET * miter;
    const z = p.z - n.z * RAIL_INSET * miter;
    return { s: -x, x, z, y: deckY(-x), n };
  });
}

// The rail line split into the camera side (s ascending) and the far side (s descending); the end
// wall replaces the rail across the far end of the plaza.
export function railSides(step: number): { front: OutlinePoint[]; back: OutlinePoint[] } {
  const line = railLine(step);
  const half = line.length / 2;
  return { front: line.slice(0, half), back: line.slice(half) };
}

// Horizontal run of the cliff below an outline point, by which way it faces.
export function faceRun(n: V2): number {
  const wf = Math.max(n.z, 0) ** 2;
  const wb = Math.max(-n.z, 0) ** 2;
  const we = Math.max(-n.x, 0) ** 2;
  return (wf * RUN_FRONT + wb * RUN_BACK + we * RUN_END + 1e-6 * RUN_FRONT) / (wf + wb + we + 1e-6);
}

// The camera-side cliff leans by a different amount along the ridge, so it folds like rock and the
// folds catch the light differently. 0.6..1.4 times the base lean, smooth along s.
export function frontFold(s: number): number {
  return 1 + 0.22 * Math.sin(s * 0.21 + 1.3) + 0.12 * Math.sin(s * 0.57 + 0.4) + 0.06 * Math.sin(s * 1.31 + 2.1);
}

// Horizontal run per metre of height at an outline point, folds included.
export function runAt(p: { s: number; n: V2 }): number {
  const front = Math.max(p.n.z, 0) ** 2;
  return faceRun(p.n) * (1 + (frontFold(p.s) - 1) * front);
}

// Top and bottom of the cliff under each outline point.
export function faceFoot(p: OutlinePoint): { x: number; y: number; z: number } {
  const run = runAt(p) * (p.y - FACE_FOOT);
  return { x: p.x + p.n.x * run, y: FACE_FOOT, z: p.z + p.n.z * run };
}

// The camera-side face at height y below a point s on the straight road (z of the face, and its
// lean in radians from vertical), for things painted on or standing against it.
export function frontFaceAt(s: number, y: number): { z: number; lean: number } {
  const run = runAt({ s, n: { x: 0, z: 1 } });
  return { z: hwAt(s) + run * (deckY(s) - y), lean: Math.atan(run) };
}

// Triangle soups for physics (indexed).
export type Trimesh = { vertices: Float32Array; indices: Uint32Array };

export function deckTrimesh(step: number): Trimesh {
  const ss = outlineS(step);
  const v: number[] = [];
  const idx: number[] = [];
  ss.forEach((s) => {
    const y = deckY(s);
    const hw = hwAt(s);
    v.push(-s, y, hw, -s, y, -hw);
  });
  for (let k = 0; k < ss.length - 1; k++) {
    const a = k * 2;
    const b = a + 2;
    // CCW seen from above (+y): front(k), back(k), back(k+1), front(k+1)
    idx.push(a, a + 1, b + 1, a, b + 1, b);
  }
  return { vertices: new Float32Array(v), indices: new Uint32Array(idx) };
}

export function faceTrimesh(step: number): Trimesh {
  const pts = outline(step);
  const v: number[] = [];
  const idx: number[] = [];
  pts.forEach((p) => {
    const f = faceFoot(p);
    v.push(p.x, p.y, p.z, f.x, f.y, f.z);
  });
  for (let k = 0; k < pts.length - 1; k++) {
    const a = k * 2;
    const b = a + 2;
    // outward-facing: top(k), top(k+1), foot(k+1), foot(k)
    idx.push(a, b, b + 1, a, b + 1, a + 1);
  }
  return { vertices: new Float32Array(v), indices: new Uint32Array(idx) };
}

export type Box = { position: [number, number, number]; halfExtents: [number, number, number]; quaternion: [number, number, number, number] };

// Quaternion from an orthonormal basis (columns X, Y, Z).
function basisQuat(X: number[], Y: number[], Z: number[]): [number, number, number, number] {
  const [m00, m10, m20] = X;
  const [m01, m11, m21] = Y;
  const [m02, m12, m22] = Z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

// A box from a to b (centre line), `up` metres tall above the line and `down` below, `t` thick,
// pushed `out` metres along the horizontal normal n.
export function segmentBox(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, n: V2, up: number, down: number, t: number, out: number, extend = 0.05): Box {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const X = [dx / len, dy / len, dz / len];
  // Y: world up with the along-segment part removed
  let Y = [-X[1] * X[0], 1 - X[1] * X[1], -X[1] * X[2]];
  const yl = Math.hypot(Y[0], Y[1], Y[2]) || 1;
  Y = [Y[0] / yl, Y[1] / yl, Y[2] / yl];
  const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
  const mid = (up - down) / 2;
  return {
    position: [(a.x + b.x) / 2 + n.x * out + Y[0] * mid, (a.y + b.y) / 2 + Y[1] * mid, (a.z + b.z) / 2 + n.z * out + Y[2] * mid],
    halfExtents: [len / 2 + extend, (up + down) / 2, t / 2],
    quaternion: basisQuat(X, Y, Z),
  };
}

// Collider height of the rail at a point: the plaza perimeter is taller.
export const railHeight = (s: number) => (s > FLARE_S0 ? PLAZA_RAIL_H : RAIL_H);

// The far end of the plaza is a solid wall taller than the chassis, so a boosting car cannot climb it.
// The deck trimesh needs FIX_INTERNAL_EDGES, or a car that hits the wall can wedge nose-up against it.
export const END_WALL_T = 1.2;
export const END_WALL_FACE = -(S_END - RAIL_INSET) + RAIL_VIS_T / 2; // x of the face the car meets
export function endWallBox(): Box {
  const y0 = deckY(S_END) - 0.3;
  const h = END_WALL_H + 0.3;
  return {
    position: [END_WALL_FACE - END_WALL_T / 2, y0 + h / 2, 0],
    halfExtents: [END_WALL_T / 2, h / 2, hwAt(S_END) + 0.2],
    quaternion: [0, 0, 0, 1],
  };
}

// Guard rail colliders: one box per rail segment, plus the end wall.
export function railBoxes(step: number): Box[] {
  const line = railLine(step);
  const boxes: Box[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const segN = norm(b.z - a.z, -(b.x - a.x));
    if (segN.x < -0.9) continue; // the end wall replaces the rail across the far end
    const n = norm(a.n.x + b.n.x, a.n.z + b.n.z);
    boxes.push(segmentBox(a, b, n, railHeight((a.s + b.s) / 2), 0.3, RAIL_T, (RAIL_T - RAIL_VIS_T) / 2));
  }
  boxes.push(endWallBox());
  return boxes;
}
