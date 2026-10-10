import { useMemo } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { useStore } from '../../state/store.ts';
import { ModelInstances } from './Instances.tsx';
import type { Placement } from './Instances.tsx';
import { M } from './materials.ts';
import { at } from './shared.ts';

const DEG = Math.PI / 180;
const RIM = 23.6;

// Street lights on the rim, arms reaching in over the plaza.
const LAMP_ANGLES = [248, 292, 222, 318, 187, 353, 155, 25, 113, 67];
const LAMPS: Placement[] = LAMP_ANGLES.map((deg) => {
  const a = deg * DEG;
  return { p: at(Math.cos(a) * RIM, Math.sin(a) * RIM), ry: Math.atan2(Math.cos(a), -Math.sin(a)) };
});

// Bench front is +Z: these face the camera, by the office doors, or turn towards the trophy.
const BENCHES: Placement[] = [
  { p: at(-5.3, 15.9), ry: 0 },
  { p: at(5.3, 15.9), ry: 0 },
  { p: at(-11.8, -18.6), ry: Math.atan2(11.8, -18.6) },
  { p: at(11.8, -18.6), ry: Math.atan2(-11.8, -18.6) },
];

type Planter = { u: number; v: number; w: number; d: number; tall?: boolean };
const PLANTERS: Planter[] = [
  { u: -6.6, v: -21.6, w: 2.6, d: 2.0 },
  { u: 6.6, v: -21.6, w: 2.6, d: 2.0 },
  { u: -2.5, v: 16.4, w: 1.3, d: 1.1 },
  { u: 2.5, v: 16.4, w: 1.3, d: 1.1 },
];
const TREES = [
  { u: -13.6, v: 20.6 },
  { u: 13.6, v: 20.6 },
];
const PLANTER_H = 0.7;

export function Props() {
  const quality = useStore((s) => s.quality);
  const plants = useMemo(() => {
    const leafy: Placement[] = [];
    const flowers: Placement[] = [];
    PLANTERS.forEach((pl, i) => {
      const n = Math.max(1, Math.round((pl.w * pl.d) / 1.3));
      for (let k = 0; k < n; k++) {
        const fx = ((k + 0.5) / n - 0.5) * (pl.w - 0.6);
        const fz = (k % 2 ? 0.22 : -0.22) * (pl.d - 0.5);
        const item: Placement = { p: at(pl.u + fx, pl.v - fz, PLANTER_H), ry: (i * 1.7 + k * 2.3) % (Math.PI * 2), s: 0.8 + ((i + k) % 3) * 0.12 };
        (k % 2 ? flowers : leafy).push(item);
      }
    });
    for (const t of TREES) leafy.push({ p: at(t.u + 0.7, t.v - 0.5, PLANTER_H), ry: 1, s: 0.7 });
    return { leafy, flowers };
  }, []);
  const trees: Placement[] = useMemo(() => TREES.map((t, i) => ({ p: at(t.u, t.v, PLANTER_H), ry: i * 2.1 })), []);

  return (
    <>
      <ModelInstances name="lamp-post-street" items={LAMPS} />
      <ModelInstances name="bench-wood" items={BENCHES} />
      <ModelInstances name="tree-pine-cone" items={trees} />
      <ModelInstances name="plant-leafy" items={plants.leafy} shadows={quality === 'high'} />
      <ModelInstances name="flowers-tall" items={plants.flowers} shadows={quality === 'high'} />

      {PLANTERS.map((pl, i) => (
        <group key={i} position={at(pl.u, pl.v)}>
          <mesh position={[0, PLANTER_H / 2, 0]} material={M.planter} castShadow receiveShadow>
            <boxGeometry args={[pl.w, PLANTER_H, pl.d]} />
          </mesh>
          <mesh position={[0, PLANTER_H - 0.02, 0]} material={M.soil}>
            <boxGeometry args={[pl.w - 0.24, 0.06, pl.d - 0.24]} />
          </mesh>
        </group>
      ))}
      {TREES.map((t, i) => (
        <group key={i} position={at(t.u, t.v)}>
          <mesh position={[0, PLANTER_H / 2, 0]} material={M.planter} castShadow receiveShadow>
            <cylinderGeometry args={[1.35, 1.45, PLANTER_H, 24]} />
          </mesh>
          <mesh position={[0, PLANTER_H - 0.02, 0]} material={M.soil}>
            <cylinderGeometry args={[1.18, 1.18, 0.06, 24]} />
          </mesh>
        </group>
      ))}

      <RigidBody type="fixed" colliders={false}>
        {LAMPS.map((l, i) => (
          <CylinderCollider key={`l${i}`} args={[1.6, 0.2]} position={[l.p[0], 1.6, l.p[2]]} />
        ))}
        {BENCHES.map((b, i) => (
          <CuboidCollider key={`b${i}`} args={[0.8, 0.5, 0.42]} position={[b.p[0], 0.5, b.p[2]]} rotation={[0, b.ry ?? 0, 0]} />
        ))}
        {PLANTERS.map((pl, i) => {
          const [x, , z] = at(pl.u, pl.v);
          return <CuboidCollider key={`p${i}`} args={[pl.w / 2, 0.75, pl.d / 2]} position={[x, 0.75, z]} />;
        })}
        {TREES.map((t, i) => {
          const [x, , z] = at(t.u, t.v);
          return <CylinderCollider key={`t${i}`} args={[0.75, 1.45]} position={[x, 0.75, z]} />;
        })}
      </RigidBody>
    </>
  );
}
