import { useEffect, useLayoutEffect, useRef } from 'react';
import { Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { useStore } from '../../state/store.ts';
import type { V3 } from './kit/frame.ts';

// Lamp bulbs: pale by day, glowing when store.night is on. One shared material for every lamp in
// the career and sports zones.
export const glowMaterial = new MeshStandardMaterial({ color: '#fff4d2', emissive: '#ffcf70', emissiveIntensity: 0.25, roughness: 0.4 });
glowMaterial.name = 'career-glow';
const sphere = new SphereGeometry(1, 14, 10);

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

export function NightGlow({ positions, radius = 0.25, squash = 1 }: { positions: V3[]; radius?: number; squash?: number }) {
  const ref = useRef<InstancedMesh>(null);
  const night = useStore((s) => s.night);
  useEffect(() => {
    glowMaterial.emissiveIntensity = night ? 2.4 : 0.25;
  }, [night]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    _s.set(radius, radius * squash, radius);
    positions.forEach((p, i) => mesh.setMatrixAt(i, _m.compose(_p.set(...p), _q, _s)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, radius, squash]);
  return <instancedMesh ref={ref} args={[sphere, glowMaterial, positions.length]} />;
}
