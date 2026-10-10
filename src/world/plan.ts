// Deterministic placement of everything in the valley: trees, rocks, ground cover, lamps, prayer
// flags. Screen coordinates throughout (see geo.ts). The low quality tier keeps a stable subset of
// the high tier, so switching tiers never moves anything.
import { BOUNDS, ZONE_BY_ID } from '../config/layout.ts';
import type { ModelName } from '../config/models.ts';
import type { Quality } from '../state/store.ts';
import { streamEdgeAt } from './field.ts';
import { ASPHALT, BRIDGE, DIRT, RING, STREAM_PATH, TRAIL, TRAIL_HALF, hillHeight, outside, roadDist, trailDist, zoneDist } from './geo.ts';
import type { V2 } from './geo.ts';
import { clamp, fbm, hash2, pick, range, rng, smoothstep, vnoise } from './rand.ts';

export type Item = {
  name: ModelName;
  u: number;
  v: number;
  y: number; // base height
  s: number; // uniform scale on top of the model's world scale
  ry: number; // yaw (radians, in the FACE_CAMERA_Y frame)
  tilt?: [number, number]; // small x/z lean
  keep: number; // stable hash; the low tier drops items with keep > its ratio
};

export type Collider = { kind: 'cyl'; u: number; v: number; r: number; h: number } | { kind: 'ball'; u: number; v: number; r: number; y: number };

export type Lamp = { kind: 'street' | 'lantern'; u: number; v: number; ry: number; head: [number, number, number] };
export type FlagString = { a: [number, number, number]; b: [number, number, number]; sag: number };
export type Pole = { u: number; v: number; y: number; h: number; mast: boolean }; // mast: draw the Kenney pole
export type Marker = { u: number; v: number; ry: number };

export type Plan = {
  trees: Item[];
  hillTrees: Item[];
  rocks: Item[];
  cover: Item[]; // grass, flowers, mushrooms (no colliders)
  props: Item[]; // logs, stumps, river stones
  lamps: Lamp[];
  strings: FlagString[];
  poles: Pole[];
  darchog: Item[];
  foam: { u: number; v: number; r: number }[]; // white water around rocks in the stream
  markers: Marker[]; // trail marker posts along the bike trail
};

const HUB = ZONE_BY_ID.hub.center;
let full: Plan | null = null;
const cache = new Map<Quality, Plan>();
export const ISLAND_Y = 0.1; // top of the roundabout island
const TREE_TYPES: ModelName[] = ['tree-deodar-tall', 'tree-deodar', 'tree-pine-full', 'tree-pine-cone'];
// Trunk collider radius per unit scale; covers the lowest branches the car could touch.
const TREE_R: Partial<Record<ModelName, number>> = {
  'tree-deodar-tall': 0.65, 'tree-deodar': 0.65, 'tree-pine-full': 0.6, 'tree-pine-cone': 0.5, 'tree-pine-snow': 0.6,
};
// Rough footprint radius (m at scale 1) and height for rocks, used for colliders and spacing.
const ROCK_R: Partial<Record<ModelName, [number, number]>> = {
  'rock-grey-a': [0.7, 0.98], 'rock-grey-b': [0.95, 1.05], 'rock-grey-c': [0.85, 1.27],
  'rocks-snowcap-large': [2.0, 2.57], 'rocks-snowcap-small': [1.0, 0.97],
};

const insideBounds = (u: number, v: number, m: number) => u > BOUNDS.u0 + m && u < BOUNDS.u1 - m && v > BOUNDS.v0 + m && v < BOUNDS.v1 - m;

type Clear = { zone: number; road: number; stream: number; trail?: number };
const TREE_CLEAR: Clear = { zone: 4, road: 4, stream: 3, trail: 2.4 };

function isClear(u: number, v: number, c: Clear, extra = 0): boolean {
  if (zoneDist(u, v) < c.zone + extra) return false;
  if (roadDist(u, v) < c.road + extra) return false;
  if (streamEdgeAt(u, v) < c.stream + extra) return false;
  if (c.trail !== undefined && trailDist(u, v) < c.trail + TRAIL_HALF + extra) return false;
  return true;
}

// Spatial hash so new items keep their distance from existing ones.
class Spacing {
  private cells = new Map<number, [number, number, number][]>();
  private size: number;
  constructor(size = 6) {
    this.size = size;
  }
  private key(i: number, j: number) {
    return (i + 4096) * 8192 + (j + 4096);
  }
  add(u: number, v: number, r: number) {
    const k = this.key(Math.floor(u / this.size), Math.floor(v / this.size));
    const list = this.cells.get(k);
    if (list) list.push([u, v, r]);
    else this.cells.set(k, [[u, v, r]]);
  }
  free(u: number, v: number, r: number): boolean {
    const i = Math.floor(u / this.size);
    const j = Math.floor(v / this.size);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const list = this.cells.get(this.key(i + di, j + dj));
        if (!list) continue;
        for (const [pu, pv, pr] of list) if (Math.hypot(u - pu, v - pv) < r + pr) return false;
      }
    return true;
  }
}

// Screen point on the bridge: `along` the road from the deck centre, `across` to its left.
export const bridgePoint = (along: number, across: number): [number, number] => [
  BRIDGE.u + BRIDGE.dir[0] * along - BRIDGE.dir[1] * across,
  BRIDGE.v + BRIDGE.dir[1] * along + BRIDGE.dir[0] * across,
];

// Lamps a zone module asks for (see addLamps); merged into the plan when it is first built.
const extraLamps: Lamp[] = [];

function makeLamp(kind: Lamp['kind'], u: number, v: number, nu: number, nv: number): Lamp {
  // The street lamp's arm points along its local -Z; (nu, nv) points from the road to the lamp.
  const ry = Math.atan2(nu, -nv);
  const head: [number, number, number] = kind === 'street' ? [u - nu * 1.35, v - nv * 1.35, 5.85] : [u, v, 4.15];
  return { kind, u, v, ry, head };
}

// For zone modules: add street lamps or lanterns that glow at night with the valley's lamps
// (instanced posts, bulbs, halos, light pools on the ground, colliders). Call it at module scope,
// before the world first renders. `toward` is the screen direction the street lamp's arm reaches.
export function addLamps(list: { kind: Lamp['kind']; u: number; v: number; toward?: [number, number] }[]) {
  for (const l of list) {
    const [tu, tv] = l.toward ?? [0, 1];
    const len = Math.hypot(tu, tv) || 1;
    extraLamps.push(makeLamp(l.kind, l.u, l.v, -tu / len, -tv / len));
  }
  full = null;
  cache.clear();
}

function buildLamps(): Lamp[] {
  const lamps: Lamp[] = [...extraLamps];
  const add = (kind: Lamp['kind'], segs: typeof ASPHALT, spacing: number, offset: number) => {
    for (const s of segs) {
      const du = s.b[0] - s.a[0];
      const dv = s.b[1] - s.a[1];
      const len = Math.hypot(du, dv);
      const tu = du / len;
      const tv = dv / len;
      for (const side of [1, -1]) {
        // Lamps on the camera side of a road would cross it on screen, so roads that run across
        // the screen only get lamps on their far side.
        if (side * tu < 0 && Math.abs(tu) > 0.3) continue;
        let last = side === 1 ? -Infinity : -spacing / 2; // stagger the two sides
        for (let d = 0; d < len; d += 0.5) {
          if (d - last < spacing) continue;
          const nu = -tv * side;
          const nv = tu * side;
          const u = s.a[0] + tu * d + nu * (s.half + offset);
          const v = s.a[1] + tv * d + nv * (s.half + offset);
          if (zoneDist(u, v) < 1.5) continue;
          if (Math.hypot(u - RING.u, v - RING.v) < RING.r + RING.half + 2.5) continue;
          if (Math.hypot(u - BRIDGE.u, v - BRIDGE.v) < BRIDGE.length / 2 + 3) continue;
          if (streamEdgeAt(u, v) < 1.5) continue;
          if (roadDist(u, v) < offset - 0.3) continue; // too close to another road
          if (lamps.some((l) => Math.hypot(l.u - u, l.v - v) < spacing * 0.6)) continue;
          last = d;
          lamps.push(makeLamp(kind, u, v, nu, nv));
        }
      }
    }
  };
  add('street', ASPHALT, 11, 1.3);
  add('lantern', DIRT, 11, 1.1);
  // Lanterns on the bridge abutments, one per side.
  for (const k of [-1, 1]) {
    const along = (BRIDGE.length / 2 + 0.9) * k;
    const across = (BRIDGE.width / 2 + 0.5) * k;
    const [u, v] = bridgePoint(along, across);
    lamps.push(makeLamp('lantern', u, v, 0, 1));
  }
  return lamps;
}

function buildFlags(r: () => number) {
  const strings: FlagString[] = [];
  const poles: Pole[] = [];
  const POLE_H = 6.3; // pole-prayer-flag-mast at world scale
  const pole = (u: number, v: number, h = POLE_H, y?: number, mast = true) => {
    const base = y ?? hillHeight(u, v, streamEdgeAt(u, v));
    poles.push({ u, v, y: base, h, mast });
    return [u, v, base + h - 0.25] as [number, number, number];
  };
  const string = (a: [number, number, number], b: [number, number, number], sag: number) => strings.push({ a, b, sag });

  // Gateway across the start of the career road.
  string(pole(-10.5, 34, POLE_H, 0), pole(10.5, 34, POLE_H, 0), 1.3);

  // Across the campus road, between the hub and the bridge.
  const camp = DIRT.find((s) => s.id === 'campus');
  if (camp) {
    const du = camp.b[0] - camp.a[0];
    const dv = camp.b[1] - camp.a[1];
    const len = Math.hypot(du, dv);
    const [tu, tv] = [du / len, dv / len];
    for (const t of [0.47, 0.585]) {
      const cu = camp.a[0] + du * t;
      const cv = camp.a[1] + dv * t;
      const off = camp.half + 2.6;
      string(pole(cu - tv * off, cv + tu * off, 5.2, 0), pole(cu + tv * off, cv - tu * off, 5.2, 0), 0.9);
    }
  }

  // Bridge: corner posts, a string along each rail and one across each end.
  const L = BRIDGE.length / 2 - 0.35;
  const W = BRIDGE.width / 2 + 0.05;
  const cs = [bridgePoint(-L, -W), bridgePoint(L, -W), bridgePoint(L, W), bridgePoint(-L, W)].map(([u, v]) => pole(u, v, 3.7, 0.12, false));
  string(cs[0], cs[1], 0.75);
  string(cs[3], cs[2], 0.75);
  string(cs[0], cs[3], 0.45);
  string(cs[1], cs[2], 0.45);

  // Across the stream where it leaves the valley.
  const exit = STREAM_PATH.pts.findIndex((p) => p[1] < BOUNDS.v0 + 8);
  if (exit > 0) {
    const [eu, ev] = STREAM_PATH.pts[exit];
    const [nu, nv] = STREAM_PATH.n[exit];
    const off = STREAM_PATH.w[exit] + 3.2;
    string(pole(eu + nu * off, ev + nv * off, POLE_H, 0), pole(eu - nu * off, ev - nv * off, POLE_H, 0), 1.1);
  }

  // Down the hillsides at the valley edge: [foot u, foot v, direction u, direction v].
  const slopes: [number, number, number, number][] = [
    [-74, 157, 0.35, 1], [-112, 157, -0.4, 1], [48, 157, 0.3, 1], [96, 157, -0.25, 1],
    [117, 66, 1, 0.2], [117, -10, 1, -0.35], [-191, 66, -1, 0.3], [-191, -40, -1, -0.2], [-150, 157, 0.2, 1],
  ];
  for (const [fu, fv, du, dv] of slopes) {
    const l = Math.hypot(du, dv);
    const len = 13 + r() * 6;
    const a = pole(fu, fv, POLE_H, 0);
    const b = pole(fu + (du / l) * len, fv + (dv / l) * len);
    string(a, b, 1.0 + r() * 0.4);
  }
  return { strings, poles };
}

// Vertical darchog banners in small groups.
function buildDarchog(r: () => number): Item[] {
  const out: Item[] = [];
  const names: ModelName[] = ['banner-darchog-blue', 'banner-darchog-red', 'banner-darchog-green'];
  const groups: V2[] = [[-46, -10], [-150, 62], [26, -44], [102, 70], [-8, -80], [-64, 120]];
  for (const [gu, gv] of groups) {
    // Nudge each group to the nearest clear spot.
    let spot: V2 | null = null;
    for (let k = 0; k < 60 && !spot; k++) {
      const a = k * 2.4;
      const d = k * 0.6;
      const u = gu + Math.cos(a) * d;
      const v = gv + Math.sin(a) * d;
      if (insideBounds(u, v, 3) && isClear(u, v, { zone: 3, road: 3, stream: 2 })) spot = [u, v];
    }
    if (!spot) continue;
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      out.push({
        name: names[i % names.length], u: spot[0] + Math.cos(a) * 1.1, v: spot[1] + Math.sin(a) * 1.1, y: 0,
        s: range(r, 0.62, 0.78), ry: range(r, -0.5, 0.5), keep: 0,
      });
    }
  }
  return out;
}

function treeType(r: () => number, edge: number): ModelName {
  if (edge < 18 && r() < 0.45 * (1 - edge / 18)) return 'tree-pine-snow';
  const x = r();
  return x < 0.36 ? TREE_TYPES[0] : x < 0.66 ? TREE_TYPES[1] : x < 0.85 ? TREE_TYPES[2] : TREE_TYPES[3];
}

function build(): Plan {
  const r = rng(20240611);
  const spacing = new Spacing(6);
  const trees: Item[] = [];
  const lamps = buildLamps();
  const { strings, poles } = buildFlags(r);
  for (const l of lamps) spacing.add(l.u, l.v, 1.2);
  for (const p of poles) spacing.add(p.u, p.v, 1.2);
  const darchog = buildDarchog(r);
  for (const d of darchog) spacing.add(d.u, d.v, 1.0);
  // Marker posts every 20 m along the bike trail, on alternating sides.
  const markers: Marker[] = [];
  for (let i = 4, side = 1; i < TRAIL.length - 1; i += 13, side = -side) {
    const [au, av] = TRAIL[i];
    const [bu, bv] = TRAIL[i + 1];
    const l = Math.hypot(bu - au, bv - av) || 1;
    const nu = -(bv - av) / l;
    const nv = (bu - au) / l;
    const u = au + nu * (TRAIL_HALF + 0.7) * side;
    const v = av + nv * (TRAIL_HALF + 0.7) * side;
    markers.push({ u, v, ry: Math.atan2(nu, -nv) });
    spacing.add(u, v, 0.8);
  }

  // ---- trees inside the valley
  const cell = 5.5;
  for (let gu = BOUNDS.u0; gu < BOUNDS.u1; gu += cell)
    for (let gv = BOUNDS.v0; gv < BOUNDS.v1; gv += cell) {
      const u = gu + r() * cell;
      const v = gv + r() * cell;
      const roll = r();
      if (!insideBounds(u, v, 1.5)) continue;
      if (!isClear(u, v, TREE_CLEAR, 1.2)) continue;
      const hubD = Math.hypot(u - HUB[0], v - HUB[1]);
      const edge = -outside(u, v);
      // Forest along the valley walls, a few distinct groves, and lone trees on the meadows.
      const wall = (1 - smoothstep(6, 40, edge + (vnoise(u / 30, v / 30) - 0.5) * 24)) * 0.46;
      const grove = smoothstep(0.54, 0.7, fbm(u / 38 + 3.1, v / 38 - 7.7, 3)) * 0.5;
      let density = Math.max(wall, grove) * smoothstep(28, 70, hubD) + 0.025;
      density *= smoothstep(4, 11, roadDist(u, v)) * 0.6 + 0.4;
      if (roll > clamp(density, 0, 0.8)) continue;
      const name = treeType(r, edge);
      const s = range(r, 0.82, 1.18);
      if (!spacing.free(u, v, 2.0 * s)) continue;
      spacing.add(u, v, 2.0 * s);
      trees.push({ name, u, v, y: 0, s, ry: r() * Math.PI * 2, keep: hash2(Math.round(u * 10), Math.round(v * 10)) });
    }

  // ---- rocks inside the valley, more near the edges and the stream
  const rocks: Item[] = [];
  const rockNames: ModelName[] = ['rock-grey-a', 'rock-grey-b', 'rock-grey-c'];
  for (let i = 0; i < 2600 && rocks.length < 95; i++) {
    const u = range(r, BOUNDS.u0 + 2, BOUNDS.u1 - 2);
    const v = range(r, BOUNDS.v0 + 2, BOUNDS.v1 - 2);
    const edge = -outside(u, v);
    const se = streamEdgeAt(u, v);
    const want = 0.05 + 0.5 * (1 - smoothstep(0, 30, edge)) + 0.5 * (1 - smoothstep(3, 14, se));
    if (r() > want) continue;
    if (!isClear(u, v, { zone: 4, road: 4, stream: 2.2, trail: 1.6 }, 0.6)) continue;
    const snow = edge < 22 && r() < 0.5;
    const name = snow ? (r() < 0.35 ? 'rocks-snowcap-large' : 'rocks-snowcap-small') : pick(r, rockNames);
    const s = snow ? range(r, 0.75, 1.1) : range(r, 0.7, 1.6);
    const [rr] = ROCK_R[name] ?? [0.8, 1];
    if (!spacing.free(u, v, rr * s + 0.6)) continue;
    spacing.add(u, v, rr * s + 0.4);
    rocks.push({ name, u, v, y: -0.08 * s, s, ry: r() * Math.PI * 2, keep: hash2(Math.round(u * 7), Math.round(v * 7)) });
  }

  // ---- the stream: boulders in the water, stones and pebbles along the edges
  const props: Item[] = [];
  const foam: Plan['foam'] = [];
  const sp = STREAM_PATH;
  for (let i = 6; i < sp.pts.length - 6; i += 1) {
    const [pu, pv] = sp.pts[i];
    const [nu, nv] = sp.n[i];
    const w = sp.w[i];
    if (Math.hypot(pu - BRIDGE.u, pv - BRIDGE.v) < 11) continue;
    if (outside(pu, pv) > 26) continue;
    const roll = r();
    if (roll < 0.075) {
      // Boulder in the water, off-centre.
      const side = r() < 0.5 ? -1 : 1;
      const off = side * range(r, 0.25, 0.8) * w;
      const u = pu + nu * off;
      const v = pv + nv * off;
      if (zoneDist(u, v) < 4) continue;
      const s = range(r, 0.75, 1.35);
      props.push({ name: pick(r, rockNames), u, v, y: -0.62, s, ry: r() * 6.28, keep: hash2(i, 3) });
      foam.push({ u, v, r: 0.9 * s + 0.5 });
    } else if (roll < 0.15) {
      // Flat stones in the shallows.
      const side = r() < 0.5 ? -1 : 1;
      const off = side * (w - range(r, 0.4, 1.1));
      props.push({ name: 'stones-river-flat', u: pu + nu * off, v: pv + nv * off, y: -0.31, s: range(r, 0.45, 0.7), ry: r() * 6.28, keep: hash2(i, 5) });
    } else if (roll < 0.21) {
      // Bank boulder.
      const side = r() < 0.5 ? -1 : 1;
      const off = side * (w + range(r, 0.6, 1.6));
      const u = pu + nu * off;
      const v = pv + nv * off;
      if (roadDist(u, v) < 3 || zoneDist(u, v) < 4) continue;
      const s = range(r, 0.6, 1.0);
      props.push({ name: pick(r, rockNames), u, v, y: -0.25, s, ry: r() * 6.28, keep: hash2(i, 7) });
    }
  }

  // White water around the bridge pier.
  for (const k of [-1, 1]) {
    const [fu, fv] = bridgePoint(0, k * (BRIDGE.width / 2 - 0.2));
    foam.push({ u: fu, v: fv, r: 1.5 });
  }

  // ---- logs and stumps in the woods
  for (let i = 0, n = 0; i < 900 && n < 34; i++) {
    const t = trees[Math.floor(r() * trees.length)];
    if (!t) break;
    const a = r() * Math.PI * 2;
    const d = range(r, 2.6, 4.5);
    const u = t.u + Math.cos(a) * d;
    const v = t.v + Math.sin(a) * d;
    if (!insideBounds(u, v, 2) || !isClear(u, v, TREE_CLEAR, 0.8)) continue;
    const kind = r();
    if (kind < 0.45) {
      if (!spacing.free(u, v, 1.6)) continue;
      spacing.add(u, v, 1.4);
      props.push({ name: 'log', u, v, y: 0.18, s: range(r, 0.9, 1.15), ry: r() * Math.PI, keep: hash2(Math.round(u * 5), Math.round(v * 5)) });
    } else {
      if (!spacing.free(u, v, 0.9)) continue;
      spacing.add(u, v, 0.7);
      props.push({ name: 'stump', u, v, y: 0, s: range(r, 0.9, 1.3), ry: r() * 6.28, keep: hash2(Math.round(u * 5), Math.round(v * 5)) });
    }
    n++;
  }

  // ---- ground cover
  const cover: Item[] = [];
  // Grass may grow close to road edges (it softens them and nothing collides with it); flowers
  // and mushrooms keep the full 4 m from zones.
  const COVER_CLEAR: Clear = { zone: 3, road: 1.2, stream: 0.7, trail: 0.3 };
  const coverOk = (u: number, v: number, zone = 3) =>
    insideBounds(u, v, 1) && isClear(u, v, { ...COVER_CLEAR, zone }) && Math.hypot(u - RING.u, v - RING.v) > RING.r + RING.half + 0.8;
  // Grass in clumps.
  const roadSegs = [...ASPHALT, ...DIRT];
  for (let i = 0; i < 300; i++) {
    let cu = range(r, BOUNDS.u0, BOUNDS.u1);
    let cv = range(r, BOUNDS.v0, BOUNDS.v1);
    if (i % 4 === 0) {
      // Along a road edge.
      const sg = roadSegs[Math.floor(r() * roadSegs.length)];
      const t = r();
      const len = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]);
      const side = r() < 0.5 ? -1 : 1;
      const off = sg.half + range(r, 1.6, 3.2);
      cu = sg.a[0] + (sg.b[0] - sg.a[0]) * t + (-(sg.b[1] - sg.a[1]) / len) * off * side;
      cv = sg.a[1] + (sg.b[1] - sg.a[1]) * t + ((sg.b[0] - sg.a[0]) / len) * off * side;
    }
    const n = 2 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const u = cu + range(r, -1.6, 1.6);
      const v = cv + range(r, -1.6, 1.6);
      if (!coverOk(u, v)) continue;
      const name: ModelName = r() < 0.75 ? 'grass-tuft' : 'grass-clump';
      cover.push({ name, u, v, y: 0, s: name === 'grass-tuft' ? range(r, 0.42, 0.68) : range(r, 0.4, 0.6), ry: r() * 6.28, keep: hash2(i * 7 + k, 11) });
    }
  }
  // Grass along the stream banks.
  for (let i = 4; i < sp.pts.length - 4; i += 2) {
    if (outside(sp.pts[i][0], sp.pts[i][1]) > 4) continue;
    for (const side of [-1, 1]) {
      if (r() < 0.45) continue;
      const off = side * (sp.w[i] + range(r, 1.1, 2.6));
      const u = sp.pts[i][0] + sp.n[i][0] * off;
      const v = sp.pts[i][1] + sp.n[i][1] * off;
      if (!coverOk(u, v)) continue;
      cover.push({ name: r() < 0.6 ? 'grass-tuft' : 'grass-clump', u, v, y: 0, s: range(r, 0.45, 0.7), ry: r() * 6.28, keep: hash2(i, side + 20) });
    }
  }
  // Flower patches: blue poppies and red flowers, in meadows and along the stream.
  for (let i = 0; i < 70; i++) {
    let cu = 0;
    let cv = 0;
    if (i < 22) {
      const k = 8 + Math.floor(r() * (sp.pts.length - 16));
      const side = r() < 0.5 ? -1 : 1;
      const off = side * (sp.w[k] + range(r, 1.6, 4));
      cu = sp.pts[k][0] + sp.n[k][0] * off;
      cv = sp.pts[k][1] + sp.n[k][1] * off;
    } else {
      cu = range(r, BOUNDS.u0 + 6, BOUNDS.u1 - 6);
      cv = range(r, BOUNDS.v0 + 6, BOUNDS.v1 - 6);
      if (vnoise(cu / 30, cv / 30) < 0.42) continue;
    }
    const blue = r() < 0.62;
    const n = 3 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const u = cu + range(r, -2.2, 2.2);
      const v = cv + range(r, -2.2, 2.2);
      if (!coverOk(u, v, 4)) continue;
      const name: ModelName = blue ? 'flowers-blue-poppy' : 'flowers-tall';
      cover.push({ name, u, v, y: 0, s: blue ? range(r, 0.42, 0.62) : range(r, 0.5, 0.72), ry: r() * 6.28, keep: hash2(i * 13 + k, 17) });
    }
  }
  // Mushrooms under some trees.
  for (const t of trees) {
    const x = r();
    if (x > 0.24) continue;
    const a = r() * Math.PI * 2;
    const d = range(r, 1.2, 2.6);
    const u = t.u + Math.cos(a) * d;
    const v = t.v + Math.sin(a) * d;
    if (!coverOk(u, v, 4)) continue;
    if (x > 0.12) continue;
    cover.push({ name: 'mushrooms', u, v, y: 0, s: range(r, 0.55, 0.8), ry: r() * 6.28, keep: t.keep });
  }

  // ---- along the foot of the valley walls: rocks and grass break up the straight seam
  {
    const per = 2 * (BOUNDS.u1 - BOUNDS.u0) + 2 * (BOUNDS.v1 - BOUNDS.v0);
    for (let d = 0; d < per; d += 3.2) {
      let u = 0;
      let v = 0;
      let nu = 0;
      let nv = 0;
      const w = BOUNDS.u1 - BOUNDS.u0;
      const h = BOUNDS.v1 - BOUNDS.v0;
      if (d < w) [u, v, nu, nv] = [BOUNDS.u0 + d, BOUNDS.v1, 0, 1];
      else if (d < w + h) [u, v, nu, nv] = [BOUNDS.u1, BOUNDS.v1 - (d - w), 1, 0];
      else if (d < 2 * w + h) [u, v, nu, nv] = [BOUNDS.u1 - (d - w - h), BOUNDS.v0, 0, -1];
      else [u, v, nu, nv] = [BOUNDS.u0, BOUNDS.v0 + (d - 2 * w - h), -1, 0];
      const off = range(r, -1.8, 1.4);
      const along = range(r, -1.2, 1.2);
      u += nu * off + nv * along;
      v += nv * off - nu * along;
      if (zoneDist(u, v) < 2 || streamEdgeAt(u, v) < 2.5 || roadDist(u, v) < 2) continue;
      const roll = r();
      if (roll < 0.22) {
        const name = pick(r, rockNames);
        const sc = range(r, 0.6, 1.25);
        const [rr] = ROCK_R[name] ?? [0.8, 1];
        if (!spacing.free(u, v, rr * sc + 0.3)) continue;
        spacing.add(u, v, rr * sc + 0.2);
        rocks.push({ name, u, v, y: Math.max(0, hillHeight(u, v, 24)) - 0.12 * sc, s: sc, ry: r() * 6.28, keep: hash2(Math.round(u * 3), Math.round(v * 3) + 31) });
      } else if (roll < 0.75) {
        cover.push({ name: r() < 0.6 ? 'grass-tuft' : 'grass-clump', u, v, y: Math.max(0, hillHeight(u, v, 24)) - 0.05, s: range(r, 0.5, 0.75), ry: r() * 6.28, keep: hash2(Math.round(u * 3), Math.round(v * 3) + 57) });
      }
    }
  }

  // ---- trees and rocks on the hills, where the camera can see them
  const hillTrees: Item[] = [];
  const hcell = 6;
  for (let gu = BOUNDS.u0 - 60; gu < BOUNDS.u1 + 60; gu += hcell)
    for (let gv = BOUNDS.v0 - 40; gv < BOUNDS.v1 + 60; gv += hcell) {
      const u = gu + r() * hcell;
      const v = gv + r() * hcell;
      const roll = r();
      const s0 = outside(u, v);
      if (s0 < 1.5 || s0 > 34) continue;
      // Below the valley (towards the camera) trees would hide the car; keep them far out.
      if (v < BOUNDS.v0 && BOUNDS.v0 - v < 19) continue;
      const se = streamEdgeAt(u, v);
      if (se < 4) continue;
      const h = hillHeight(u, v, se);
      if (h < 0.4 || h > 30) continue;
      // Slope from central differences; skip cliffs.
      const gx = hillHeight(u + 1, v, se) - hillHeight(u - 1, v, se);
      const gy = hillHeight(u, v + 1, se) - hillHeight(u, v - 1, se);
      const slope = Math.hypot(gx, gy) / 2;
      if (slope > 1.5) continue;
      const forest = smoothstep(0.3, 0.55, fbm(u / 40 - 2.2, v / 40 + 5.3, 3));
      const want = (0.3 + 0.7 * forest) * (1 - smoothstep(22, 32, h)) * (1 - 0.5 * smoothstep(22, 40, s0));
      if (roll > want) continue;
      const snowy = h > 14 + 6 * vnoise(u / 20, v / 20);
      const name: ModelName = snowy ? 'tree-pine-snow' : pick(r, ['tree-deodar-tall', 'tree-deodar', 'tree-pine-cone', 'tree-pine-full'] as ModelName[]);
      // Sunk by the slope so the downhill side of the trunk never floats.
      hillTrees.push({ name, u, v, y: h - 0.35 - slope * 0.6, s: range(r, 0.85, 1.25), ry: r() * 6.28, keep: hash2(Math.round(u), Math.round(v) + 999) });
    }
  for (let i = 0, n = 0; i < 1400 && n < 70; i++) {
    const u = range(r, BOUNDS.u0 - 50, BOUNDS.u1 + 50);
    const v = range(r, BOUNDS.v0 - 30, BOUNDS.v1 + 50);
    const s0 = outside(u, v);
    if (s0 < 2 || s0 > 42) continue;
    const se = streamEdgeAt(u, v);
    if (se < 3) continue;
    const h = hillHeight(u, v, se);
    if (h < 1) continue;
    const name: ModelName = h > 9 ? (r() < 0.5 ? 'rocks-snowcap-large' : 'rocks-snowcap-small') : pick(r, rockNames);
    rocks.push({ name, u, v, y: h - 0.35, s: range(r, 0.9, 1.6), ry: r() * 6.28, keep: hash2(Math.round(u * 3), Math.round(v * 3) + 77) });
    n++;
  }

  return { trees, hillTrees, rocks, cover, props, lamps, strings, poles, darchog, foam, markers };
}

// Share of decor kept in the low tier.
const LOW_KEEP = { trees: 0.62, hillTrees: 0.55, rocks: 0.6, props: 0.7 };

export function getPlan(quality: Quality): Plan {
  const hit = cache.get(quality);
  if (hit) return hit;
  if (!full) full = build();
  let p = full;
  if (quality === 'low') {
    p = {
      ...full,
      trees: full.trees.filter((t) => t.keep < LOW_KEEP.trees),
      hillTrees: full.hillTrees.filter((t) => t.keep < LOW_KEEP.hillTrees),
      rocks: full.rocks.filter((t) => t.keep < LOW_KEEP.rocks),
      props: full.props.filter((t) => t.keep < LOW_KEEP.props),
      // No grass on the low tier; a few flowers stay for colour.
      cover: full.cover.filter((c) => !c.name.startsWith('grass') && c.keep < 0.45),
    };
  }
  cache.set(quality, p);
  return p;
}

// Fixed colliders for everything the car can hit inside the valley (nothing outside the walls).
export function collidersFor(p: Plan): Collider[] {
  const out: Collider[] = [];
  for (const t of p.trees) out.push({ kind: 'cyl', u: t.u, v: t.v, r: (TREE_R[t.name] ?? 0.6) * t.s, h: 3.2 });
  for (const k of p.rocks) {
    if (outside(k.u, k.v) > -0.5) continue;
    const [rr, hh] = ROCK_R[k.name] ?? [0.8, 1];
    if (hh * k.s > 0.55) out.push({ kind: 'cyl', u: k.u, v: k.v, r: rr * k.s * 0.85, h: hh * k.s });
    else out.push({ kind: 'ball', u: k.u, v: k.v, r: rr * k.s * 0.7, y: -rr * k.s * 0.25 });
  }
  for (const q of p.poles) if (q.mast && outside(q.u, q.v) < -0.3) out.push({ kind: 'cyl', u: q.u, v: q.v, r: 0.3, h: 6 });
  for (const d of p.darchog) out.push({ kind: 'cyl', u: d.u, v: d.v, r: 0.17, h: 4 });
  for (const m of p.markers) out.push({ kind: 'cyl', u: m.u, v: m.v, r: 0.14, h: 1.1 });
  for (const k of p.props) {
    if (outside(k.u, k.v) > -0.5) continue;
    if (k.name === 'stump') out.push({ kind: 'cyl', u: k.u, v: k.v, r: 0.42 * k.s, h: 1.15 * k.s });
    else if (k.name === 'log') {
      // A lying log is a row of balls along its axis (local Z), so the car rolls over it.
      const half = 1.15 * k.s;
      const au = -Math.sin(k.ry);
      const av = Math.cos(k.ry);
      for (const f of [-0.6, 0, 0.6]) out.push({ kind: 'ball', u: k.u + au * half * f, v: k.v + av * half * f, r: 0.32 * k.s, y: 0.12 });
    } else if (k.name.startsWith('rock-')) {
      // Stream and bank boulders: block like other rocks when they stand tall, else a low bump.
      const [rr, hh] = ROCK_R[k.name] ?? [0.8, 1];
      const top = k.y + hh * k.s;
      if (top > 0.45) out.push({ kind: 'cyl', u: k.u, v: k.v, r: rr * k.s * 0.78, h: top });
      else out.push({ kind: 'ball', u: k.u, v: k.v, r: 0.6 * k.s, y: top - 0.6 * k.s });
    }
  }
  return out;
}
