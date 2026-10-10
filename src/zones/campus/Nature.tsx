import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Y } from './Ground.tsx';
import { InstancedModel } from './Instanced.tsx';
import type { Placement } from './Instanced.tsx';

// Deodars behind the campus blocks and along the trail, like the forested hills in the photo.
// Nothing tall sits in the front (bottom) half, where it would hide the boards.
const TALL: Placement[] = [
  { x: -12.6, z: -25.6, ry: 0.4 }, { x: -8.6, z: -27.4, ry: 1.3, s: 1.08 }, { x: -3.6, z: -28.2, ry: 2.1 },
  { x: 2.1, z: -28.3, ry: 0.9, s: 1.1 }, { x: 6.6, z: -26.6, ry: 2.6 }, { x: -17.2, z: -23.8, ry: 1.7, s: 0.95 },
  { x: -24.6, z: -15.8, ry: 0.2, s: 1.05 }, { x: 9.8, z: -24.9, ry: 1.1 },
];
const MID: Placement[] = [
  { x: 12.9, z: -25.6, ry: 0.5 }, { x: 19.6, z: -24.4, ry: 2.4, s: 0.9 }, { x: 27.8, z: -6.6, ry: 0.7, s: 0.9 },
  { x: -28.6, z: -7.4, ry: 2.2, s: 0.9 }, { x: 6.9, z: -22.9, ry: 1.2, s: 0.85 }, { x: -28.6, z: 8.2, ry: 0.3, s: 0.9 },
  { x: -20.2, z: -21.4, ry: 0.6, s: 0.9 },
];
const SMALL: Placement[] = [
  { x: -20.3, z: 4.6, ry: 0.4, s: 0.55 }, { x: -19.4, z: 8.9, ry: 1.9, s: 0.48 },
  { x: 24.6, z: 16.9, ry: 0.9, s: 0.5 }, { x: 19.2, z: 22.6, ry: 2.3, s: 0.44 },
];
const BUSH: Placement[] = [
  { x: 9.3, z: -19.4, s: 1.2 }, { x: 19.4, z: -19.9, s: 1.1 }, { x: -9.3, z: -14.9, s: 1.2 }, { x: -6.4, z: -14.9, s: 1 },
  { x: 2.9, z: 17.4, s: 1.1 }, { x: 13.6, z: 18.6, s: 1.2 }, { x: -13.6, z: 18.2, s: 1.1 }, { x: -2.8, z: 23.6, s: 1 },
  { x: 16.6, z: 12.2, s: 1.1 }, { x: 20.8, z: 16.2, s: 1 }, { x: -18.6, z: 1.4, s: 1.1 }, { x: -16.9, z: 7.9, s: 1 }, { x: -25.4, z: 17.2, s: 1.2 },
];
const POPPIES: Placement[] = [
  { x: 10.6, z: -18.7, s: 0.62, ry: 0.4 }, { x: 18.0, z: -18.9, s: 0.55, ry: 1.4 }, { x: -5.0, z: 4.8, s: 0.5, ry: 2.2 }, { x: 0, z: 0.9, s: 0.7, ry: 0.8 },
  { x: 4.2, z: 15.8, s: 0.5, ry: 0.9 }, { x: 12.6, z: 22.6, s: 0.55, ry: 2.9 }, { x: -12.2, z: 23.2, s: 0.5, ry: 1.7 },
  { x: -3.6, z: 18.4, s: 0.5 }, { x: 18.6, z: 13.6, s: 0.5, ry: 0.7 },
];
const TALL_FLOWERS: Placement[] = [
  { x: 11.8, z: -19.1, ry: 0.3 }, { x: 16.7, z: -19.2, ry: 1.1 }, { x: 5.0, z: 4.9, ry: 2 }, { x: -1.5, z: 1.3, ry: 0.6 }, { x: 1.6, z: 0.7, ry: 1.7 },
  { x: 2.4, z: 19.9, ry: 1.6 }, { x: 14.2, z: 20.6, ry: 2.4 }, { x: -14.2, z: 20.8, ry: 0.8 }, { x: -1.6, z: 17.9, ry: 2.9 },
];
const GRASS: Placement[] = [
  { x: -16.4, z: -5.6 }, { x: -21.4, z: -6.1, s: 1.2 }, { x: -27.6, z: 0.6 }, { x: -22.6, z: 4.6, s: 1.1 },
  { x: -22.9, z: 8.1 }, { x: -26.9, z: 13.4, s: 1.2 }, { x: -18.6, z: 16.9 }, { x: -15.9, z: 11.4, s: 0.9 },
  { x: 25.6, z: -7.6 }, { x: 21.2, z: -9.1, s: 0.9 }, { x: 28.2, z: 3.6, s: 1.1 }, { x: 18.2, z: 11.6 }, { x: 27.1, z: 8.4 },
  { x: -9.6, z: -16.4 }, { x: 16.9, z: -19.4, s: 1.2 }, { x: 0.6, z: 24.6, s: 1.1 }, { x: 19.4, z: 19.4 },
];
// Benches at the front of the lawn, facing the road.
const BENCHES: Placement[] = [
  { x: -2.2, z: 4.4, y: Y.lawn },
  { x: 2.2, z: 4.4, y: Y.lawn },
];

// Boulders on the open grass and along the trail.
const ROCKS: { name: 'rock-grey-a' | 'rock-grey-b' | 'rock-grey-c'; at: Placement; r: number }[] = [
  { name: 'rock-grey-b', at: { x: 21.4, z: 14.6, ry: 0.6, s: 1.1 }, r: 1.1 },
  { name: 'rock-grey-c', at: { x: 24.8, z: 11.6, ry: 2.1 }, r: 0.9 },
  { name: 'rock-grey-a', at: { x: -28.9, z: 1.4, ry: 1.3, s: 0.9 }, r: 0.65 },
  { name: 'rock-grey-c', at: { x: -21.6, z: 17.8, ry: 0.4, s: 0.85 }, r: 0.8 },
  { name: 'rock-grey-a', at: { x: 15.6, z: 24.4, ry: 2.6 }, r: 0.8 },
  { name: 'rock-grey-b', at: { x: -17.4, z: 4.2, ry: 1.9, s: 0.8 }, r: 0.8 },
];

export function Nature() {
  return (
    <group name="campus-nature">
      <InstancedModel name="tree-deodar-tall" items={TALL} trunk={{ radius: 0.42, height: 3 }} />
      <InstancedModel name="tree-deodar" items={MID} trunk={{ radius: 0.42, height: 3 }} />
      <InstancedModel name="tree-pine-cone" items={SMALL} trunk={{ radius: 0.6, height: 3 }} />
      <InstancedModel name="plant-leafy" items={BUSH} shadows={false} />
      <InstancedModel name="flowers-blue-poppy" items={POPPIES} shadows={false} />
      <InstancedModel name="flowers-tall" items={TALL_FLOWERS} shadows={false} />
      <InstancedModel name="grass-tuft" items={GRASS} shadows={false} />
      <InstancedModel name="bench-wood" items={BENCHES} />
      {(['rock-grey-a', 'rock-grey-b', 'rock-grey-c'] as const).map((name) => (
        <InstancedModel key={name} name={name} items={ROCKS.filter((r) => r.name === name).map((r) => r.at)} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {BENCHES.map((b, i) => (
          <CuboidCollider key={i} args={[1.15, 0.5, 0.45]} position={[b.x, 0.5, b.z]} rotation={[0, b.ry ?? 0, 0]} />
        ))}
        {ROCKS.map((r, i) => (
          <CylinderCollider key={`rock${i}`} args={[0.5, r.r]} position={[r.at.x, 0.5, r.at.z]} />
        ))}
      </RigidBody>
    </group>
  );
}
