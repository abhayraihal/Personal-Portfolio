import { useEffect, useMemo } from 'react';
import { paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { disc, ribbon, ring } from './geom.ts';
import { PATHS, PATH_W, PLAZA } from './plan.ts';

// Paved paths and the entrance plaza, painted flat on the meadow in one mesh.
export const PAVING = '#e2d6bd';
export const PAVING_EDGE = '#bba98a';
export const PAVING_DARK = '#cdbb98';

function groundGeometry() {
  const parts: Part[] = [];
  for (const p of PATHS) {
    parts.push(...ribbon(p, PATH_W + 0.36, 0.012, PAVING_EDGE));
    parts.push(...ribbon(p, PATH_W, 0.016, PAVING));
  }
  const { x, z, r } = PLAZA;
  parts.push(disc(x, z, r, 0.012, PAVING_EDGE, 64));
  parts.push(disc(x, z, r - 0.3, 0.018, PAVING, 64));
  parts.push(ring(x, z, r - 2.9, r - 2.5, 0.02, PAVING_DARK, 64));
  parts.push(disc(x, z, 2.3, 0.02, PAVING_DARK, 48));
  parts.push(disc(x, z, 2.0, 0.022, '#4caf50', 48));
  parts.push(ring(x, z, 1.35, 1.55, 0.024, '#f4efe2', 48));
  return paint(parts);
}

export function Ground() {
  const geometry = useMemo(groundGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={paintMaterial} receiveShadow />;
}
