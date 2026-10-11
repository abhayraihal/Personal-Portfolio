// Flat ground pieces (paths, discs, rings, rectangles) as painted parts, plus the stadium-shaped
// loop shared by the running track and its lap gates. Zone frame, y up.
import { BufferAttribute, BufferGeometry, CircleGeometry, PlaneGeometry, RingGeometry } from 'three';
import type { Part } from '../career/kit/paint.ts';

export type P2 = [number, number];

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export function disc(x: number, z: number, r: number, y: number, color: string, segments = 40): Part {
  return { geo: new CircleGeometry(r, segments), color, at: [x, y, z], rot: FLAT };
}

export function ring(x: number, z: number, r0: number, r1: number, y: number, color: string, segments = 48): Part {
  return { geo: new RingGeometry(r0, r1, segments, 1), color, at: [x, y, z], rot: FLAT };
}

export function rect(x: number, z: number, w: number, d: number, y: number, color: string, rotY = 0): Part {
  return { geo: new PlaneGeometry(w, d), color, at: [x, y, z], rot: [-Math.PI / 2, 0, rotY] };
}

// Flat triangles from a list of (x, z) points, one y, normal up.
export function flatGeometry(tris: number[], y: number): BufferGeometry {
  const n = tris.length / 2;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = tris[i * 2];
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = tris[i * 2 + 1];
    nor[i * 3 + 1] = 1;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  return g;
}

// A path along a polyline: one quad per segment and a disc at every point, so joins and ends are
// round. Wound so the faces point up.
export function ribbon(points: P2[], width: number, y: number, color: string): Part[] {
  const h = width / 2;
  const tris: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / l;
    const nz = (bx - ax) / l;
    const a0: P2 = [ax + nx * h, az + nz * h];
    const a1: P2 = [ax - nx * h, az - nz * h];
    const b0: P2 = [bx + nx * h, bz + nz * h];
    const b1: P2 = [bx - nx * h, bz - nz * h];
    tris.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
  }
  fixWinding(tris);
  const parts: Part[] = [{ geo: flatGeometry(tris, y), color }];
  for (const [x, z] of points) parts.push(disc(x, z, h, y, color, 24));
  return parts;
}

// Make every triangle face +y (counter-clockwise seen from above, i.e. from +y looking down).
export function fixWinding(tris: number[]) {
  for (let t = 0; t < tris.length; t += 6) {
    const [ax, az, bx, bz, cx, cz] = tris.slice(t, t + 6);
    // Normal y = (b - a) x (c - a), y component = dz1 * dx2 - dx1 * dz2.
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny < 0) {
      tris[t + 2] = cx;
      tris[t + 3] = cz;
      tris[t + 4] = bx;
      tris[t + 5] = bz;
    }
  }
}

// ---------------------------------------------------------------- stadium loop

export type Loop = { x: number; z: number; straight: number };

// Points of the loop at radius r from the bend centres, anticlockwise seen from above: along the
// near straight to the right, up the right bend, along the far straight to the left, down the left
// bend. `bend` points per half circle.
export function loopPoints(loop: Loop, r: number, bend = 40): P2[] {
  const s = loop.straight / 2;
  const out: P2[] = [];
  // The right bend from +z round to -z; the far straight is the gap to the left bend, and the
  // near straight closes the loop.
  for (let i = 0; i <= bend; i++) {
    const a = Math.PI / 2 - (i / bend) * Math.PI; // +z (pi/2) down to -z (-pi/2)
    out.push([loop.x + s + Math.cos(a) * r, loop.z + Math.sin(a) * r]);
  }
  for (let i = 0; i <= bend; i++) {
    const a = -Math.PI / 2 - (i / bend) * Math.PI; // -z round through -x to +z
    out.push([loop.x - s + Math.cos(a) * r, loop.z + Math.sin(a) * r]);
  }
  return out;
}

// Triangles of the band between radii r0 and r1 (closed loop).
export function loopBand(loop: Loop, r0: number, r1: number, bend = 40): number[] {
  const a = loopPoints(loop, r0, bend);
  const b = loopPoints(loop, r1, bend);
  const tris: number[] = [];
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    tris.push(...a[i], ...b[i], ...a[j], ...a[j], ...b[i], ...b[j]);
  }
  fixWinding(tris);
  return tris;
}

// Signed radial distance from the loop's spine (the segment between the bend centres) and the
// angle around the stadium centre; cheap enough to run every frame.
export function loopRadius(loop: Loop, x: number, z: number): number {
  const s = loop.straight / 2;
  const cx = Math.max(loop.x - s, Math.min(loop.x + s, x));
  return Math.hypot(x - cx, z - loop.z);
}
