import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { ConeCollider, CuboidCollider, CylinderCollider, InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import type { InstancedRigidBodyProps, RapierRigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Matrix4 } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from '../../config/palette.ts';
import { ZONE } from './frame.ts';
import type { InstancedMesh } from 'three';
import { modelScale, modelSize, useMerged } from '../../components/Model.tsx';
import type { ModelName } from '../../config/models.ts';
import { useStore } from '../../state/store.ts';
import { useHomeReset } from './useHomeReset.ts';

// Things to knock around (crates, cones) and the plaza's street lamps.

type Spot = [number, number, number?]; // x, z, yaw
type Place = { x: number; y: number; z: number; yaw?: number };

// The kit's merged geometry with the world scale baked in, so instances and colliders use metres.
function useScaledGeometry(name: ModelName) {
  const { geometry, material } = useMerged(name);
  const s = modelScale(name);
  return useMemo(() => ({ geometry: geometry.clone().scale(s, s, s), material }), [geometry, material, s]);
}

function Knockables({ name, spots, collider, idle = 12 }: { name: ModelName; spots: Place[]; collider: ReactNode; idle?: number }) {
  const { geometry, material } = useScaledGeometry(name);
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  useHomeReset(bodies, idle, 12);
  const instances = useMemo<InstancedRigidBodyProps[]>(
    () =>
      spots.map((p, i) => ({
        key: `${name}-${i}`,
        position: [p.x, p.y, p.z],
        rotation: [0, p.yaw ?? 0, 0],
      })),
    [name, spots],
  );
  return (
    <InstancedRigidBodies ref={bodies} instances={instances} colliders={false} colliderNodes={[collider]}>
      <instancedMesh args={[geometry, material, instances.length]} castShadow receiveShadow frustumCulled={false} />
    </InstancedRigidBodies>
  );
}

const CRATE = modelSize('crate-wood')[0];
const BANDED = modelSize('crate-wood-banded')[0];
const [CONE_W, CONE_H] = modelSize('traffic-cone');

// A small pyramid near the entrance, a pair of banded crates by the arcade, cones in a slalom.
const CRATES: Place[] = [
  { x: -6.4, y: 0, z: 2.0, yaw: 0.05 },
  { x: -6.4 + CRATE + 0.02, y: 0, z: 2.0, yaw: -0.04 },
  { x: -6.4 + CRATE / 2, y: CRATE + 0.01, z: 2.0, yaw: 0.2 },
];
const BANDED_CRATES: Place[] = [{ x: 16.9, y: 0, z: -1.9, yaw: 0.3 }];
const TOP_CRATES: Place[] = [{ x: 16.9, y: BANDED + 0.01, z: -1.9, yaw: -0.2 }];
const CONES: Place[] = [0, 3.2, 6.4, 9.6, 12.8].map((x, i) => ({ x, y: 0, z: i % 2 ? 0.9 : -0.9 }));

// Garage lamps: [x, z, yaw]; the arm points along the lamp's local +X.
export const LAMPS: Spot[] = [
  [-7, -5.4, -Math.PI / 2],
  [-7, 5.4, Math.PI / 2],
  [17.4, -5.4, -Math.PI / 2],
  [-19.6, 5.4, Math.PI / 2],
];
const LAMP_H = 4.6;
const ARM = 0.95;

function colored(g: BufferGeometry, hex: string): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  const c = new Color(hex);
  const n = out.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new Float32BufferAttribute(arr, 3));
  out.deleteAttribute('uv');
  return out;
}

function lampGeometry(): BufferGeometry {
  const parts = [
    colored(new CylinderGeometry(0.26, 0.3, 0.3, 12).translate(0, 0.15, 0), COLORS.inkSoft),
    colored(new CylinderGeometry(0.085, 0.1, LAMP_H, 10).translate(0, LAMP_H / 2, 0), '#3a3f4b'),
    colored(new BoxGeometry(ARM + 0.1, 0.09, 0.09).translate(ARM / 2, LAMP_H - 0.05, 0), '#3a3f4b'),
    colored(new ConeGeometry(0.42, 0.34, 14, 1, true).translate(ARM, LAMP_H - 0.24, 0), ZONE.color),
    colored(new CylinderGeometry(0.1, 0.1, 0.12, 8).translate(ARM, LAMP_H - 0.03, 0), '#3a3f4b'),
  ];
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

function Lamps() {
  const geometry = useMemo(lampGeometry, []);
  const mesh = useRef<InstancedMesh>(null);
  const bulbs = useRef<InstancedMesh>(null);
  const night = useStore((s) => s.night);
  useLayoutEffect(() => {
    const m = new Matrix4();
    LAMPS.forEach(([x, z, yaw = 0], i) => {
      m.makeRotationY(yaw).setPosition(x, 0, z);
      mesh.current?.setMatrixAt(i, m);
      m.makeTranslation(x + Math.cos(yaw) * ARM, LAMP_H - 0.36, z - Math.sin(yaw) * ARM);
      bulbs.current?.setMatrixAt(i, m);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    if (bulbs.current) bulbs.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {LAMPS.map(([x, z], i) => (
          <CylinderCollider key={i} args={[LAMP_H / 2, 0.16]} position={[x, LAMP_H / 2, z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={mesh} args={[geometry, undefined, LAMPS.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.6} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, LAMPS.length]} frustumCulled={false}>
        <sphereGeometry args={[0.17, 12, 8]} />
        <meshBasicMaterial color={night ? '#ffd98a' : '#fff4d6'} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export function Props() {
  return (
    <group>
      <Knockables name="crate-wood" spots={[...CRATES, ...TOP_CRATES]} collider={<CuboidCollider args={[CRATE / 2, CRATE / 2, CRATE / 2]} position={[0, CRATE / 2, 0]} density={5} />} />
      <Knockables name="crate-wood-banded" spots={BANDED_CRATES} collider={<CuboidCollider args={[BANDED / 2, BANDED / 2, BANDED / 2]} position={[0, BANDED / 2, 0]} density={6} />} />
      <Knockables name="traffic-cone" spots={CONES} idle={8}
        collider={<ConeCollider args={[CONE_H / 2, CONE_W * 0.42]} position={[0, CONE_H / 2, 0]} density={18} />} />
      <Lamps />
    </group>
  );
}
