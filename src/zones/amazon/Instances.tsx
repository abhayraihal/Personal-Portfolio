import { useLayoutEffect, useRef } from 'react';
import type { Ref } from 'react';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { modelScale, useMerged } from '../../components/Model.tsx';
import type { ModelName } from '../../config/models.ts';

export type Placement = { p: [number, number, number]; ry?: number; s?: number };

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();

export function placementMatrix(name: ModelName, it: Placement, scale = 1, out = _m) {
  _p.set(it.p[0], it.p[1], it.p[2]);
  _q.setFromEuler(_e.set(0, it.ry ?? 0, 0));
  _s.setScalar(modelScale(name) * scale * (it.s ?? 1));
  return out.compose(_p, _q, _s);
}

// One InstancedMesh for every copy of a Kenney model in a static list.
export function ModelInstances({ name, items, scale = 1, shadows = true, meshRef }: {
  name: ModelName;
  items: Placement[];
  scale?: number;
  shadows?: boolean;
  meshRef?: Ref<InstancedMesh>;
}) {
  const { geometry, material } = useMerged(name);
  const local = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = local.current;
    if (!m) return;
    items.forEach((it, i) => m.setMatrixAt(i, placementMatrix(name, it, scale)));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, name, scale]);
  return (
    <instancedMesh
      ref={(el) => {
        local.current = el;
        if (typeof meshRef === 'function') meshRef(el);
        else if (meshRef) (meshRef as { current: InstancedMesh | null }).current = el;
      }}
      args={[geometry, material, items.length]}
      castShadow={shadows}
      receiveShadow={shadows}
    />
  );
}
