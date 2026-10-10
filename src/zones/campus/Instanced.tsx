import { useLayoutEffect, useRef } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { modelScale, useMerged } from '../../components/Model.tsx';
import { MODELS } from '../../config/models.ts';
import type { ModelName } from '../../config/models.ts';

export type Placement = { x: number; z: number; y?: number; s?: number; ry?: number; sx?: number; sy?: number; sz?: number; rx?: number; rz?: number };

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _e = new Euler();

export function placementMatrix(name: ModelName, it: Placement, out = _m): Matrix4 {
  const k = modelScale(name) * (it.s ?? 1);
  _p.set(it.x, it.y ?? 0, it.z);
  _q.setFromEuler(_e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0));
  _s.set(k * (it.sx ?? 1), k * (it.sy ?? 1), k * (it.sz ?? 1));
  return out.compose(_p, _q, _s);
}

// One InstancedMesh for many copies of a Kenney model. `trunk` adds a fixed cylinder collider per
// copy (radius and height in metres at s = 1).
export function InstancedModel({ name, items, shadows = true, trunk }: {
  name: ModelName;
  items: Placement[];
  shadows?: boolean;
  trunk?: { radius: number; height: number };
}) {
  const { geometry, material } = useMerged(name);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => mesh.setMatrixAt(i, placementMatrix(name, it)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [items, name]);
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow={shadows} />
      {trunk && (
        <RigidBody type="fixed" colliders={false}>
          {items.map((it, i) => {
            const s = it.s ?? 1;
            return <CylinderCollider key={i} args={[(trunk.height * s) / 2, trunk.radius * s]} position={[it.x, (trunk.height * s) / 2, it.z]} />;
          })}
        </RigidBody>
      )}
    </>
  );
}

// Height of a model at s = 1, in metres.
export const modelHeight = (name: ModelName) => MODELS[name].max[1] * modelScale(name);
