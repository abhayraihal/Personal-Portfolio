// Instanced Kenney models (one draw call per model), fixed collider sets, and instanced dynamic
// props that go home once the car has left them alone.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { InstancedRigidBodyProps, RapierRigidBody, RigidBodyProps } from '@react-three/rapier';
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, InstancedMesh, Material } from 'three';
import { modelScale, useMerged } from '../../../components/Model.tsx';
import type { ModelName } from '../../../config/models.ts';
import { car } from '../../../state/car.ts';
import type { V3 } from './frame.ts';
import { impactReporter } from './impact.ts';

export type Placement = { position: V3; rotationY?: number; scale?: number };

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);

// Static instances of one geometry. `scale` multiplies baseScale.
export function Instances({ geometry, material, items, baseScale = 1, shadows = true }: {
  geometry: BufferGeometry; material: Material; items: Placement[]; baseScale?: number; shadows?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      _q.setFromAxisAngle(UP, it.rotationY ?? 0);
      _s.setScalar(baseScale * (it.scale ?? 1));
      mesh.setMatrixAt(i, _m.compose(_p.set(...it.position), _q, _s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, baseScale]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow={shadows} />;
}

// Static instances of a Kenney model at its world scale.
export function InstancedModel({ name, items, shadows = true }: { name: ModelName; items: Placement[]; shadows?: boolean }) {
  const { geometry, material } = useMerged(name);
  return <Instances geometry={geometry} material={material} items={items} baseScale={modelScale(name)} shadows={shadows} />;
}

export type BoxCollider = { position: V3; half: V3; rotationY?: number };

// One fixed body holding many box colliders.
export function FixedBoxes({ boxes, friction = 0.7 }: { boxes: BoxCollider[]; friction?: number }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      {boxes.map((b, i) => (
        <CuboidCollider key={i} args={b.half} position={b.position} rotation={[0, b.rotationY ?? 0, 0]} friction={friction} />
      ))}
    </RigidBody>
  );
}

// A Kenney model's merged geometry with its world scale baked in, for physics instances (the
// collider args must not be scaled by the instance transform).
export function useScaledMerged(name: ModelName, scale = 1) {
  const { geometry, material } = useMerged(name);
  const scaled = useMemo(() => {
    const s = modelScale(name) * scale;
    const g = geometry.clone();
    g.scale(s, s, s);
    g.computeBoundingSphere();
    return g;
  }, [geometry, name, scale]);
  useEffect(() => () => scaled.dispose(), [scaled]);
  return { geometry: scaled, material };
}

type Home = { t: { x: number; y: number; z: number }; r: { x: number; y: number; z: number; w: number } };

type DynamicProps = Omit<RigidBodyProps, 'children' | 'position' | 'rotation' | 'ref'> & {
  geometry: BufferGeometry;
  material: Material;
  items: Placement[];
  collider: ReactNode; // collider node for one instance, in the instance's frame
  impact?: Parameters<typeof impactReporter>[0]; // report collisions on the events bus as this material
  idleSeconds?: number; // displaced, still and left alone this long: go home
  carDistance?: number; // "left alone" = the car is at least this far away (m)
  shadows?: boolean;
};

// Dynamic instances (cones, parcels). Bodies sleep when still; each one snaps home after the car
// has left it alone for a while, like <Resettable>.
export function DynamicInstances({ geometry, material, items, collider, impact, idleSeconds = 12, carDistance = 16, shadows = true, ...body }: DynamicProps) {
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const homes = useRef<(Home | null)[]>([]);
  const idle = useRef<number[]>(items.map(() => 0));
  const check = useRef(0);
  const onCollisionEnter = useMemo(() => (impact ? impactReporter(impact) : undefined), [impact]);
  const instances = useMemo<InstancedRigidBodyProps[]>(
    () => items.map((it, i) => ({ key: i, position: it.position, rotation: [0, it.rotationY ?? 0, 0] })),
    [items],
  );

  useEffect(() => {
    // Record homes once the bodies exist, after parent transforms are applied.
    const id = requestAnimationFrame(() => {
      homes.current = bodies.current.map((b) => (b ? { t: { ...b.translation() }, r: { ...b.rotation() } } : null));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useFrame((_, delta) => {
    check.current += delta;
    if (check.current < 0.5) return;
    const dt = check.current;
    check.current = 0;
    const list = bodies.current;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const h = homes.current[i];
      if (!b || !h) continue;
      if (b.isSleeping() && idle.current[i] === 0) {
        // Asleep where it was put down: only care if it is away from home.
        const t = b.translation();
        if (Math.abs(t.x - h.t.x) + Math.abs(t.z - h.t.z) < 0.3 && Math.abs(t.y - h.t.y) < 0.3) continue;
      }
      const t = b.translation();
      const r = b.rotation();
      const moved = Math.hypot(t.x - h.t.x, t.y - h.t.y, t.z - h.t.z) > 0.3 || Math.abs(r.x * h.r.x + r.y * h.r.y + r.z * h.r.z + r.w * h.r.w) < 0.985;
      const far = Math.hypot(car.x - h.t.x, car.z - h.t.z) > carDistance;
      const v = b.linvel();
      const still = Math.hypot(v.x, v.y, v.z) < 0.3;
      if (moved && far && still) idle.current[i] += dt;
      else idle.current[i] = 0;
      if (idle.current[i] > idleSeconds || t.y < -10) {
        idle.current[i] = 0;
        b.setTranslation(h.t, false);
        b.setRotation(h.r, false);
        b.setLinvel({ x: 0, y: 0, z: 0 }, false);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  });

  return (
    <InstancedRigidBodies ref={bodies} instances={instances} colliders={false} colliderNodes={[collider]} onCollisionEnter={onCollisionEnter} {...body}>
      <instancedMesh args={[geometry, material, items.length]} castShadow={shadows} receiveShadow={shadows} frustumCulled={false} />
    </InstancedRigidBodies>
  );
}
