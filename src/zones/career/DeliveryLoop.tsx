import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Path, Shape, ShapeGeometry } from 'three';
import type { Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { kitMaterial, modelScale, modelUrl } from '../../components/Model.tsx';
import { COLORS } from '../../config/palette.ts';
import { car } from '../../state/car.ts';
import { playSound } from '../../state/events.ts';
import { PHYSICS_DT } from '../../vehicle/tuning.ts';
import { carLocal, localToWorldInto, yawQuat } from './kit/frame.ts';
import type { V3 } from './kit/frame.ts';
import { DynamicInstances } from './kit/instances.tsx';
import type { Placement } from './kit/instances.tsx';
import { box, paint, paintMaterial } from './kit/paint.ts';
import { Sign } from './kit/sign.tsx';
import { ZONE, p } from './plan.ts';

// A delivery van that loops on a side lane next to the LimeRoad gantry and stops for the player,
// a stack of parcels to knock over, and the Blue Dart board.

const LOOP = { u: 11.5, v: 74.6, half: 6, r: 2.45, lane: 2.8 };
const [CX, , CZ] = p(LOOP.u, LOOP.v);
const L = LOOP.half;
const R = LOOP.r;
const PERIM = 4 * L + 2 * Math.PI * R;
const CRUISE = 3.6;
const WHEEL_R = 0.45;

type Pose = { x: number; z: number; yaw: number };

// Clockwise on screen: up the left straight (-z), over the top, down the right straight.
function poseAt(s: number, out: Pose): Pose {
  s = ((s % PERIM) + PERIM) % PERIM;
  if (s < 2 * L) {
    out.x = CX - R;
    out.z = CZ + L - s;
    out.yaw = Math.PI;
  } else if (s < 2 * L + Math.PI * R) {
    const a = (s - 2 * L) / R;
    out.x = CX - R * Math.cos(a);
    out.z = CZ - L - R * Math.sin(a);
    out.yaw = Math.atan2(Math.sin(a), -Math.cos(a));
  } else if (s < 4 * L + Math.PI * R) {
    out.x = CX + R;
    out.z = CZ - L + (s - 2 * L - Math.PI * R);
    out.yaw = 0;
  } else {
    const a = (s - 4 * L - Math.PI * R) / R;
    out.x = CX + R * Math.cos(a);
    out.z = CZ + L + R * Math.sin(a);
    out.yaw = Math.atan2(-Math.sin(a), Math.cos(a));
  }
  return out;
}

function stadium(path: Path | Shape, r: number, hole: boolean) {
  // Shape space is (x, -z): the geometry is laid flat with a -90 degree turn about X.
  const top = -(CZ - L);
  const bottom = -(CZ + L);
  if (!hole) {
    path.moveTo(CX - r, bottom);
    path.lineTo(CX - r, top);
    path.absarc(CX, top, r, Math.PI, 0, true);
    path.lineTo(CX + r, bottom);
    path.absarc(CX, bottom, r, 0, Math.PI, true);
  } else {
    path.moveTo(CX - r, bottom);
    path.absarc(CX, bottom, r, Math.PI, 0, false);
    path.lineTo(CX + r, top);
    path.absarc(CX, top, r, 0, Math.PI, false);
    path.lineTo(CX - r, bottom);
  }
}

function laneGeometry() {
  const outer = new Shape();
  stadium(outer, R + LOOP.lane / 2, false);
  const inner = new Path();
  stadium(inner, R - LOOP.lane / 2, true);
  outer.holes.push(inner);
  return new ShapeGeometry(outer, 24);
}

// Cardboard parcel, 0.8 m, sitting on y = 0.
function parcelGeometry(size: number) {
  const h = size / 2;
  const tape = '#a8763b';
  return paint([
    { geo: box(size, size, size, 0.035), color: '#cf9e60', at: [0, h, 0] },
    { geo: box(size * 0.22, 0.014, size + 0.02, 0), color: tape, at: [0, size + 0.004, 0] },
    { geo: box(size * 0.22, size * 0.36, 0.014, 0), color: tape, at: [0, size * 0.82, h + 0.004] },
    { geo: box(size * 0.22, size * 0.36, 0.014, 0), color: tape, at: [0, size * 0.82, -h - 0.004] },
    { geo: box(size * 0.36, size * 0.24, 0.014, 0.004), color: '#f6f3ea', at: [size * 0.2, size * 0.4, h + 0.004] },
    { geo: box(size * 0.24, size * 0.04, 0.016, 0), color: '#3a3f4b', at: [size * 0.2, size * 0.44, h + 0.008] },
    { geo: box(size * 0.24, size * 0.04, 0.016, 0), color: '#3a3f4b', at: [size * 0.2, size * 0.36, h + 0.008] },
  ]);
}

const PARCEL = 0.8;
const gap = PARCEL + 0.04;
const stack: Placement[] = [
  { position: p(6.5, 62.6, 0.005) },
  { position: p(6.5 + gap, 62.6, 0.005) },
  { position: p(6.5 + gap * 2, 62.6, 0.005) },
  { position: p(6.5 + gap / 2, 62.6, PARCEL + 0.02) },
  { position: p(6.5 + gap * 1.5, 62.6, PARCEL + 0.02) },
  { position: p(6.5 + gap, 62.6, PARCEL * 2 + 0.04) },
  { position: p(9.1, 63.4, 0.005), rotationY: 0.5 },
];

function Van() {
  const gltf = useGLTF(modelUrl('vehicle-alt-pickup-truck'), false);
  const meshes = gltf.meshes as Record<string, Mesh>;
  const material = useMemo(() => {
    const src = meshes.body.material as MeshStandardMaterial;
    return kitMaterial('car-kit', (src.map as Texture | null) ?? null);
  }, [meshes]);
  const load = useMemo(() => parcelGeometry(0.62), []);
  const body = useRef<RapierRigidBody>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const start = useMemo(() => poseAt(0, { x: 0, z: 0, yaw: 0 }), []);
  const sim = useRef({ s: 0, vel: 0, waiting: false, honkAt: -10, time: 0, spin: 0 });
  const pose = useRef<Pose>({ x: 0, z: 0, yaw: 0 });
  const tmp = useRef({ x: 0, z: 0 });
  const world = useRef({ x: 0, y: 0, z: 0 });
  const quat = useRef({ x: 0, y: 0, z: 0, w: 1 });

  useBeforePhysicsStep(() => {
    const b = body.current;
    if (!b) return;
    const st = sim.current;
    const dt = PHYSICS_DT;
    st.time += dt;
    const ps = poseAt(st.s, pose.current);
    // Wait while the player's car is in the way: ahead within 7 m, or right next to the van.
    let blocked = false;
    if (car.ready) {
      const c = carLocal(ZONE, tmp.current);
      const dx = c.x - ps.x;
      const dz = c.z - ps.z;
      const fx = Math.sin(ps.yaw);
      const fz = Math.cos(ps.yaw);
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      blocked = (ahead > 0 && ahead < 7.5 && side < 2.9) || Math.hypot(dx, dz) < 3.3;
    }
    const target = blocked ? 0 : CRUISE;
    const rate = blocked ? 9 : 2.5;
    st.vel += Math.max(-rate * dt, Math.min(rate * dt, target - st.vel));
    if (blocked && !st.waiting && st.time - st.honkAt > 5) {
      st.honkAt = st.time;
      playSound('horn', 0.35);
    }
    st.waiting = blocked;
    st.s += st.vel * dt;
    st.spin += (st.vel * dt) / WHEEL_R;
    poseAt(st.s, ps);
    localToWorldInto(ZONE, ps.x, ps.z, world.current);
    b.setNextKinematicTranslation(world.current);
    b.setNextKinematicRotation(yawQuat(ps.yaw, quat.current));
  });

  useFrame(() => {
    const spin = sim.current.spin;
    for (const w of wheels.current) if (w) w.rotation.x = spin;
  });

  const s = modelScale('vehicle-alt-pickup-truck');
  const wheelNames = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right'];
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[start.x, 0, start.z]} rotation={[0, start.yaw, 0]}>
      <CuboidCollider args={[1.1, 0.78, 2.2]} position={[0, 0.98, 0]} />
      <group scale={s}>
        <mesh geometry={meshes.body.geometry} material={material} position={meshes.body.position} castShadow receiveShadow />
        {wheelNames.map((n, i) => (
          <group key={n} position={meshes[n].position} ref={(g) => { wheels.current[i] = g; }}>
            <mesh geometry={meshes[n].geometry} material={material} castShadow />
          </group>
        ))}
      </group>
      {/* Two parcels riding in the bed. */}
      <mesh geometry={load} material={paintMaterial} position={[0.2, 0.86, -1.25]} rotation={[0, 0.25, 0]} castShadow />
      <mesh geometry={load} material={paintMaterial} position={[-0.32, 0.86, -0.55]} rotation={[0, -0.15, 0]} castShadow />
    </RigidBody>
  );
}

export function DeliveryLoop() {
  const lane = useMemo(laneGeometry, []);
  const parcel = useMemo(() => parcelGeometry(PARCEL), []);
  const collider = useMemo(() => <CuboidCollider args={[PARCEL / 2, PARCEL / 2, PARCEL / 2]} position={[0, PARCEL / 2, 0]} mass={3} friction={0.7} />, []);
  const boardPos: V3 = p(11.2, 86.5);
  return (
    <group>
      <mesh geometry={lane} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <meshStandardMaterial color="#858a98" roughness={1} />
      </mesh>
      <Van />
      <DynamicInstances geometry={parcel} material={paintMaterial} items={stack} collider={collider} impact="soft" linearDamping={0.3} angularDamping={0.4} />
      <Sign title="Blue Dart" lines={['Status updates by push and pull']} width={7.2} titleSize={0.62} lineSize={0.4}
        accent={COLORS.limeroad} position={boardPos} lift={1.0} />
    </group>
  );
}

useGLTF.preload(modelUrl('vehicle-alt-pickup-truck'), false);
