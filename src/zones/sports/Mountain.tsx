import { useMemo } from 'react';
import { ConvexHullCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, Color, SphereGeometry } from 'three';
import { useStore } from '../../state/store.ts';
import { InstancedModel } from '../career/kit/instances.tsx';
import type { Placement } from '../career/kit/instances.tsx';
import type { V3 } from '../career/kit/frame.ts';
import { box, cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { tube } from './bike.ts';
import { Flags } from './Flags.tsx';
import type { FlagSpec } from './Flags.tsx';
import { MOUNTAIN } from './plan.ts';

// Trekking: a little faceted mountain with a snow cap, a switchback trail up the face that looks at
// the camera, marker posts along it and a flag on the summit. A tent, a backpack and a camp at the
// foot. A prop: the car bumps into it.

const R = MOUNTAIN.r;
const H = MOUNTAIN.h;
const RINGS = 9;
const SEG = 18;

const baseR = (a: number) => R * (1 + 0.09 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a + 2.3));

// Height of the slope at (x, z) from the mountain's centre.
export function mountainHeight(x: number, z: number): number {
  const a = Math.atan2(z, x);
  const t = Math.min(1, Math.hypot(x, z) / baseR(a));
  return H * (1 - t) ** 1.25 * (1 + 0.06 * Math.sin(a * 7) * t);
}

function mountainGeometry(): { geometry: BufferGeometry; hull: Float32Array } {
  // Ring k at radius fraction (1 - k / RINGS); a summit point on top. Flat shaded (non-indexed).
  const pts: V3[][] = [];
  for (let k = 0; k < RINGS; k++) {
    const f = 1 - k / RINGS;
    const ring: V3[] = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2 + (k % 2) * (Math.PI / SEG);
      const r = baseR(a) * f * (1 + 0.05 * Math.sin(i * 2.7 + k * 1.3));
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      ring.push([x, k === 0 ? 0 : mountainHeight(x, z), z]);
    }
    pts.push(ring);
  }
  const top: V3 = [0, H, 0];
  const pos: number[] = [];
  const col: number[] = [];
  const grass = new Color('#5e8a4b');
  const rock = new Color('#8c8fa3');
  const rockDark = new Color('#6f7287');
  const snow = new Color('#f3f6f8');
  const c = new Color();
  const tri = (a: V3, b: V3, d: V3) => {
    const y = (a[1] + b[1] + d[1]) / 3;
    const f = y / H;
    if (f > 0.74) c.copy(snow);
    else if (f > 0.66) c.copy(rock).lerp(snow, 0.5);
    else if (f > 0.1) c.copy(rock).lerp(rockDark, (Math.sin(a[0] * 3.1 + a[2] * 1.7) + 1) * 0.3);
    else c.copy(grass).lerp(rockDark, (Math.sin(a[0] * 2.3 + a[2] * 3.1) + 1) * 0.12);
    for (const p of [a, b, d]) {
      pos.push(...p);
      col.push(c.r, c.g, c.b);
    }
  };
  for (let k = 0; k < RINGS; k++) {
    const r0 = pts[k];
    const r1 = k + 1 < RINGS ? pts[k + 1] : null;
    for (let i = 0; i < SEG; i++) {
      const a = r0[i];
      const b = r0[(i + 1) % SEG];
      if (!r1) {
        tri(a, top, b);
        continue;
      }
      // Odd rings are turned half a segment, so each quad's top corners are i and i + 1 shifted.
      const c0 = r1[(i + SEG - (k % 2 ? 0 : 1)) % SEG];
      const c1 = r1[(i + (k % 2 ? 1 : 0)) % SEG];
      tri(a, c1, b);
      tri(a, c0, c1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const hull = new Float32Array([...pts[0].flat(), ...pts[2].flat(), ...pts[5].flat(), ...top]);
  return { geometry: g, hull };
}

// Switchbacks up the face towards the camera (+z), from the foot to just under the summit.
const TRAIL_LIFT = 0.2; // the facets sit a little off the smooth slope; keep the trail above them
const TRAIL: [number, number][] = [[-4.9, 9.0], [2.9, 6.2], [-2.6, 4.5], [2.0, 3.0], [-1.4, 1.8], [0.5, 0.7]];

function trailGeometry(): { geometry: BufferGeometry; markers: V3[] } {
  const markers: V3[] = [];
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color('#d9c49a');
  const w = 0.32;
  const sample: V3[] = [];
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [ax, az] = TRAIL[i];
    const [bx, bz] = TRAIL[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.35);
    for (let k = 0; k < n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const z = az + ((bz - az) * k) / n;
      sample.push([x, mountainHeight(x, z) + TRAIL_LIFT, z]);
    }
    // Marker posts stand just below each bend, on the camera side of the trail.
    markers.push([bx, mountainHeight(bx, bz + 0.6) - 0.05, bz + 0.6]);
  }
  const [lx, lz] = TRAIL[TRAIL.length - 1];
  sample.push([lx, mountainHeight(lx, lz) + TRAIL_LIFT, lz]);
  for (let i = 0; i < sample.length - 1; i++) {
    const a = sample[i];
    const b = sample[i + 1];
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * w;
    const nz = (dx / l) * w;
    const quad: V3[] = [[a[0] + nx, a[1], a[2] + nz], [b[0] + nx, b[1], b[2] + nz], [a[0] - nx, a[1], a[2] - nz], [b[0] - nx, b[1], b[2] - nz]];
    // Two triangles facing up.
    for (const [p, q, r] of [[0, 2, 1], [1, 2, 3]]) {
      const A = quad[p];
      const B = quad[q];
      const C = quad[r];
      const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
      const order = ny >= 0 ? [A, B, C] : [A, C, B];
      for (const v of order) {
        pos.push(...v);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return { geometry: g, markers };
}

// Marker posts with a red band, a tent, a backpack and a ring of stones for a fire.
function campGeometry(markers: V3[]): BufferGeometry {
  const parts: Part[] = [];
  for (const [x, y, z] of markers) {
    parts.push({ geo: cyl(0.06, 0.07, 0.75, 8), color: '#f4f0e6', at: [x, y + 0.3, z] });
    parts.push({ geo: cyl(0.07, 0.07, 0.16, 8), color: '#d94141', at: [x, y + 0.52, z] });
  }
  // Tent (A-frame) at the left foot, door facing the camera.
  const tx = 8.9;
  const tz = 4.6;
  const tw = 2.2;
  const th = 1.6;
  const td = 2.4;
  const slope = Math.atan2(tw / 2, th);
  const panel = Math.hypot(tw / 2, th);
  for (const s of [-1, 1]) {
    parts.push({ geo: box(0.06, panel, td, 0.01), color: '#f28a2e', at: [tx + (s * tw) / 4, th / 2, tz], rot: [0, 0, s * slope] });
  }
  parts.push({ geo: box(tw * 0.62, 0.9, 0.04, 0.01), color: '#3b2f2a', at: [tx, 0.45, tz + td / 2 - 0.02] });
  parts.push(tube([tx, th + 0.08, tz - td / 2 - 0.1], [tx, th + 0.08, tz + td / 2 + 0.1], 0.04, '#5b616b'));
  for (const s of [-1, 1]) {
    parts.push(tube([tx, th, tz + (td / 2) * s], [tx + s * 0.2, 0, tz + (td / 2 + 0.9) * s], 0.012, '#e8e4da'));
    parts.push({ geo: box(tw + 0.1, 0.04, 0.04, 0.01), color: '#c76a1c', at: [tx, 0.02, tz + (td / 2) * s] });
  }
  // Backpack leaning on a rock by the tent.
  const bx = 6.7;
  const bz = 6.6;
  parts.push({ geo: box(0.62, 0.86, 0.42, 0.14), color: '#2f6fd6', at: [bx, 0.43, bz], rot: [-0.18, 0.4, 0] });
  parts.push({ geo: box(0.64, 0.24, 0.44, 0.1), color: '#244f9e', at: [bx, 0.86, bz - 0.05], rot: [-0.18, 0.4, 0] });
  parts.push({ geo: box(0.36, 0.3, 0.14, 0.06), color: '#f2c230', at: [bx + 0.08, 0.36, bz + 0.22], rot: [-0.18, 0.4, 0] });
  parts.push({ geo: cyl(0.12, 0.12, 0.7, 10), color: '#4caf50', at: [bx - 0.05, 1.02, bz - 0.12], rot: [0, 0.4, Math.PI / 2] });
  // Fire ring: stones round a little pile of logs.
  const fx = 5.0;
  const fz = 7.8;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    parts.push({ geo: new SphereGeometry(0.17, 6, 4), color: '#8c8fa3', at: [fx + Math.cos(a) * 0.55, 0.08, fz + Math.sin(a) * 0.55], scale: [1, 0.6, 1] });
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    parts.push(tube([fx - Math.cos(a) * 0.35, 0.1, fz - Math.sin(a) * 0.35], [fx + Math.cos(a) * 0.35, 0.12, fz + Math.sin(a) * 0.35], 0.06, '#7a5236'));
  }
  return paint(parts);
}

const TREES: Placement[] = [
  { position: [MOUNTAIN.x - 7.6, 0, MOUNTAIN.z - 4.2], scale: 0.5 },
  { position: [MOUNTAIN.x + 8.0, 0, MOUNTAIN.z - 2.8], scale: 0.58, rotationY: 1.2 },
  { position: [MOUNTAIN.x + 6.2, 0, MOUNTAIN.z - 6.6], scale: 0.46, rotationY: 2.1 },
  { position: [MOUNTAIN.x - 4.6, 0, MOUNTAIN.z - 7.2], scale: 0.44, rotationY: 0.5 },
];
const ROCKS: Placement[] = [
  { position: [MOUNTAIN.x - 7.2, 0, MOUNTAIN.z + 6.4], scale: 0.9, rotationY: 0.8 },
  { position: [MOUNTAIN.x + 5.6, 0, MOUNTAIN.z + 6.6], scale: 0.8, rotationY: 2.2 },
];

export function Mountain() {
  const low = useStore((s) => s.quality === 'low');
  const { geometry, hull } = useMemo(mountainGeometry, []);
  const trail = useMemo(trailGeometry, []);
  const camp = useMemo(() => campGeometry(trail.markers), [trail]);
  const flags = useMemo<FlagSpec[]>(() => [
    { at: [MOUNTAIN.x + 0.05, H - 0.15, MOUNTAIN.z], height: 2.0, stripes: ['#d94141', '#f4f4f0', '#2f6fd6'], width: 1.0, depth: 0.62 },
  ], []);
  return (
    <group>
      <group position={[MOUNTAIN.x, 0, MOUNTAIN.z]}>
        <mesh geometry={geometry} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={trail.geometry} material={paintMaterial} receiveShadow />
        <mesh geometry={camp} material={paintMaterial} castShadow receiveShadow />
        <RigidBody type="fixed" colliders={false}>
          <ConvexHullCollider args={[hull]} />
          <CuboidCollider args={[1.15, 0.8, 1.3]} position={[8.9, 0.8, 4.6]} />
        </RigidBody>
      </group>
      <InstancedModel name="tree-pine-snow" items={TREES} shadows={!low} />
      <InstancedModel name="rock-grey-c" items={ROCKS} shadows={!low} />
      <Flags list={flags} />
    </group>
  );
}
