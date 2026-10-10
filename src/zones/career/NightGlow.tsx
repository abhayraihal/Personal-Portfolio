import { useEffect, useLayoutEffect, useRef } from 'react';
import { Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { InstancedMesh, MeshStandardMaterial } from 'three';
import { useStore } from '../../state/store.ts';
import type { V3 } from './kit/frame.ts';
import { glowIntensity, glowMaterial } from './kit/paint.ts';

// Lamp bulbs: pale by day, glowing when store.night is on. They share glowMaterial unless a
// structure passes its own copy (to fade it with the structure).
const sphere = new SphereGeometry(1, 14, 10);

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

export function NightGlow({ positions, radius = 0.25, squash = 1, material = glowMaterial }: {
  positions: V3[]; radius?: number; squash?: number; material?: MeshStandardMaterial;
}) {
  const ref = useRef<InstancedMesh>(null);
  const night = useStore((s) => s.night);
  useEffect(() => {
    material.emissiveIntensity = glowIntensity(night);
  }, [night, material]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    _s.set(radius, radius * squash, radius);
    positions.forEach((p, i) => mesh.setMatrixAt(i, _m.compose(_p.set(...p), _q, _s)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, radius, squash]);
  return <instancedMesh ref={ref} args={[sphere, material, positions.length]} />;
}
