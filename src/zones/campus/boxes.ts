import { BufferAttribute, Color, CylinderGeometry, Euler, ExtrudeGeometry, Matrix4, Quaternion, Shape, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const EPS = 1e-5;

// Rounded box centred on the origin. Same construction as drei's RoundedBox, with far fewer bevel
// segments (drei's default is ~700 triangles per box; this is ~150).
export function roundedBox(w: number, h: number, d: number, r: number, bevel = 2): BufferGeometry {
  const rr = Math.max(EPS * 4, Math.min(r, w / 2 - EPS, h / 2 - EPS, d / 2 - EPS));
  const radius = rr - EPS;
  const shape = new Shape();
  shape.absarc(EPS, EPS, EPS, -Math.PI / 2, -Math.PI, true);
  shape.absarc(EPS, h - radius * 2, EPS, Math.PI, Math.PI / 2, true);
  shape.absarc(w - radius * 2, h - radius * 2, EPS, Math.PI / 2, 0, true);
  shape.absarc(w - radius * 2, EPS, EPS, 0, -Math.PI / 2, true);
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(EPS, d - rr * 2), bevelEnabled: true, bevelSegments: bevel, steps: 1,
    bevelSize: rr - EPS, bevelThickness: rr, curveSegments: 1,
  });
  g.center();
  const out = toCreasedNormals(g, 0.4);
  g.dispose();
  return out;
}

export function cylinder(rTop: number, rBottom: number, h: number, seg = 10): BufferGeometry {
  return new CylinderGeometry(rTop, rBottom, h, seg).toNonIndexed();
}

export type Part = {
  geo: BufferGeometry;
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
};

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const _c = new Color();

// Several coloured parts baked into one geometry with a per-vertex colour attribute: one draw call
// (with a vertexColors material) for a whole sign, gate or podium.
export function mergeParts(parts: Part[]): BufferGeometry {
  const geos = parts.map(({ geo, color, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()) as BufferGeometry;
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    g.applyMatrix4(_m.compose(_p.set(...position), _q.setFromEuler(_e.set(...rotation)), _s));
    _c.set(color);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  for (const p of parts) p.geo.dispose();
  merged.computeBoundingSphere();
  return merged;
}
