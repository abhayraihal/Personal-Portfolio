import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload, CollisionExitPayload, ContactForcePayload, RapierCollider } from '@react-three/rapier';
import { car } from '../../state/car.ts';
import { events } from '../../state/events.ts';
import type { Events } from '../../state/events.ts';
import { PHYSICS_DT } from '../../vehicle/tuning.ts';
import { useHome } from './homes.ts';
import type { HomeGroup } from './homes.ts';

type ImpactMaterial = Events['impact']['material'];

export type HubBodyProps = {
  group: HomeGroup;
  half: [number, number, number]; // cuboid half extents, centred on the body origin
  mass: number; // kg
  position: [number, number, number];
  rotation?: [number, number, number];
  material?: ImpactMaterial;
  comDrop?: number; // lower the centre of mass by this share of the half height (0 = box centre)
  // Extra pop when the car hits the body, per m/s of car speed: upward velocity and a tumble
  // about the axis across the car's path. Plain contact only shoves things along the bumper.
  kick?: { up: number; spin: number };
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  children: ReactNode;
};

const MIN_IMPACT = 1.6; // m/s of velocity change before an impact is worth a sound
const KICK_SPEED_CAP = 14; // m/s; boosting into things should not launch them into orbit

// A dynamic box that belongs to a HomeGroup (it goes home with the group) and reports hard contacts
// on the events bus as 'impact', so the audio module can play them.
export function HubBody({
  group, half, mass, position, rotation, material = 'wood', comDrop = 0, kick, friction = 0.8, restitution = 0.12,
  linearDamping = 0.15, angularDamping = 0.35, children,
}: HubBodyProps) {
  const body = useHome(group, Math.hypot(half[0], half[1], half[2]));
  const collider = useRef<RapierCollider>(null);
  const last = useRef(0);
  const lastKick = useRef(0);

  // Rapier reports contact forces every step by default; only hard hits matter here.
  useEffect(() => {
    collider.current?.setContactForceEventThreshold((mass * MIN_IMPACT) / PHYSICS_DT);
  }, [mass]);

  // Box inertia about the (possibly lowered) centre of mass.
  const massProps = useMemo(() => {
    const [hx, hy, hz] = half;
    const drop = hy * comDrop;
    const box = (a: number, b: number) => (mass / 3) * (a * a + b * b);
    return {
      mass,
      centerOfMass: { x: 0, y: -drop, z: 0 },
      principalAngularInertia: { x: box(hy, hz) + mass * drop * drop, y: box(hx, hz), z: box(hx, hy) + mass * drop * drop },
      angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
    };
  }, [half, mass, comDrop]);

  const onContactForce = useCallback(
    ({ totalForceMagnitude, target }: ContactForcePayload) => {
      const now = performance.now();
      if (now - last.current < 160 || !target.rigidBody) return;
      last.current = now;
      const t = target.rigidBody.translation();
      events.emit('impact', { strength: (totalForceMagnitude * PHYSICS_DT) / mass, x: t.x, y: t.y, z: t.z, material });
    },
    [mass, material],
  );

  const up = kick?.up ?? 0;
  const spin = kick?.spin ?? 0;
  const onCollisionEnter = useCallback(
    ({ other, target }: CollisionEnterPayload) => {
      const b = target.rigidBody;
      if (!b || other.rigidBodyObject?.name !== 'car') return;
      group.touchingCar.add(b);
      const speed = Math.hypot(car.vx, car.vz);
      const now = performance.now();
      if ((!up && !spin) || speed < 3 || now - lastKick.current < 500) return;
      lastKick.current = now;
      const dx = car.vx / speed;
      const dz = car.vz / speed;
      const s = Math.min(speed, KICK_SPEED_CAP);
      const v = b.linvel();
      b.setLinvel({ x: v.x, y: v.y + up * s, z: v.z }, true);
      const w = b.angvel();
      const k = spin * s;
      // Axis up x direction: the top of the body leads, so it falls away from the car.
      b.setAngvel({ x: w.x + dz * k, y: w.y + (Math.random() - 0.5) * k * 0.4, z: w.z - dx * k }, true);
    },
    [group, up, spin],
  );
  const onCollisionExit = useCallback(
    ({ other, target }: CollisionExitPayload) => {
      if (target.rigidBody && other.rigidBodyObject?.name === 'car') group.touchingCar.delete(target.rigidBody);
    },
    [group],
  );

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={position}
      rotation={rotation}
      linearDamping={linearDamping}
      angularDamping={angularDamping}
    >
      <CuboidCollider
        ref={collider}
        args={half}
        massProperties={massProps}
        friction={friction}
        restitution={restitution}
        onContactForce={onContactForce}
        onCollisionEnter={onCollisionEnter}
        onCollisionExit={onCollisionExit}
      />
      {children}
    </RigidBody>
  );
}
