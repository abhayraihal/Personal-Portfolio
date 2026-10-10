import { useEffect, useMemo } from 'react';
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Material, MeshStandardMaterial } from 'three';
import { modelScale, useMerged } from '../components/Model.tsx';
import type { ModelName } from '../config/models.ts';
import type { Item } from './plan.ts';

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _e = new Euler();

export type Variant = (base: MeshStandardMaterial) => Material;

// One InstancedMesh of a Kenney model. Items are in screen space; this must sit inside the
// FACE_CAMERA_Y group (local x = u, local z = -v).
export function ModelInstances({ name, items, cast = true, receive = true, variant }: {
  name: ModelName;
  items: Item[];
  cast?: boolean;
  receive?: boolean;
  variant?: Variant;
}) {
  const { geometry, material } = useMerged(name);
  const mat = useMemo(() => (variant ? variant(material) : material), [variant, material]);
  const mesh = useMemo(() => {
    const m = new InstancedMesh(geometry, mat, items.length);
    const s0 = modelScale(name);
    items.forEach((it, i) => {
      _p.set(it.u, it.y, -it.v);
      _e.set(it.tilt?.[0] ?? 0, it.ry, it.tilt?.[1] ?? 0, 'YXZ');
      _q.setFromEuler(_e);
      _s.setScalar(s0 * it.s);
      m.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.name = `valley-${name}`;
    return m;
  }, [geometry, mat, items, name, cast, receive]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

const CHUNK = 96; // metres; lets the frustum skip far parts of the valley

// Instances grouped by model and by a coarse grid, one InstancedMesh per group. chunk = 0 keeps a
// model in a single mesh (light or rare models, where an extra draw call costs more than the
// vertices it would save).
export function InstancedItems({ items, cast = true, receive = true, variant, chunk = CHUNK }: {
  items: Item[];
  cast?: boolean;
  receive?: boolean;
  variant?: (name: ModelName) => Variant | undefined;
  chunk?: number | ((name: ModelName) => number);
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { name: ModelName; items: Item[] }>();
    for (const it of items) {
      const c = typeof chunk === 'number' ? chunk : chunk(it.name);
      const key = c > 0 ? `${it.name}|${Math.floor(it.u / c)}|${Math.floor(it.v / c)}` : it.name;
      const g = map.get(key);
      if (g) g.items.push(it);
      else map.set(key, { name: it.name, items: [it] });
    }
    return [...map.entries()];
  }, [items, chunk]);
  return (
    <>
      {groups.map(([key, g]) => (
        <ModelInstances key={key} name={g.name} items={g.items} cast={cast} receive={receive} variant={variant?.(g.name)} />
      ))}
    </>
  );
}
