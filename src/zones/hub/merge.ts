import { Color, Float32BufferAttribute } from 'three';
import type { BufferGeometry, Matrix4 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Bakes several static parts into one geometry (one draw call). Optional per-part colour goes into a
// 'color' attribute for a vertexColors material.
export function mergeParts(parts: { geometry: BufferGeometry; matrix?: Matrix4; color?: string }[]): BufferGeometry {
  const withColor = parts.some((p) => p.color);
  const prepared = parts.map(({ geometry, matrix, color }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    if (matrix) g.applyMatrix4(matrix);
    if (withColor) {
      const c = new Color(color ?? '#ffffff');
      const n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new Float32BufferAttribute(arr, 3));
    }
    return g;
  });
  const merged = mergeGeometries(prepared, false)!;
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}
