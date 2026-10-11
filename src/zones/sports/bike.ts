// A code-built bicycle as painted parts: torus wheels with spokes, a diamond frame of cylinders,
// saddle, bars and cranks. Bike frame: x forward, y up, z to the bike's left; wheels touch y = 0.
import { Euler, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { box, cyl } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import type { V3 } from '../career/kit/frame.ts';

const _a = new Vector3();
const _b = new Vector3();
const _q = new Quaternion();
const _e = new Euler();
const UP = new Vector3(0, 1, 0);

// Cylinder from a to b.
export function tube(a: V3, b: V3, r: number, color: string, segments = 8): Part {
  _a.set(...a);
  _b.set(...b);
  const len = _a.distanceTo(_b);
  _q.setFromUnitVectors(UP, _b.clone().sub(_a).normalize());
  _e.setFromQuaternion(_q);
  return { geo: cyl(r, r, len, segments), color, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [_e.x, _e.y, _e.z] };
}

export const BIKE = { wheel: 0.4, base: 0.56 };

function wheel(x: number, y: number, parts: Part[]) {
  const r = BIKE.wheel;
  parts.push({ geo: new TorusGeometry(r - 0.035, 0.04, 8, 28), color: '#26292f', at: [x, y, 0] });
  parts.push({ geo: new TorusGeometry(r - 0.08, 0.014, 6, 28), color: '#c9ced6', at: [x, y, 0] });
  parts.push({ geo: cyl(0.04, 0.04, 0.14, 10), color: '#c9ced6', at: [x, y, 0], rot: [Math.PI / 2, 0, 0] });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI;
    const dx = Math.cos(a) * (r - 0.08);
    const dy = Math.sin(a) * (r - 0.08);
    parts.push(tube([x - dx, y - dy, 0], [x + dx, y + dy, 0], 0.007, '#c9ced6', 4));
  }
}

export function bicycleParts(frame: string, accent = '#23262d'): Part[] {
  const r = BIKE.wheel;
  const rear: V3 = [-BIKE.base, r, 0];
  const front: V3 = [BIKE.base, r, 0];
  const bb: V3 = [0, r - 0.04, 0];
  const seat: V3 = [-0.13, 0.98, 0];
  const headTop: V3 = [0.42, 1.0, 0];
  const headBot: V3 = [0.46, 0.84, 0];
  const parts: Part[] = [];
  wheel(rear[0], rear[1], parts);
  wheel(front[0], front[1], parts);
  const t = 0.032;
  parts.push(tube(bb, seat, t, frame));
  parts.push(tube(seat, headTop, t, frame));
  parts.push(tube(bb, headBot, t * 1.15, frame));
  parts.push(tube(headBot, headTop, t * 1.2, frame));
  for (const z of [-0.05, 0.05]) {
    parts.push(tube([bb[0], bb[1], z], [rear[0], rear[1], z], 0.02, frame));
    parts.push(tube([seat[0], seat[1] - 0.04, z], [rear[0], rear[1], z], 0.018, frame));
    parts.push(tube([headBot[0], headBot[1], z], [front[0], front[1], z], 0.02, '#c9ced6'));
  }
  // Seat post and saddle, stem and bars with grips.
  parts.push(tube(seat, [-0.16, 1.08, 0], 0.022, '#c9ced6'));
  parts.push({ geo: box(0.26, 0.06, 0.13, 0.03), color: accent, at: [-0.15, 1.11, 0] });
  parts.push(tube(headTop, [0.39, 1.12, 0], 0.022, '#c9ced6'));
  parts.push(tube([0.39, 1.12, -0.28], [0.39, 1.12, 0.28], 0.02, '#c9ced6'));
  for (const z of [-0.28, 0.28]) parts.push({ geo: cyl(0.03, 0.03, 0.12, 8), color: accent, at: [0.39, 1.12, z * 0.92], rot: [Math.PI / 2, 0, 0] });
  // Chainring, cranks and pedals.
  parts.push({ geo: cyl(0.1, 0.1, 0.02, 16), color: '#8d939c', at: [bb[0], bb[1], 0.07], rot: [Math.PI / 2, 0, 0] });
  parts.push(tube([0.12, bb[1] + 0.12, 0.1], [-0.12, bb[1] - 0.12, -0.1], 0.018, '#5b616b'));
  parts.push({ geo: box(0.1, 0.025, 0.08, 0.01), color: accent, at: [0.12, bb[1] + 0.12, 0.14] });
  parts.push({ geo: box(0.1, 0.025, 0.08, 0.01), color: accent, at: [-0.12, bb[1] - 0.12, -0.14] });
  parts.push({ geo: new SphereGeometry(0.035, 8, 6), color: '#f2c230', at: [0.47, 0.93, 0] }); // head lamp
  return parts;
}

// Move parts into another frame: translate by `at`, turn about y by `yaw` (in place, returns parts).
export function placeParts(parts: Part[], at: V3, yaw = 0): Part[] {
  const q = new Quaternion().setFromAxisAngle(UP, yaw);
  const v = new Vector3();
  const e = new Euler();
  const pq = new Quaternion();
  for (const p of parts) {
    v.set(...(p.at ?? [0, 0, 0])).applyQuaternion(q);
    p.at = [v.x + at[0], v.y + at[1], v.z + at[2]];
    pq.setFromEuler(e.set(...(p.rot ?? [0, 0, 0]))).premultiply(q);
    e.setFromQuaternion(pq);
    p.rot = [e.x, e.y, e.z];
  }
  return parts;
}
