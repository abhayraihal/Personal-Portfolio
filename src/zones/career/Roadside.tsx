import { useMemo } from 'react';
import { ConeCollider } from '@react-three/rapier';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { useStore } from '../../state/store.ts';
import { addLamps } from '../../world/plan.ts';
import type { V3 } from './kit/frame.ts';
import { DynamicInstances, FixedBoxes, InstancedModel, useScaledMerged } from './kit/instances.tsx';
import type { BoxCollider, Placement } from './kit/instances.tsx';
import { PLAN, ROAD_HALF, p } from './plan.ts';

const LAMP_U = ROAD_HALF + 1.2;
// Tall things lean outwards on screen and cover what is behind them, so no lamp stands in front
// of a board, a pad or the race lane. side -1 = left of the road.
const LAMPS: [side: number, v: number][] = [[1, 64.2], [-1, 81.2]];
// The valley draws them with its own lamps (post, collider, and at night the bulb, halo and light
// pool), arms reaching over the road.
addLamps(LAMPS.map(([side, v]) => ({ kind: 'street', u: side * LAMP_U, v, toward: [-side, 0] })));

const benches: Placement[] = [
  { position: p(-11.6, 63.2) },
  { position: p(-10.6, 86.6) },
];

const cones: Placement[] = [
  // At the corner of the race lane, by the road.
  { position: p(5.9, 37.6) },
  { position: p(6.5, 39.0) },
  { position: p(7.3, 37.0) },
  // A checkpoint line in front of the Amazon gate.
  { position: p(-5.6, 88.6) },
  { position: p(-6.4, 88.9) },
  { position: p(5.6, 88.6) },
  { position: p(6.4, 88.9) },
];

// Low planting for colour, where the car rarely goes: at sign posts, benches, the milestone, the
// gate and inside the van loop. No colliders.
const flowers: Placement[] = [
  { position: p(-14.2, 40.4), rotationY: 0.4 },
  { position: p(-6.3, 40.7), rotationY: 2.1 },
  { position: p(-15.2, 53.5), rotationY: 1.2 },
  { position: p(-13.6, 63.4), rotationY: 0.7 },
  { position: p(-15.1, 77.4), rotationY: 2.6 },
  { position: p(-12.8, 86.9), rotationY: 1.9 },
  { position: p(-8.5, 87.1), rotationY: 0.2 },
  { position: p(6.0, 61.4), rotationY: 1.4 },
];
const leafy: Placement[] = [
  { position: p(-8.9, 60.9), rotationY: 0.3 },
  { position: p(11.5, 71.6), rotationY: 1.6 },
  { position: p(11.5, 75.2), rotationY: 0.2 },
  { position: p(11.5, 78.4), rotationY: 2.4 },
  { position: p(-14.6, 49.6), rotationY: 1.1 },
];
const poppies: Placement[] = [
  { position: p(-9.7, 91.6), rotationY: 0.5 },
  { position: p(9.7, 91.6), rotationY: 2.0 },
  { position: p(-14.4, 72.6), rotationY: 1.3 },
];

const fixed: BoxCollider[] = benches.map((b) => ({ position: [b.position[0], 0.5, b.position[2]] as V3, half: [1.15, 0.5, 0.55] as V3, rotationY: b.rotationY }));

export function Roadside() {
  const low = useStore((s) => s.quality === 'low');
  const cone = useScaledMerged('traffic-cone', 1.15);
  const coneCollider = useMemo(() => <ConeCollider args={[0.5, 0.36]} position={[0, 0.5, 0]} mass={1.6} friction={0.8} restitution={0.2} />, []);
  return (
    <>
      <InstancedModel name="bench-wood" items={benches} shadows={!low} />
      {!low && (
        <>
          <InstancedModel name="flowers-tall" items={flowers} shadows={false} />
          <InstancedModel name="plant-leafy" items={leafy} shadows={false} />
          <InstancedModel name="flowers-blue-poppy" items={poppies} shadows={false} />
        </>
      )}
      <FixedBoxes boxes={fixed} />
      <DynamicInstances geometry={cone.geometry} material={cone.material} items={cones} collider={coneCollider} impact="soft"
        linearDamping={0.4} angularDamping={0.6} shadows={!low} />
      {PLAN.years.map((y) => (
        <Label key={y.year} flat font="display" size={1.7} color={COLORS.roadLine} position={p(-2.3, y.v, 0.05)} fillOpacity={0.92}>
          {y.year}
        </Label>
      ))}
    </>
  );
}
