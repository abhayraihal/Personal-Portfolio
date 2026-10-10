// Meshes for the ridge, built once from profile.ts and shape.ts: the landform (rank strata on the
// camera side, grass on the far side), the deck with its paint, and the guard rail beams, as two
// vertex-coloured geometries.
import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { COLORS } from '../../config/palette.ts';
import { FLARE_S0, HW, MILESTONES, RAIL_INSET, STRATA, deckY, hwAt, sContest } from './profile.ts';
import type { Stratum } from './profile.ts';
import { RAIL_VIS_T, faceFoot, outline, outlineS, railSides } from './shape.ts';
import type { OutlinePoint } from './shape.ts';

type P3 = [number, number, number];

// Display shades of the Codeforces rank colours: the same hues, lifted a little so they read on a
// face that the sun reaches only at a grazing angle.
export const RANK_SHADE: Record<string, string> = {
  Newbie: '#a2a4ac',
  Pupil: '#2f9a45',
  Specialist: '#12ad9f',
  Expert: '#3157e0',
  'Candidate Master': '#a33fb0',
};
export const shadeFor = (rank: string, fallback: string) => RANK_SHADE[rank] ?? fallback;

const PAINT_LIFT = 0.012;

class Soup {
  pos: number[] = [];
  col: number[] = [];
  tri(a: P3, b: P3, c: P3, color: Color) {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }
  quad(a: P3, b: P3, c: P3, d: P3, color: Color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }
  poly(p: P3[], color: Color) {
    for (let i = 1; i < p.length - 1; i++) this.tri(p[0], p[i], p[i + 1], color);
  }
  // shade: optional brightness factor from a triangle's normal, baked into its colour
  build(shade?: (nx: number, ny: number, nz: number) => number): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals(); // non-indexed, so every triangle gets its own flat normal
    if (shade) {
      const n = g.attributes.normal.array;
      for (let i = 0; i < this.col.length; i++) this.col[i] *= shade(n[i - (i % 3)], n[i - (i % 3) + 1], n[i - (i % 3) + 2]);
    }
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const lerpAtY = (a: P3, b: P3, y: number): P3 => {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t];
};

// Sutherland-Hodgman clip of a convex polygon to the slab y0 <= y <= y1.
function clipY(poly: P3[], y0: number, y1: number): P3[] {
  const pass = (pts: P3[], inside: (p: P3) => boolean, y: number) => {
    const out: P3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const ia = inside(a);
      const ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(lerpAtY(a, b, y));
    }
    return out;
  };
  const lower = pass(poly, (p) => p[1] >= y0, y0);
  return lower.length < 3 ? [] : pass(lower, (p) => p[1] <= y1, y1);
}

const stratumColor = (st: Stratum) => {
  const c = new Color(shadeFor(st.band, st.color));
  return st.band === 'Newbie' && st.odd ? c.multiplyScalar(0.8) : c;
};

// Far side: grass low down, bare rock towards the top.
const BACK_STRATA = [
  { y0: -1, y1: 6.5, color: new Color('#6f9a5a') },
  { y0: 6.5, y1: 99, color: new Color('#8c8fa3') },
];

const top = (p: OutlinePoint): P3 => [p.x, p.y, p.z];
const foot = (p: OutlinePoint): P3 => {
  const f = faceFoot(p);
  return [f.x, f.y, f.z];
};

function addFaces(soup: Soup) {
  const pts = outline(0.5);
  const front = STRATA.map((st) => ({ y0: st.y0, y1: st.y1, color: stratumColor(st) }));
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const quad: P3[] = [top(a), top(b), foot(b), foot(a)];
    const facing = a.n.z + b.n.z;
    for (const st of facing < -0.6 ? BACK_STRATA : front) {
      const clipped = clipY(quad, st.y0, st.y1);
      if (clipped.length >= 3) soup.poly(clipped, st.color);
    }
  }
}

function addDeck(soup: Soup) {
  const road = new Color(COLORS.road);
  const plaza = new Color('#9a968c');
  const ss = outlineS(0.5);
  for (let k = 0; k < ss.length - 1; k++) {
    const s0 = ss[k];
    const s1 = ss[k + 1];
    const y0 = deckY(s0);
    const y1 = deckY(s1);
    const w0 = hwAt(s0);
    const w1 = hwAt(s1);
    const c = (s0 + s1) / 2 > FLARE_S0 + 2.5 ? plaza : road;
    soup.quad([-s0, y0, w0], [-s0, y0, -w0], [-s1, y1, -w1], [-s1, y1, w1], c);
  }
}

// A painted strip along z = zOf(s) for s in [s0, s1], `w` wide.
function paintAlong(soup: Soup, s0: number, s1: number, zOf: (s: number) => number, w: number, color: Color, step = 0.5) {
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i < n; i++) {
    const a = s0 + ((s1 - s0) * i) / n;
    const b = s0 + ((s1 - s0) * (i + 1)) / n;
    const ya = deckY(a) + PAINT_LIFT;
    const yb = deckY(b) + PAINT_LIFT;
    const za = zOf(a);
    const zb = zOf(b);
    soup.quad([-a, ya, za + w / 2], [-a, ya, za - w / 2], [-b, yb, zb - w / 2], [-b, yb, zb + w / 2], color);
  }
}

function addPaint(soup: Soup) {
  const white = new Color(COLORS.roadLine);
  const end = FLARE_S0 + 1;
  // Dashed centre line and solid edge lines.
  for (let s = 1.5; s < end - 1; s += 3) paintAlong(soup, s, Math.min(s + 1.4, end), () => 0, 0.16, white);
  for (const side of [1, -1]) paintAlong(soup, 0.8, end, (s) => side * (hwAt(s) - RAIL_INSET - 0.55), 0.13, white);
  // A chequered line across the road at each rank milestone, in the rank's colour and white.
  const cells = 12;
  const half = HW - RAIL_INSET - 0.2;
  const cell = (2 * half) / cells;
  for (const m of MILESTONES) {
    const s = sContest(m.index);
    const c = new Color(shadeFor(m.name, m.color));
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < cells; i++) {
        const z = -half + cell * (i + 0.5);
        paintAlong(soup, s - cell + row * cell, s + row * cell, () => z, cell, (i + row) % 2 ? white : c, cell);
      }
  }
}

// Box-section beam along a rail line, `y0`..`y1` above the deck.
function addBeam(soup: Soup, line: OutlinePoint[], y0: number, y1: number, w: number, color: Color) {
  const ring = (p: OutlinePoint): P3[] => {
    const ox = p.n.x * (w / 2);
    const oz = p.n.z * (w / 2);
    return [
      [p.x + ox, p.y + y1, p.z + oz],
      [p.x - ox, p.y + y1, p.z - oz],
      [p.x - ox, p.y + y0, p.z - oz],
      [p.x + ox, p.y + y0, p.z + oz],
    ];
  };
  for (let i = 0; i < line.length - 1; i++) {
    const a = ring(line[i]);
    const b = ring(line[i + 1]);
    // the four sides of each segment (outer, top, inner, bottom), wound to face outwards
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 3) % 4;
      soup.quad(a[k1], a[k], b[k], b[k1], color);
    }
  }
  const first = ring(line[0]);
  const last = ring(line[line.length - 1]);
  soup.quad(first[3], first[2], first[1], first[0], color);
  soup.quad(last[0], last[1], last[2], last[3], color);
}

export const BEAM = { y0: 0.6, y1: 0.8, w: 0.2 };

// The cliff faces (self-lit, see materials.ts) and everything on top: deck, paint and rail beams.
export function buildRidgeGeometry(): { faces: BufferGeometry; top: BufferGeometry } {
  const faces = new Soup();
  addFaces(faces);
  const deck = new Soup();
  addDeck(deck);
  addPaint(deck);
  const beam = new Color(COLORS.paper);
  const { front, back } = railSides(0.5);
  addBeam(deck, front, BEAM.y0, BEAM.y1, BEAM.w, beam);
  addBeam(deck, back, BEAM.y0, BEAM.y1, BEAM.w, beam);
  // The sun comes from screen-left and above: folds turned that way read a little brighter.
  return { faces: faces.build((nx, ny) => 1 - 0.3 * nx + 0.12 * ny), top: deck.build() };
}

// Box with its eight corners cut off, centred on the origin (toy-block look, 44 triangles).
export function cornerCutBox(w: number, h: number, d: number, c: number): BufferGeometry {
  const pts: Vector3[] = [];
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        pts.push(new Vector3(sx * (hx - c), sy * hy, sz * hz));
        pts.push(new Vector3(sx * hx, sy * (hy - c), sz * hz));
        pts.push(new Vector3(sx * hx, sy * hy, sz * (hz - c)));
      }
  return new ConvexGeometry(pts);
}

export const RAIL_POST = { w: RAIL_VIS_T, h: 0.98 };
