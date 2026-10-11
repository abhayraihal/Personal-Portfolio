// Merge static parts into one vertex-coloured geometry so a whole prop is one draw call.
import { Color, Euler, Float32BufferAttribute, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

export type Part = {
  g: BufferGeometry;
  color: string;
  at?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
};

// Bakes the transform and a flat colour into a non-indexed copy (uv dropped so parts merge).
export function paint({ g, color, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] }: Part): BufferGeometry {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  g.applyMatrix4(_m.compose(_p.set(...at), _q, _s.set(...scale)));
  const out = g.index ? g.toNonIndexed() : g;
  _c.set(color);
  const n = out.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _c.r;
    arr[i * 3 + 1] = _c.g;
    arr[i * 3 + 2] = _c.b;
  }
  out.setAttribute('color', new Float32BufferAttribute(arr, 3));
  if (out.attributes.uv) out.deleteAttribute('uv');
  return out;
}

export function mergeParts(parts: Part[]): BufferGeometry {
  const g = mergeGeometries(parts.map(paint));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// A fixed bounding sphere (local space) for an instanced mesh whose instances move or start hidden,
// so frustum culling can skip it while it is off screen.
export function fixBounds(mesh: InstancedMesh | null, center: [number, number, number], radius: number) {
  if (mesh) mesh.boundingSphere = new Sphere(new Vector3(...center), radius);
}
