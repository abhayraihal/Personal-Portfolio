import { useEffect, useMemo } from 'react';
import { BoxGeometry } from 'three';
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

// mergeBoxes for a component. Pass a module constant or a memoised array.
export function useBoxes(specs: readonly BoxSpec[]) {
  const geo = useMemo(() => mergeBoxes(specs), [specs]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}
