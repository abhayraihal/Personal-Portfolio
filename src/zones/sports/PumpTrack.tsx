import { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody, TrimeshCollider, useRapier } from '@react-three/rapier';
import type { TrimeshArgs } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import type { V3 } from '../career/kit/frame.ts';
import { paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { bicycleParts, placeParts, tube } from './bike.ts';

// Cycling: a dirt pump track the car can ride, a loop with three rollers on each straight and a
// banked berm at each end, and two bicycles in a rack beside it. The surface is a height function
// sampled on a grid; the same triangles are the drawn mesh and the trimesh collider.

export const PT = { straight: 10, r: 4.2, w: 3.4, rollers: 3, rollerH: 0.42, bankIn: 0.08, bankOut: 1.25, fallOut: 1.5, fallIn: 0.9 };
const LIFT = 0.012; // the mesh sits this far above the meadow so the two never fight

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Height of the track surface at (x, z) in the venue frame, and whether the point is on the band.
export function pumpHeight(x: number, z: number): { h: number; on: boolean } {
  const s = PT.straight / 2;
  let d: number; // signed distance from the centreline, + outwards
  let h: number; // height of the band's surface across at this point (before the fall-off)
  let edgeIn: number;
  let edgeOut: number;
  const across = (dd: number) => Math.min(1, Math.max(0, (dd + PT.w / 2) / PT.w));
  if (Math.abs(x) <= s) {
    d = Math.abs(z) - PT.r;
    const t = (x + s) / PT.straight;
    const roll = PT.rollerH * Math.sin(Math.PI * PT.rollers * t) ** 2;
    h = roll;
    edgeIn = roll;
    edgeOut = roll;
  } else {
    const cx = Math.sign(x) * s;
    d = Math.hypot(x - cx, z) - PT.r;
    // How far round the berm: 0 at the start of the bend, 1 at the apex.
    const phi = Math.atan2(Math.abs(z), Math.abs(x - cx)); // pi/2 at the straights, 0 at the apex
    const bank = smooth(0, 0.85, 1 - phi / (Math.PI / 2));
    const prof = (a: number) => PT.bankIn + (PT.bankOut - PT.bankIn) * a ** 1.5;
    h = prof(across(d)) * bank;
    edgeIn = prof(0) * bank;
    edgeOut = prof(1) * bank;
  }
  if (Math.abs(d) <= PT.w / 2) return { h, on: true };
  if (d > 0) return { h: edgeOut * (1 - smooth(0, PT.fallOut, d - PT.w / 2)), on: false };
  return { h: edgeIn * (1 - smooth(0, PT.fallIn, -d - PT.w / 2)), on: false };
}

const DIRT = new Color('#d09c64');
const DIRT_DARK = new Color('#9a6a3e');

// Centreline offset outwards by d: straights split finely so the rollers are smooth, bends in
// even steps. Same parametrisation for every d, so rings can be stitched into quads.
function ring(d: number): [number, number][] {
  const s = PT.straight / 2;
  const r = PT.r + d;
  const pts: [number, number][] = [];
  const STRAIGHT = 36;
  const BEND = 30;
  for (let i = 0; i < STRAIGHT; i++) pts.push([s - (i / STRAIGHT) * PT.straight, -r]); // far straight, right to left
  for (let i = 0; i < BEND; i++) {
    const a = -Math.PI / 2 - (i / BEND) * Math.PI;
    pts.push([-s + Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i < STRAIGHT; i++) pts.push([-s + (i / STRAIGHT) * PT.straight, r]); // near straight
  for (let i = 0; i < BEND; i++) {
    const a = Math.PI / 2 - (i / BEND) * Math.PI;
    pts.push([s + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

// Offsets across the track, inner foot to outer foot.
const OFFSETS = [-2.6, -2.25, -2.0, -1.7, -1.13, -0.57, 0, 0.57, 1.13, 1.7, 2.05, 2.45, 2.85, 3.2];

function trackSurface() {
  const rings = OFFSETS.map(ring);
  const n = rings[0].length;
  const verts: number[] = [];
  const cols: number[] = [];
  const c = new Color();
  for (let k = 0; k < rings.length; k++) {
    const foot = k === 0 || k === rings.length - 1;
    for (const [x, z] of rings[k]) {
      const { h, on } = pumpHeight(x, z);
      verts.push(x, (foot ? 0 : h) + LIFT, z);
      if (on) c.copy(DIRT).lerp(DIRT_DARK, Math.max(0, 0.3 - h) * 0.4);
      else c.copy(DIRT_DARK).lerp(DIRT, Math.min(1, h * 1.5) * 0.3);
      cols.push(c.r, c.g, c.b);
    }
  }
  const tris: number[] = [];
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const a = k * n + i;
      const b = k * n + ((i + 1) % n);
      const cc = (k + 1) * n + i;
      const d = (k + 1) * n + ((i + 1) % n);
      // The loop runs anticlockwise seen from above and k grows outwards: (a, cc, b) faces up.
      tris.push(a, cc, b, b, cc, d);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(cols), 3));
  g.setIndex(tris);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return { geometry: g, vertices: new Float32Array(verts), indices: new Uint32Array(tris) };
}

// Bike rack with two bikes, in its own frame: bikes side on to the camera, front wheels in hoops.
function rackGeometry() {
  const steel = '#8d939c';
  const parts: Part[] = [];
  for (const z of [-0.75, 0, 0.75]) {
    parts.push(tube([0.72, 0, z - 0.12], [0.72, 0.72, z - 0.12], 0.03, steel));
    parts.push(tube([0.72, 0, z + 0.12], [0.72, 0.72, z + 0.12], 0.03, steel));
    parts.push(tube([0.72, 0.72, z - 0.12], [0.72, 0.72, z + 0.12], 0.03, steel));
  }
  parts.push(tube([0.72, 0.05, -0.95], [0.72, 0.05, 0.95], 0.035, steel));
  parts.push(...placeParts(bicycleParts('#e2442f', '#23262d'), [0.15, 0, -0.38]));
  parts.push(...placeParts(bicycleParts('#2fa7a0', '#23262d'), [0.25, 0, 0.38]));
  return paint(parts);
}

export function PumpTrack({ position, rack, yaw = 0 }: { position: V3; rack: V3; yaw?: number }) {
  const { rapier } = useRapier();
  const surface = useMemo(trackSurface, []);
  const rackGeo = useMemo(rackGeometry, []);
  const args = useMemo(
    // FIX_INTERNAL_EDGES stops the chassis catching on the triangle edges between grid cells.
    () => [surface.vertices, surface.indices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES] as unknown as TrimeshArgs,
    [surface, rapier],
  );
  useEffect(() => () => surface.geometry.dispose(), [surface]);
  return (
    <group>
      <group position={position} rotation={[0, yaw, 0]}>
        <mesh geometry={surface.geometry} material={paintMaterial} castShadow receiveShadow />
        <RigidBody type="fixed" colliders={false}>
          <TrimeshCollider args={args} friction={1} />
        </RigidBody>
      </group>
      <group position={rack}>
        <mesh geometry={rackGeo} material={paintMaterial} castShadow receiveShadow />
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.85, 0.6, 1.05]} position={[0.3, 0.6, 0]} />
        </RigidBody>
      </group>
    </group>
  );
}
