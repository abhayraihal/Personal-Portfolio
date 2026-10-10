// Code-built toy race car, nose towards +Z, wheels on the ground at y = 0. One merged geometry.
import type { BufferGeometry } from 'three';
import { box, cyl, paint, shade } from './kit/paint.ts';
import type { Part } from './kit/paint.ts';

export const RACER = { length: 1.9, width: 1.08, height: 0.95 };

export function racerGeometry(color: string): BufferGeometry {
  const dark = shade(color, -0.45);
  const tyre = '#22252c';
  const parts: Part[] = [
    { geo: box(1.0, 0.36, 1.86, 0.14), color, at: [0, 0.42, 0] },
    { geo: box(0.84, 0.18, 0.5, 0.08), color, at: [0, 0.34, 1.02] },
    { geo: box(0.6, 0.34, 0.72, 0.14), color: '#2a3142', at: [0, 0.74, -0.12] },
    { geo: box(0.22, 0.03, 1.4, 0.01), color: '#ffffff', at: [0, 0.615, 0.12] },
    // Rear wing on two struts.
    { geo: box(1.12, 0.08, 0.32, 0.03), color: dark, at: [0, 0.9, -0.82] },
    { geo: box(0.08, 0.3, 0.12), color: dark, at: [-0.3, 0.72, -0.8] },
    { geo: box(0.08, 0.3, 0.12), color: dark, at: [0.3, 0.72, -0.8] },
  ];
  for (const [x, z] of [[-0.56, 0.6], [0.56, 0.6], [-0.56, -0.58], [0.56, -0.58]]) {
    parts.push({ geo: cyl(0.25, 0.25, 0.24, 16), color: tyre, at: [x, 0.25, z], rot: [0, 0, Math.PI / 2] });
    parts.push({ geo: cyl(0.12, 0.12, 0.25, 10), color: '#c9ced8', at: [x, 0.25, z], rot: [0, 0, Math.PI / 2] });
  }
  return paint(parts);
}
