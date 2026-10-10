import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { modelScale, modelSize, useMerged } from '../../components/Model.tsx';
import type { ModelName } from '../../config/models.ts';
import { ROADS, ROUNDABOUT, ZONE_BY_ID } from '../../config/layout.ts';
import { useStore } from '../../state/store.ts';
import { hubAt, SPOT, TOUCH } from './layout.ts';

// Deodars and pines at the back corners (tall things go at the back), rocks along the edges, and
// poppies and grass tufts. One InstancedMesh per model.

type Spot = [u: number, v: number, turn: number, scale: number];

const TREES: { name: ModelName; spots: Spot[] }[] = [
  { name: 'tree-deodar-tall', spots: [[22.6, 16.2, 1.9, 0.95]] },
  { name: 'tree-deodar', spots: [[-24.6, 10.2, 1.1, 0.9]] },
];

const ROCKS: { name: ModelName; spots: Spot[] }[] = [
  { name: 'rock-grey-b', spots: [[-23.3, -2.2, 0.6, 1.2], [-10.2, -16.4, 2.1, 0.65]] },
  { name: 'rock-grey-c', spots: [[24, 0.6, 1.4, 1.1], [11.2, -16.6, 0.2, 0.6]] },
  // Behind the contact board and in the trees behind the skill wall, out of the arcs a car takes
  // leaving the spawn up-left or up-right.
  { name: 'rock-grey-a', spots: [[14.2, 14.8, 2.6, 1.3], [-20, 16.4, 0.9, 1.2]] },
];

const POPPIES: Spot[] = [
  [-14.6, -0.6, 0.4, 0.8], [-7.6, -16.3, 1.2, 0.7], [-6.9, -12.8, 2.4, 0.7], [-11, 18.6, 0.2, 0.75],
  [-16, 17.3, 1.7, 0.7], [21.9, 0.9, 0.9, 0.7], [-25, 0.6, 2.9, 0.65], [14.4, 16.4, 1.3, 0.7],
];
const TALL_FLOWERS: Spot[] = [[22.1, 7.7, 0.5, 0.9], [-13.3, 4.7, 1.9, 0.85], [-6.6, 11.5, 2.8, 0.8], [6.6, 12.4, 0.7, 0.8]];

// Grass tufts are scattered with a fixed seed and kept off roads, pads and buildings.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function segmentDistance(u: number, v: number, a: [number, number], b: [number, number]) {
  const du = b[0] - a[0];
  const dv = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[1]) * dv) / (du * du + dv * dv)));
  return Math.hypot(u - (a[0] + du * t), v - (a[1] + dv * t));
}

const KEEP_OUT: [number, number, number][] = [
  [SPOT.photo[0], SPOT.photo[1], 3], [SPOT.photoPad[0], SPOT.photoPad[1], 3], [SPOT.wallPad[0], SPOT.wallPad[1], 3.2],
  [SPOT.hut[0], SPOT.hut[1] + 1.5, 5], [SPOT.contactPad[0], SPOT.contactPad[1], 3.2], [SPOT.contactBoard[0], SPOT.contactBoard[1], 3.9],
  [SPOT.bench[0], SPOT.bench[1], 2], [SPOT.creditsPad[0], SPOT.creditsPad[1], 2.4], [SPOT.mailbox[0], SPOT.mailbox[1], 1.2],
];

function clear(u: number, v: number) {
  const hub = ZONE_BY_ID.hub.area;
  if (hub.kind !== 'circle' || Math.hypot(u - hub.u, v - hub.v) > hub.r - 1.5) return false;
  for (const r of ROADS) for (let i = 1; i < r.points.length; i++) if (segmentDistance(u, v, r.points[i - 1], r.points[i]) < r.width / 2 + 1.2) return false;
  const ring = Math.hypot(u - ROUNDABOUT.u, v - ROUNDABOUT.v);
  if (ring < ROUNDABOUT.r + ROUNDABOUT.width / 2 + 1.2) return false;
  // Name rows, painted text, keycaps and the skill wall.
  if (Math.abs(u) < 8 && v > -16 && v < 9.5) return false;
  const [wu, wv] = SPOT.keycaps; // the W key
  if (!TOUCH && u > wu - 2.4 && u < wu + 2.4 && v > wv - 2.4 && v < wv + 0.9) return false;
  if (u < -12.5 && v > 4.5 && v < 9) return false;
  for (const [ku, kv, kr] of KEEP_OUT) if (Math.hypot(u - ku, v - kv) < kr) return false;
  return true;
}

function grassSpots(count: number): Spot[] {
  const rand = seeded(7);
  const out: Spot[] = [];
  for (let tries = 0; out.length < count && tries < 4000; tries++) {
    const u = -26 + rand() * 52;
    const v = -20 + rand() * 52;
    if (clear(u, v)) out.push([u, v, rand() * Math.PI * 2, 0.5 + rand() * 0.3]);
  }
  return out;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

function Instances({ name, spots, shadows = true }: { name: ModelName; spots: Spot[]; shadows?: boolean }) {
  const { geometry, material } = useMerged(name);
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    spots.forEach(([u, v, turn, scale], i) => {
      _p.set(...hubAt(u, v));
      _q.setFromEuler(_e.set(0, turn, 0));
      _s.setScalar(modelScale(name) * scale);
      m.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [name, spots]);
  return <instancedMesh ref={mesh} args={[geometry, material, spots.length]} castShadow={shadows} receiveShadow />;
}

export function Decor() {
  const low = useStore((s) => s.quality === 'low');
  const grass = useMemo(() => grassSpots(low ? 16 : 30), [low]);
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {TREES.flatMap((t) =>
          t.spots.map(([u, v, , scale], i) => (
            <CylinderCollider key={`${t.name}${i}`} args={[2, 0.4 * scale]} position={hubAt(u, v, 2)} />
          )),
        )}
        {ROCKS.flatMap((r) =>
          r.spots.map(([u, v, turn, scale], i) => {
            const [w, h, d] = modelSize(r.name, scale);
            return (
              <CuboidCollider key={`${r.name}${i}`} args={[w * 0.4, h / 2, d * 0.4]} position={hubAt(u, v, h / 2)} rotation={[0, turn, 0]} />
            );
          }),
        )}
      </RigidBody>
      {TREES.map((t) => (
        <Instances key={t.name} name={t.name} spots={t.spots} />
      ))}
      {ROCKS.map((r) => (
        <Instances key={r.name} name={r.name} spots={r.spots} />
      ))}
      <Instances name="flowers-blue-poppy" spots={POPPIES} shadows={!low} />
      <Instances name="flowers-tall" spots={TALL_FLOWERS} shadows={!low} />
      <Instances key={grass.length} name="grass-tuft" spots={grass} shadows={false} />
    </>
  );
}
