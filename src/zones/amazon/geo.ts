import { useEffect, useMemo } from 'react';
import { BoxGeometry, Color, Float32BufferAttribute } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// [width, height, depth, x, y, z]
export type BoxSpec = readonly [number, number, number, number, number, number];

// Several boxes baked into one geometry, so static trim (outlines, legs, page lines) is one mesh.
export function mergeBoxes(specs: readonly BoxSpec[]): BufferGeometry {
  const parts = specs.map(([w, h, d, x, y, z]) => new BoxGeometry(w, h, d).translate(x, y, z));
  const merged = mergeGeometries(parts, false) ?? parts[0];
  for (const p of parts) if (p !== merged) p.dispose();
  return merged;
}

// One vertex colour over the whole geometry, so differently coloured parts can share a material
// (vertexColors) and be merged into one mesh.
export function tinted(g: BufferGeometry, hex: string) {
  const c = new Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

// mergeBoxes for a component. Pass a module constant or a memoised array.
export function useBoxes(specs: readonly BoxSpec[]) {
  const geo = useMemo(() => mergeBoxes(specs), [specs]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}
