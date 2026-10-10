import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, CylinderCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { InstancedRigidBodyProps, RapierRigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, TorusGeometry } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { modelScale, modelSize, useMerged } from '../../components/Model.tsx';
import { COLORS } from '../../config/palette.ts';
import { useHomeReset } from './useHomeReset.ts';

// Workshop clutter along the front of the garage: tyre stacks and oil drums to knock over, a tool
// chest and two flower planters.

function paint(g: BufferGeometry, hex: string): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  const c = new Color(hex);
  const n = out.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new Float32BufferAttribute(arr, 3));
  out.deleteAttribute('uv');
  return out;
}

const TYRE_R = 0.62;
const TYRE_H = 0.38;

function tyreGeometry(): BufferGeometry {
  const g = mergeGeometries([
    paint(new TorusGeometry(0.43, 0.19, 10, 22).rotateX(Math.PI / 2), '#2b2d33'),
    paint(new CylinderGeometry(0.3, 0.3, 0.2, 16), '#b9bcc6'),
    paint(new CylinderGeometry(0.1, 0.1, 0.22, 10), '#6f7286'),
  ]);
  g.computeVertexNormals();
  return g;
}

const TYRES: [number, number, number][] = [
  [-9.2, 19.4, 3],
  [-7.7, 20.5, 2],
  [9.6, 20.8, 2],
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
  [5.0, 19.9],
  [6.1, 20.6],
  [5.3, 21.3],
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

function ToolChest({ position }: { position: [number, number, number] }) {
  const W = 1.9;
  const H = 1.45;
  const D = 0.85;
  const drawers = [0.32, 0.62, 0.88, 1.1, 1.3];
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, H / 2 + 0.06, D / 2]} position={[0, H / 2 + 0.06, 0]} />
      </RigidBody>
      <mesh position={[0, 0.12 + H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#d6382f" roughness={0.55} metalness={0.15} />
      </mesh>
      {drawers.map((y, i) => (
        <group key={i}>
          <mesh position={[0, 0.12 + y, D / 2 + 0.005]}>
            <boxGeometry args={[W - 0.16, 0.025, 0.01]} />
            <meshStandardMaterial color="#8f1f1a" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.12 + y - 0.1, D / 2 + 0.03]}>
            <boxGeometry args={[0.5, 0.05, 0.04]} />
            <meshStandardMaterial color="#d9dde3" roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.12 + H + 0.03, 0]} castShadow>
        <boxGeometry args={[W + 0.06, 0.06, D + 0.06]} />
        <meshStandardMaterial color={COLORS.inkSoft} roughness={0.6} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * (W / 2 - 0.12), 0.06, z * (D / 2 - 0.12)]}>
          <cylinderGeometry args={[0.07, 0.07, 0.1, 10]} />
          <meshStandardMaterial color={COLORS.ink} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

const PLANTERS: [number, number, number][] = [
  [-14, 21.6, 3.4],
  [13.2, 21.4, 3.4],
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
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {PLANTERS.map(([x, z, w], i) => (
          <CuboidCollider key={i} args={[w / 2, 0.32, 0.55]} position={[x, 0.32, z]} />
        ))}
      </RigidBody>
      {PLANTERS.map(([x, z, w], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={box} position={[0, 0.3, 0]} scale={[w, 0.6, 1.1]} castShadow receiveShadow>
            <meshStandardMaterial color="#b98a5e" roughness={0.9} />
          </mesh>
          <mesh geometry={box} position={[0, 0.605, 0]} scale={[w - 0.2, 0.02, 0.9]} receiveShadow>
            <meshStandardMaterial color="#6b4a32" roughness={1} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={flowers} args={[geometry, material, spots.length]} castShadow frustumCulled={false} />
    </group>
  );
}

export function GarageProps() {
  return (
    <group>
      <Tyres />
      <Drums />
      <ToolChest position={[-3.4, 0, 20.6]} />
      <Planters />
    </group>
  );
}
