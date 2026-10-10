import { useMemo } from 'react';
import { BallCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import type { MeshStandardMaterial } from 'three';
import type { ModelName } from '../config/models.ts';
import { InstancedItems } from './Instances.tsx';
import type { Variant } from './Instances.tsx';
import { swayMaterial } from './materials.ts';
import { collidersFor } from './plan.ts';
import type { Plan } from './plan.ts';

// Trees sway a little and turn see-through when they stand between the camera and the car.
const TREE: Variant = (base) => swayMaterial(base as MeshStandardMaterial, { height: 1.9, amp: 0.16, dither: true });
const HILL_TREE: Variant = (base) => swayMaterial(base as MeshStandardMaterial, { height: 1.9, amp: 0.16 });
const GRASS: Variant = (base) => swayMaterial(base as MeshStandardMaterial, { height: 0.32, amp: 0.07 });
const FLOWER: Variant = (base) => swayMaterial(base as MeshStandardMaterial, { height: 0.46, amp: 0.05 });

const coverVariant = (name: ModelName) =>
  name.startsWith('grass') ? GRASS : name.startsWith('flowers') ? FLOWER : undefined;

export function Scatter({ plan }: { plan: Plan }) {
  return (
    <group name="valley-scatter">
      <InstancedItems items={plan.trees} variant={() => TREE} />
      <InstancedItems items={plan.hillTrees} variant={() => HILL_TREE} />
      <InstancedItems items={plan.rocks} />
      <InstancedItems items={plan.props} />
      <InstancedItems items={plan.cover} cast={false} variant={coverVariant} chunk={120} />
    </group>
  );
}

// Fixed colliders for trees, rocks, stumps and logs: one body, many shapes.
export function ScatterColliders({ plan }: { plan: Plan }) {
  const colliders = useMemo(() => collidersFor(plan), [plan]);
  return (
    <RigidBody type="fixed" colliders={false} name="valley-obstacles">
      {colliders.map((c, i) =>
        c.kind === 'cyl' ? (
          <CylinderCollider key={i} args={[c.h / 2, c.r]} position={[c.u, c.h / 2, -c.v]} friction={0.6} restitution={0.1} />
        ) : (
          <BallCollider key={i} args={[c.r]} position={[c.u, c.y, -c.v]} friction={0.7} restitution={0.05} />
        ),
      )}
    </RigidBody>
  );
}
