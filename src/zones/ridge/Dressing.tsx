import { useLayoutEffect, useMemo, useRef } from 'react';
import { BallCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { modelScale, useMerged } from '../../components/Model.tsx';
import type { ModelName } from '../../config/models.ts';
import { useStore } from '../../state/store.ts';
import { S_END, YEARS, deckY, hwAt, sContest } from './profile.ts';
import { faceRun, frontFaceAt } from './shape.ts';
import { HIST_X1 } from './Histogram.tsx';

type Item = { x: number; y: number; z: number; yaw: number; scale: number };

// Small deterministic generator so the dressing is the same on every load.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const BACK_RUN = faceRun({ x: 0, z: -1 });

// Ground height on the far side of the ridge at (s, z), z < -hw.
function backSlopeY(s: number, z: number) {
  const sc = Math.min(Math.max(s, 0), S_END);
  return Math.max(0, deckY(sc) - (-hwAt(sc) - z) / BACK_RUN);
}

function Instances({ name, items, shadows = true }: { name: ModelName; items: Item[]; shadows?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const { geometry, material } = useMerged(name);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const p = new Vector3();
    const sc = new Vector3();
    const base = modelScale(name);
    items.forEach((it, i) => {
      q.setFromEuler(e.set(0, it.yaw, 0));
      m.setMatrixAt(i, mat.compose(p.set(it.x, it.y, it.z), q, sc.setScalar(base * it.scale)));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, name]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow />;
}

// Conifers on the far slope and the meadow behind the ridge, rocks along the foot of the cliff.
export function Dressing() {
  const low = useStore((s) => s.quality === 'low');
  const sets = useMemo(() => {
    const r = rng(1719);
    const tall: Item[] = [];
    const snowy: Item[] = [];
    const pines: Item[] = [];
    for (let s = 12; s < S_END + 6; s += 4.2) { // clear of the explainer board at the foot
      for (let row = 0; row < 3; row++) {
        if (r() < (row === 0 ? 0.55 : 0.3)) continue;
        const ss = s + (r() - 0.5) * 3;
        const z = -hwAt(Math.min(ss, S_END)) - 6 - row * 5.5 - r() * 3;
        const y = backSlopeY(ss, z) - 0.15;
        const it = { x: -ss, y, z, yaw: r() * Math.PI * 2, scale: 0.85 + r() * 0.35 };
        if (y > 5.5) snowy.push(it);
        else if (row === 2 || r() < 0.4) tall.push(it);
        else pines.push(it);
      }
    }
    const rocks: Item[] = [];
    const rocksB: Item[] = [];
    const stones = YEARS.map((y) => sContest(y.index));
    for (let s = 3; s < S_END; s += 6.5) {
      const ss = s + (r() - 0.5) * 2;
      if (stones.some((t) => Math.abs(t - ss) < 2.5)) continue;
      if (-ss > HIST_X1 - 2 && -ss < 4 && r() < 0.6) continue; // keep the stats yard tidy
      const sc = Math.min(ss, S_END);
      const z = frontFaceAt(sc, -0.25).z + 0.15 + r() * 0.5;
      const it = { x: -ss, y: -0.05, z, yaw: r() * Math.PI * 2, scale: 0.45 + r() * 0.4 };
      (r() < 0.5 ? rocks : rocksB).push(it);
    }
    return { tall, snowy, pines, rocks, rocksB };
  }, []);
  const thin = <T,>(a: T[]) => (low ? a.filter((_, i) => i % 2 === 0) : a);
  const trees = [thin(sets.tall), thin(sets.snowy), thin(sets.pines)];
  return (
    <>
      <Instances name="tree-deodar-tall" items={trees[0]} />
      <Instances name="tree-pine-snow" items={trees[1]} />
      <Instances name="tree-pine-full" items={trees[2]} />
      <Instances name="rock-grey-b" items={sets.rocks} shadows={!low} />
      <Instances name="rock-grey-c" items={sets.rocksB} shadows={!low} />
      <RigidBody type="fixed" colliders={false}>
        {trees.flat().map((t, i) => (
          <CylinderCollider key={`t${i}`} args={[1.6, 0.35 * t.scale]} position={[t.x, t.y + 1.6, t.z]} />
        ))}
        {[...sets.rocks, ...sets.rocksB].map((r, i) => (
          <BallCollider key={`r${i}`} args={[0.9 * r.scale]} position={[r.x, 0.05, r.z]} />
        ))}
      </RigidBody>
    </>
  );
}
