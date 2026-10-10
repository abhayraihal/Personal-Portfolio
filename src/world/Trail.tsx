import { useMemo } from 'react';
import { BufferAttribute, Color, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Marker } from './plan.ts';

// Wooden marker posts with an orange blaze along the bike trail (the trail itself is painted by
// the ground shader). One merged mesh.

const WOOD = new Color('#8a5a36');
const BLAZE = new Color('#ef8a2b');
const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _one = new Vector3(1, 1, 1);

function box(w: number, h: number, d: number, x: number, y: number, z: number, ry: number, color: Color, out: BufferGeometry[]) {
  const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(0.03, w / 3, h / 3, d / 3));
  g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _one));
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  out.push(g);
}

export function TrailMarkers({ markers }: { markers: Marker[] }) {
  const geometry = useMemo(() => {
    const parts: BufferGeometry[] = [];
    for (const m of markers) {
      box(0.16, 1.05, 0.16, m.u, 0.5, -m.v, m.ry, WOOD, parts);
      box(0.18, 0.2, 0.18, m.u, 0.86, -m.v, m.ry, BLAZE, parts);
    }
    if (!parts.length) return null;
    const g = mergeGeometries(parts, false);
    g.computeBoundingSphere();
    return g;
  }, [markers]);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), []);
  if (!geometry) return null;
  return <mesh name="valley-trail-markers" geometry={geometry} material={material} castShadow receiveShadow />;
}
