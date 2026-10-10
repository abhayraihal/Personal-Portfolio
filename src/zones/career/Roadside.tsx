import { useMemo } from 'react';
import { ConeCollider } from '@react-three/rapier';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { useStore } from '../../state/store.ts';
import type { V3 } from './kit/frame.ts';
import { DynamicInstances, FixedBoxes, InstancedModel, useScaledMerged } from './kit/instances.tsx';
import type { BoxCollider, Placement } from './kit/instances.tsx';
import { NightGlow } from './NightGlow.tsx';
import { PLAN, ROAD_HALF, p } from './plan.ts';

const LAMP_U = ROAD_HALF + 1.2;
// Tall things lean outwards on screen and cover what is behind them, so no lamp stands in front
// of a board, a pad or the race lane. side -1 = left of the road.
const LAMPS: [side: number, v: number][] = [[1, 64.2], [-1, 81.2]];
// lamp-post-street: pole at the origin, head 1.35-1.8 m out along the model's -Z, 5.9 m up.
const HEAD_OUT = 1.58;
const HEAD_Y = 5.8;

// The arm points along the model's -Z; turn it over the road.
const lamps: Placement[] = LAMPS.map(([side, v]) => ({ position: p(side * LAMP_U, v), rotationY: side * Math.PI / 2 }));
const bulbs: V3[] = LAMPS.map(([side, v]) => p(side * (LAMP_U - HEAD_OUT), v, HEAD_Y));

const benches: Placement[] = [
  { position: p(-11.6, 63.2) },
  { position: p(-11.4, 84.8) },
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
  { position: p(-13.4, 85.0), rotationY: 1.9 },
  { position: p(-9.2, 85.4), rotationY: 0.2 },
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

const fixed: BoxCollider[] = [
  ...LAMPS.map(([side, v]) => ({ position: p(side * LAMP_U, v, 3), half: [0.16, 3, 0.16] as V3 })),
  ...benches.map((b) => ({ position: [b.position[0], 0.5, b.position[2]] as V3, half: [1.15, 0.5, 0.55] as V3, rotationY: b.rotationY })),
];

export function Roadside() {
  const low = useStore((s) => s.quality === 'low');
  const cone = useScaledMerged('traffic-cone', 1.15);
  const coneCollider = useMemo(() => <ConeCollider args={[0.5, 0.36]} position={[0, 0.5, 0]} mass={1.6} friction={0.8} restitution={0.2} />, []);
  return (
    <>
      <InstancedModel name="lamp-post-street" items={lamps} />
      <NightGlow positions={bulbs} radius={0.28} squash={0.45} />
      <InstancedModel name="bench-wood" items={benches} shadows={!low} />
      {!low && (
        <>
          <InstancedModel name="flowers-tall" items={flowers} shadows={false} />
          <InstancedModel name="plant-leafy" items={leafy} shadows={false} />
          <InstancedModel name="flowers-blue-poppy" items={poppies} shadows={false} />
        </>
      )}
      <FixedBoxes boxes={fixed} />
      <DynamicInstances geometry={cone.geometry} material={cone.material} items={cones} collider={coneCollider}
        linearDamping={0.4} angularDamping={0.6} shadows={!low} />
      {PLAN.years.map((y) => (
        <Label key={y.year} flat font="display" size={1.7} color={COLORS.roadLine} position={p(-2.3, y.v, 0.05)} fillOpacity={0.92}>
          {y.year}
        </Label>
      ))}
    </>
  );
}
