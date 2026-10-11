import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BallCollider, CuboidCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload, InstancedRigidBodyProps, RapierRigidBody } from '@react-three/rapier';
import { PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BufferGeometry, Group } from 'three';
import { car } from '../../state/car.ts';
import { events } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import type { V3 } from '../career/kit/frame.ts';
import { box, cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { tennisBallGeometry } from './balls.ts';
import { rect } from './geom.ts';
import { chainTexture, meshMaterial, netTexture } from './textures.ts';

// A hard court (a little under real size) with a net, end fences and a ball machine behind the
// left baseline that lobs balls over the net. The balls are physics bodies: they bounce, roll away,
// and the car can bat them about. The machine rests while the car is far away.

export const COURT = { length: 18, doubles: 8.3, singles: 6.2, service: 4.8, outX: 10.5, outZ: 5.75 };
const NET = { h: 0.82, half: 4.75 };
const FENCE = { x: 10.4, h: 2.2, half: 5.6, wrap: 3.4 }; // end fences turn this far along each side
const LINE = 0.07;
const SURROUND = '#5a9e6b';
const BLUE = '#3e7cc0';
const WHITE = '#f6f6f2';
const BALL_R = 0.2;
const BALLS = 8;
const MACHINE = { x: -9.6, z: 0.4 };
const MOUTH: V3 = [MACHINE.x + 0.62, 1.42, MACHINE.z];
const EVERY = 1.6; // s between balls
const FLIGHT = 1.55; // s from the mouth to the first bounce
const AWAKE_RANGE = 42; // m: the machine only runs while the car is this close

function courtGeometry(): BufferGeometry {
  const y = 0.02;
  const parts: Part[] = [rect(0, 0, COURT.outX * 2, COURT.outZ * 2, y, SURROUND), rect(0, 0, COURT.length + 1.2, COURT.doubles + 1.0, y + 0.003, BLUE)];
  const ly = y + 0.007;
  const L = COURT.length / 2;
  const line = (x: number, z: number, w: number, d: number) => parts.push(rect(x, z, w, d, ly, WHITE));
  for (const s of [-1, 1]) {
    line(s * L, 0, LINE * 1.5, COURT.doubles); // baselines
    line(0, s * (COURT.doubles / 2), COURT.length, LINE); // doubles sidelines
    line(0, s * (COURT.singles / 2), COURT.length, LINE); // singles sidelines
    line(s * COURT.service, 0, LINE, COURT.singles); // service lines
    line(s * (L - 0.15), 0, 0.3, LINE); // centre marks
  }
  line(0, 0, COURT.service * 2, LINE); // centre service line
  return paint(parts);
}

function frameGeometry(): BufferGeometry {
  const post = '#2c4a3a';
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    parts.push({ geo: cyl(0.07, 0.08, NET.h + 0.1, 10), color: post, at: [0, (NET.h + 0.1) / 2, s * NET.half] });
    // Fence posts and top rails at both ends, turning the corners.
    for (const z of [-FENCE.half, -FENCE.half / 2, 0, FENCE.half / 2, FENCE.half]) {
      parts.push({ geo: cyl(0.05, 0.06, FENCE.h, 8), color: '#3d4a44', at: [s * FENCE.x, FENCE.h / 2, z] });
    }
    parts.push({ geo: cyl(0.04, 0.04, FENCE.half * 2, 8), color: '#3d4a44', at: [s * FENCE.x, FENCE.h, 0], rot: [Math.PI / 2, 0, 0] });
    for (const sz of [-1, 1]) {
      const x = s * (FENCE.x - FENCE.wrap);
      parts.push({ geo: cyl(0.05, 0.06, FENCE.h, 8), color: '#3d4a44', at: [x, FENCE.h / 2, sz * FENCE.half] });
      parts.push({ geo: cyl(0.04, 0.04, FENCE.wrap, 8), color: '#3d4a44', at: [s * (FENCE.x - FENCE.wrap / 2), FENCE.h, sz * FENCE.half], rot: [0, 0, Math.PI / 2] });
    }
  }
  // Net cord and centre strap.
  parts.push({ geo: box(0.05, 0.07, NET.half * 2, 0.01), color: WHITE, at: [0, NET.h - 0.03, 0] });
  parts.push({ geo: box(0.03, NET.h - 0.05, 0.1, 0), color: WHITE, at: [0, (NET.h - 0.05) / 2, 0] });
  return paint(parts);
}

// Upright plane, normal along x (or z), uv repeating every `cell` metres.
function meshPlane(width: number, height: number, cell: number, at: V3, facing: 'x' | 'z' = 'x'): BufferGeometry {
  const g = new PlaneGeometry(width, height);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / cell, (uv.getY(i) * height) / cell);
  if (facing === 'x') g.rotateY(Math.PI / 2);
  g.translate(...at);
  return g;
}

function machineGeometry(): BufferGeometry {
  const body = '#2b3f6c';
  const parts: Part[] = [
    { geo: box(1.05, 0.62, 0.8, 0.08), color: body, at: [0, 0.52, 0] },
    { geo: box(1.08, 0.12, 0.82, 0.03), color: '#ff8a1c', at: [0, 0.62, 0] },
    // Hopper with a heap of balls.
    { geo: box(0.9, 0.36, 0.7, 0.05), color: '#d9dde6', at: [-0.05, 1.0, 0] },
    // Launch tube, pointing up towards +x.
    { geo: cyl(0.16, 0.18, 0.75, 14), color: '#1f2a44', at: [0.4, 1.15, 0], rot: [0, 0, -0.82] },
  ];
  for (const [x, z] of [[-0.38, -0.36], [0.38, -0.36], [-0.38, 0.36], [0.38, 0.36]]) {
    parts.push({ geo: cyl(0.14, 0.14, 0.08, 12), color: '#23262d', at: [x, 0.14, z * 1.15], rot: [Math.PI / 2, 0, 0] });
  }
  const heap = [[-0.3, -0.18], [-0.05, -0.2], [0.2, -0.16], [-0.25, 0.08], [0, 0.04], [0.25, 0.1], [-0.12, 0.22], [0.12, 0.24]];
  heap.forEach(([x, z], i) => parts.push({ geo: new SphereGeometry(BALL_R * 0.95, 10, 8), color: '#d7e64a', at: [x - 0.05, 1.2 + (i % 3) * 0.04, z] }));
  return paint(parts);
}

const _v = new Vector3();
const _w = new Vector3();

export function Tennis({ position }: { position: V3 }) {
  const root = useRef<Group>(null);
  const court = useMemo(courtGeometry, []);
  const frame = useMemo(frameGeometry, []);
  const machine = useMemo(machineGeometry, []);
  const ballGeo = useMemo(() => tennisBallGeometry(BALL_R, 2), []);
  const nets = useMemo(() => {
    const net = meshMaterial(netTexture(), '#f2f2ee');
    const fence = meshMaterial(chainTexture(), '#8f9aa0');
    const netGeo = meshPlane(NET.half * 2, NET.h - 0.06, 0.12, [0, (NET.h - 0.06) / 2 + 0.01, 0]);
    const fences = mergeGeometries([-1, 1].flatMap((s) => [
      meshPlane(FENCE.half * 2, FENCE.h, 0.3, [s * FENCE.x, FENCE.h / 2, 0]),
      ...[-1, 1].map((sz) => meshPlane(FENCE.wrap, FENCE.h, 0.3, [s * (FENCE.x - FENCE.wrap / 2), FENCE.h / 2, sz * FENCE.half], 'z')),
    ]), false);
    return { net, fence, netGeo, fences };
  }, []);
  useEffect(() => () => {
    nets.net.map?.dispose();
    nets.fence.map?.dispose();
    nets.net.dispose();
    nets.fence.dispose();
  }, [nets]);

  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const st = useRef({ t: 0, next: 0, ready: false, mouth: new Vector3(), q: new Quaternion() });
  // Balls start in a row along the right fence, as if someone gathered them up.
  const instances = useMemo<InstancedRigidBodyProps[]>(
    () => Array.from({ length: BALLS }, (_, i) => ({ key: i, position: [FENCE.x - 0.5, BALL_R + 0.01, -3.2 + i * 0.9] as V3 })),
    [],
  );
  const onHit = useMemo(() => {
    let last = 0;
    return (e: CollisionEnterPayload) => {
      const b = e.target.rigidBody;
      if (!b) return;
      const t = b.translation();
      // Only near the car: a machine across the park should not thud in your ears.
      if (Math.hypot(car.x - t.x, car.z - t.z) > 16) return;
      const v = b.linvel();
      const strength = Math.hypot(v.x, v.y, v.z) * 0.35;
      const now = performance.now();
      if (strength < 1.2 || now - last < 120) return;
      last = now;
      events.emit('impact', { strength, x: t.x, y: t.y, z: t.z, material: 'soft' });
    };
  }, []);

  useFrame((_, delta) => {
    const s = st.current;
    const g = root.current;
    if (!g) return;
    if (!s.ready) {
      g.updateWorldMatrix(true, false);
      s.mouth.set(...MOUTH);
      g.localToWorld(s.mouth);
      g.getWorldQuaternion(s.q);
      s.ready = true;
    }
    if (Math.hypot(car.x - s.mouth.x, car.z - s.mouth.z) > AWAKE_RANGE) return;
    s.t += Math.min(delta, 0.1);
    const every = useStore.getState().reducedMotion ? EVERY * 2 : EVERY;
    if (s.t < every) return;
    s.t = 0;
    const b = bodies.current[s.next];
    s.next = (s.next + 1) % BALLS;
    if (!b) return;
    // A lob to a random spot in the far half, from the mouth (local frame), then into world space.
    const tx = 2.2 + Math.random() * 6.2;
    const tz = (Math.random() * 2 - 1) * 3.2;
    const dx = tx - MOUTH[0];
    const dz = tz - MOUTH[2];
    const dy = BALL_R - MOUTH[1];
    const T = FLIGHT * (0.9 + Math.random() * 0.2);
    _v.set(dx / T, (dy + 0.5 * 9.81 * T * T) / T, dz / T).applyQuaternion(s.q);
    b.setTranslation(s.mouth, true);
    b.setLinvel(_v, true);
    b.setAngvel(_w.set(Math.random() * 6 - 3, 0, Math.random() * 6 - 3), true);
  });

  return (
    <group ref={root} position={position}>
      <mesh geometry={court} material={paintMaterial} receiveShadow />
      <mesh geometry={frame} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={nets.netGeo} material={nets.net} castShadow />
      <mesh geometry={nets.fences} material={nets.fence} />
      <mesh geometry={machine} material={paintMaterial} position={[MACHINE.x, 0, MACHINE.z]} castShadow receiveShadow />
      <InstancedRigidBodies ref={bodies} instances={instances} colliders={false} ccd linearDamping={0.12} angularDamping={0.9}
        colliderNodes={[<BallCollider key="b" args={[BALL_R]} mass={0.25} restitution={0.72} friction={0.6} />]} onCollisionEnter={onHit}>
        <instancedMesh args={[ballGeo, paintMaterial, BALLS]} castShadow frustumCulled={false} />
      </InstancedRigidBodies>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.05, NET.h / 2, NET.half]} position={[0, NET.h / 2, 0]} restitution={0.2} />
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.08, FENCE.h / 2, FENCE.half]} position={[s * FENCE.x, FENCE.h / 2, 0]} restitution={0.3} />
        ))}
        {[-1, 1].flatMap((s) => [-1, 1].map((sz) => (
          <CuboidCollider key={`${s}${sz}`} args={[FENCE.wrap / 2, FENCE.h / 2, 0.08]} position={[s * (FENCE.x - FENCE.wrap / 2), FENCE.h / 2, sz * FENCE.half]} restitution={0.3} />
        )))}
        <CuboidCollider args={[0.55, 0.62, 0.45]} position={[MACHINE.x, 0.62, MACHINE.z]} />
      </RigidBody>
    </group>
  );
}
