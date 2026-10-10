import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider } from '@react-three/rapier';
import type { CollisionEnterHandler } from '@react-three/rapier';
import { BoxGeometry, Color, Float32BufferAttribute, Matrix4, MeshStandardMaterial } from 'three';
import type { BufferGeometry, InstancedMesh, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Resettable } from '../../components/Resettable.tsx';
import { car } from '../../state/car.ts';
import { events } from '../../state/events.ts';
import { at } from './shared.ts';

// A stack of six parcels by the entrance for the car to knock over. Plain boxes with tape and a
// blank label; they drift home once the car has left them alone. The six bodies carry no meshes:
// one instanced mesh copies their poses every frame.

const SIZE = 0.8;
const STACK = { u: 5.3, v: -15.8 };

function tinted(g: BufferGeometry, hex: string) {
  const c = new Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

function parcelGeometry() {
  const h = SIZE / 2;
  const parts = [
    tinted(new BoxGeometry(SIZE, SIZE, SIZE), '#c9925b'),
    tinted(new BoxGeometry(0.2, 0.014, SIZE + 0.012).translate(0, h, 0), '#e6c48f'),
    tinted(new BoxGeometry(0.2, 0.28, 0.014).translate(0, h - 0.14, h), '#e6c48f'),
    tinted(new BoxGeometry(0.3, 0.2, 0.012).translate(-0.15, -0.12, h + 0.002), '#f7f2e8'),
  ];
  const merged = mergeGeometries(parts, false) ?? parts[0];
  for (const p of parts) if (p !== merged) p.dispose();
  return merged;
}

// [x, y, z, yaw] in the stack's frame: three, two, one.
const BOXES: [number, number, number, number][] = [
  [-0.84, 0.41, 0, 0.05], [0, 0.41, 0.03, -0.04], [0.84, 0.41, -0.02, 0.07],
  [-0.42, 1.23, 0.02, -0.06], [0.42, 1.23, -0.01, 0.04],
  [0, 2.05, 0, 0.1],
];

let lastImpact = 0;
// A thud when the car hits a parcel, for the sound system; at most one every 150 ms.
const onHit: CollisionEnterHandler = ({ other, target }) => {
  if (other.rigidBodyObject?.name !== 'car') return;
  const now = performance.now();
  if (now - lastImpact < 150 || Math.abs(car.speed) < 1.5) return;
  lastImpact = now;
  const p = target.rigidBody?.translation();
  if (p) events.emit('impact', { strength: Math.abs(car.speed), x: p.x, y: p.y, z: p.z, material: 'soft' });
};

const _inv = new Matrix4();
const _m = new Matrix4();

export function Parcels() {
  const geometry = useMemo(parcelGeometry, []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), []);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  const mesh = useRef<InstancedMesh>(null);
  const poses = useRef<(Object3D | null)[]>([]);
  useFrame(() => {
    const m = mesh.current;
    const parent = m?.parent;
    if (!m || !parent) return;
    parent.updateWorldMatrix(true, false);
    _inv.copy(parent.matrixWorld).invert();
    poses.current.forEach((o, i) => {
      if (!o) return;
      o.updateWorldMatrix(true, false);
      m.setMatrixAt(i, _m.multiplyMatrices(_inv, o.matrixWorld));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  });
  const [sx, , sz] = at(STACK.u, STACK.v);
  return (
    <>
      {BOXES.map(([x, y, z, yaw], i) => (
        <Resettable key={i} colliders={false} position={[sx + x, y, sz + z]} rotation={[0, yaw, 0]} idleSeconds={10} carDistance={12} onCollisionEnter={onHit}>
          <CuboidCollider args={[SIZE / 2, SIZE / 2, SIZE / 2]} mass={5} friction={0.8} restitution={0.1} />
          <object3D
            ref={(el) => {
              poses.current[i] = el;
            }}
          />
        </Resettable>
      ))}
      <instancedMesh ref={mesh} args={[geometry, material, BOXES.length]} castShadow receiveShadow />
    </>
  );
}
