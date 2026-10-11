// Wooden peg figures for the park's self-playing toys: a rounded body in a team colour, a head and
// two arms that can swing. Body and head are one painted geometry; the arms are separate so they
// can turn at the shoulder.
import { SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { box, cyl, paint } from '../career/kit/paint.ts';

export const PEG = { bodyH: 1.0, bodyR: 0.3, headR: 0.25, shoulderY: 1.02, armL: 0.62 };

export const SKIN = ['#e0ac7e', '#c68a5e', '#a86b45', '#f0c49a'];

export function pegBody(shirt: string, skin: string, hair: string, cap?: string): BufferGeometry {
  const { bodyH, bodyR, headR } = PEG;
  return paint([
    { geo: cyl(bodyR * 0.82, bodyR, bodyH * 0.55, 16), color: shirt, at: [0, bodyH * 0.28, 0] },
    { geo: cyl(bodyR * 0.7, bodyR * 0.82, bodyH * 0.45, 16), color: shirt, at: [0, bodyH * 0.55 + bodyH * 0.22, 0] },
    { geo: new SphereGeometry(bodyR * 0.72, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), color: shirt, at: [0, bodyH, 0] },
    { geo: cyl(0.09, 0.1, 0.14, 10), color: skin, at: [0, bodyH + 0.12, 0] },
    { geo: new SphereGeometry(headR, 16, 12), color: skin, at: [0, bodyH + 0.36, 0] },
    { geo: new SphereGeometry(headR * 1.04, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), color: cap ?? hair, at: [0, bodyH + 0.38, 0] },
    ...(cap ? [{ geo: box(0.3, 0.03, 0.2, 0.01), color: cap, at: [0, bodyH + 0.47, headR * 0.9] as [number, number, number] }] : []),
  ]);
}

// One arm hanging from the shoulder pivot at the origin, hand at -y.
export function pegArm(skin: string, sleeve: string): BufferGeometry {
  const l = PEG.armL;
  return paint([
    { geo: cyl(0.085, 0.085, l * 0.4, 10), color: sleeve, at: [0, -l * 0.2, 0] },
    { geo: cyl(0.075, 0.07, l * 0.6, 10), color: skin, at: [0, -l * 0.7, 0] },
    { geo: new SphereGeometry(0.085, 10, 8), color: skin, at: [0, -l, 0] },
  ]);
}
