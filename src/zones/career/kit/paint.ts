// Code-built props as one merged, vertex-coloured geometry each, so a whole gantry or toy car is a
// single draw call that shares one material.
import { BoxGeometry, BufferAttribute, Color, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { V3 } from './frame.ts';

export type Part = { geo: BufferGeometry; color: string; at?: V3; rot?: V3; scale?: V3 };

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

export function paint(parts: Part[]): BufferGeometry {
  const list = parts.map((part) => {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
    part.geo.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    _e.set(...(part.rot ?? [0, 0, 0]));
    _m.compose(_p.set(...(part.at ?? [0, 0, 0])), _q.setFromEuler(_e), _s.set(...(part.scale ?? [1, 1, 1])));
    g.applyMatrix4(_m);
    _c.set(part.color);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = _c.r;
      colors[i * 3 + 1] = _c.g;
      colors[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  if (!merged) throw new Error('paint: could not merge parts');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// Matte toy paint for every painted geometry.
export const paintMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
paintMaterial.name = 'career-paint';

// Unlit paint for sign faces, so colours read exactly by day and by night (lit, a face comes out
// about a quarter darker than its colour).
export const flatMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
flatMaterial.name = 'career-flat';

// Lamp bulbs: pale by day, glowing at night (see <NightGlow>).
export const glowMaterial = new MeshStandardMaterial({ color: '#fff4d2', emissive: '#ffcf70', emissiveIntensity: 0.25, roughness: 0.4 });
glowMaterial.name = 'career-glow';
export const glowIntensity = (night: boolean) => (night ? 2.4 : 0.25);

// Rounded box (radius 0 gives a plain box). One bevel segment keeps it at 108 triangles.
export function box(w: number, h: number, d: number, radius = 0.06, segments = 1): BufferGeometry {
  return radius > 0 ? new RoundedBoxGeometry(w, h, d, segments, radius) : new BoxGeometry(w, h, d);
}

export function cyl(rTop: number, rBottom: number, h: number, segments = 16): BufferGeometry {
  return new CylinderGeometry(rTop, rBottom, h, segments);
}

// Darken (amount < 0) or lighten (amount > 0) a hex colour, for shades of the company colours.
export function shade(hex: string, amount: number): string {
  const c = new Color(hex);
  if (amount < 0) c.lerp(new Color('#101218'), -amount);
  else c.lerp(new Color('#ffffff'), amount);
  return `#${c.getHexString()}`;
}
