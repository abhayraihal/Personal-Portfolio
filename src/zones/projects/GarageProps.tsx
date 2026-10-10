import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, CylinderCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { InstancedRigidBodyProps, RapierRigidBody } from '@react-three/rapier';
import { BoxGeometry, CylinderGeometry, Matrix4, TorusGeometry } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { modelScale, modelSize, useMerged } from '../../components/Model.tsx';
import { COLORS } from '../../config/palette.ts';
import { mergeParts } from './geom.ts';
import type { Part } from './geom.ts';
import { useHomeReset } from './useHomeReset.ts';

// Workshop clutter along the front of the garage: tyre stacks and oil drums to knock over, a tool
// chest and two flower planters.

const TYRE_R = 0.62;
const TYRE_H = 0.38;

function tyreGeometry(): BufferGeometry {
  return mergeParts([
    { g: new TorusGeometry(0.43, 0.19, 10, 22), color: '#2b2d33', rot: [Math.PI / 2, 0, 0] },
    { g: new CylinderGeometry(0.3, 0.3, 0.2, 16), color: '#b9bcc6' },
    { g: new CylinderGeometry(0.1, 0.1, 0.22, 10), color: '#6f7286' },
  ]);
}

const TYRES: [number, number, number][] = [
  [-8.9, 22.0, 3],
  [-7.4, 23.1, 2],
  [9.8, 22.6, 2],
];

function Tyres() {
  const geometry = useMemo(tyreGeometry, []);
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  useHomeReset(bodies, 12, 12);
  const instances = useMemo<InstancedRigidBodyProps[]>(
    () =>
      TYRES.flatMap(([x, z, n], s) =>
        Array.from({ length: n }, (_, k) => ({ key: `tyre-${s}-${k}`, position: [x + (k % 2) * 0.06, TYRE_H / 2 + k * (TYRE_H + 0.005), z] as [number, number, number], rotation: [0, k * 0.7, 0] as [number, number, number] })),
      ),
    [],
  );
  return (
    <InstancedRigidBodies ref={bodies} instances={instances} colliders={false}
      colliderNodes={[<CylinderCollider key="c" args={[TYRE_H / 2, TYRE_R]} density={6} friction={0.9} />]}>
      <instancedMesh args={[geometry, undefined, instances.length]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </instancedMesh>
    </InstancedRigidBodies>
  );
}

const DRUMS: [number, number][] = [
  [4.9, 22.2],
  [6.0, 22.9],
  [5.2, 23.6],
];

function Drums() {
  const { geometry: base, material } = useMerged('barrel-drum');
  const s = modelScale('barrel-drum');
  const [w, h] = modelSize('barrel-drum');
  const geometry = useMemo(() => base.clone().scale(s, s, s), [base, s]);
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  useHomeReset(bodies, 12, 12);
  const instances = useMemo<InstancedRigidBodyProps[]>(() => DRUMS.map(([x, z], i) => ({ key: `drum-${i}`, position: [x, 0, z], rotation: [0, i * 1.3, 0] })), []);
  return (
    <InstancedRigidBodies ref={bodies} instances={instances} colliders={false}
      colliderNodes={[<CylinderCollider key="c" args={[h / 2, w / 2]} position={[0, h / 2, 0]} density={4} />]}>
      <instancedMesh args={[geometry, material, instances.length]} castShadow receiveShadow frustumCulled={false} />
    </InstancedRigidBodies>
  );
}

function toolChestGeometry(): BufferGeometry {
  const W = 1.9;
  const H = 1.45;
  const D = 0.85;
  const parts: Part[] = [
    { g: new BoxGeometry(W, H, D), color: '#d6382f', at: [0, 0.12 + H / 2, 0] },
    { g: new BoxGeometry(W + 0.06, 0.06, D + 0.06), color: COLORS.inkSoft, at: [0, 0.12 + H + 0.03, 0] },
  ];
  for (const y of [0.32, 0.62, 0.88, 1.1, 1.3]) {
    parts.push({ g: new BoxGeometry(W - 0.16, 0.025, 0.01), color: '#8f1f1a', at: [0, 0.12 + y, D / 2 + 0.005] });
    parts.push({ g: new BoxGeometry(0.5, 0.05, 0.04), color: '#d9dde3', at: [0, 0.12 + y - 0.1, D / 2 + 0.03] });
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push({ g: new CylinderGeometry(0.07, 0.07, 0.1, 10), color: COLORS.ink, at: [x * (W / 2 - 0.12), 0.06, z * (D / 2 - 0.12)] });
  return mergeParts(parts);
}

function ToolChest({ position }: { position: [number, number, number] }) {
  const geometry = useMemo(toolChestGeometry, []);
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95, 0.785, 0.425]} position={[0, 0.785, 0]} />
      </RigidBody>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.1} />
      </mesh>
    </group>
  );
}

const PLANTERS: [number, number, number][] = [
  [-12.4, 22.9, 3.0],
  [13.0, 22.2, 3.0],
];

function Planters() {
  const { geometry: base, material } = useMerged('flowers-tall');
  const s = modelScale('flowers-tall') * 0.8;
  const geometry = useMemo(() => base.clone().scale(s, s, s), [base, s]);
  const flowers = useRef<InstancedMesh>(null);
  const spots = useMemo(() => PLANTERS.flatMap(([x, z, w]) => [-1, 0, 1].map((k) => [x + k * (w / 3), z] as [number, number])), []);
  useLayoutEffect(() => {
    const m = new Matrix4();
    spots.forEach(([x, z], i) => {
      m.makeRotationY(i * 1.9).setPosition(x, 0.62, z);
      flowers.current?.setMatrixAt(i, m);
    });
    if (flowers.current) flowers.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  const boxes = useMemo(
    () =>
      mergeParts(
        PLANTERS.flatMap(([x, z, w]): Part[] => [
          { g: new BoxGeometry(w, 0.6, 1.1), color: '#b98a5e', at: [x, 0.3, z] },
          { g: new BoxGeometry(w - 0.2, 0.02, 0.9), color: '#6b4a32', at: [x, 0.605, z] },
        ]),
      ),
    [],
  );
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {PLANTERS.map(([x, z, w], i) => (
          <CuboidCollider key={i} args={[w / 2, 0.32, 0.55]} position={[x, 0.32, z]} />
        ))}
      </RigidBody>
      <mesh geometry={boxes} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <instancedMesh ref={flowers} args={[geometry, material, spots.length]} castShadow frustumCulled={false} />
    </group>
  );
}

export function GarageProps() {
  return (
    <group>
      <Tyres />
      <Drums />
      <ToolChest position={[-2.6, 0, 23.2]} />
      <Planters />
    </group>
  );
}
