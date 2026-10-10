import { useLayoutEffect, useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { Board } from '../../components/Board.tsx';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { codeforces, rankFor } from '../../data/codeforces.ts';
import { useStore } from '../../state/store.ts';
import { cornerCutBox, shadeFor } from './geometry.ts';
import { selfLitMaterial } from './materials.ts';

// Ridge-frame layout: the easy end sits by the ramp, harder ratings run left along the foot, the
// same way the road climbs.
export const HIST = { x0: -8, pitch: 1.75, z: 9.9, cube: 0.5, gap: 0.03, plinthH: 0.5 };
const STEP = HIST.cube + HIST.gap;
const PER_LAYER = 2;
const TILT = -0.6; // labels lean back towards the camera

export const columns = codeforces.solvedByRating.map(([rating, count], i) => {
  const cubes = Math.ceil(count / 10);
  const rank = rankFor(rating);
  return { rating, count, cubes, layers: Math.ceil(cubes / PER_LAYER), x: HIST.x0 - i * HIST.pitch, color: shadeFor(rank.name, rank.color) };
});
export const HIST_X1 = columns[columns.length - 1].x;

export function Histogram() {
  const ref = useRef<InstancedMesh>(null);
  const low = useStore((s) => s.quality === 'low');
  const ink = useStore((s) => (s.night ? COLORS.paper : COLORS.ink)); // labels are unlit
  const total = columns.reduce((n, c) => n + c.cubes, 0);
  // the rank colours glow at night, like the rail posts
  const parts = useMemo(() => ({ geo: cornerCutBox(HIST.cube, HIST.cube, HIST.cube, 0.07), mat: selfLitMaterial({ roughness: 0.6 }, 0, 0.35) }), []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const p = new Vector3();
    const c = new Color();
    let k = 0;
    for (const col of columns) {
      c.set(col.color);
      for (let j = 0; j < col.cubes; j++) {
        const layer = Math.floor(j / PER_LAYER);
        const side = j % PER_LAYER;
        p.set(col.x + (side - 0.5) * STEP, HIST.plinthH + HIST.cube / 2 + layer * STEP, HIST.z);
        m.setMatrixAt(k, mat.compose(p, q, one));
        m.setColorAt(k, c);
        k++;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);

  const xa = HIST.x0 + 0.9;
  const xb = HIST_X1 - 0.9;
  const plinthD = 1.7;
  const plinthZ = HIST.z + 0.45;
  return (
    <>
      <instancedMesh ref={ref} args={[parts.geo, parts.mat, total]} castShadow={!low} receiveShadow />
      <RoundedBox args={[xa - xb, HIST.plinthH, plinthD]} radius={0.1} smoothness={2} position={[(xa + xb) / 2, HIST.plinthH / 2, plinthZ]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.paperShade} roughness={1} />
      </RoundedBox>
      {columns.map((col) => (
        <group key={col.rating} position={[col.x, 0, 0]}>
          <Label font="display" size={0.42} color={ink} rotation={[TILT, 0, 0]} position={[0, HIST.plinthH + 0.24, plinthZ + 0.55]}>
            {String(col.rating)}
          </Label>
          <Label font="bodyBold" size={0.4} color={ink} rotation={[TILT, 0, 0]} position={[0, HIST.plinthH + col.layers * STEP + 0.38, HIST.z]}>
            {String(col.count)}
          </Label>
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(xa - xb) / 2, 0.5, plinthD / 2]} position={[(xa + xb) / 2, 0.5, plinthZ]} />
        {columns.map((col) => (
          <CuboidCollider key={col.rating} args={[STEP, (col.layers * STEP) / 2, STEP / 2]} position={[col.x, HIST.plinthH + (col.layers * STEP) / 2, HIST.z]} />
        ))}
      </RigidBody>
      <Board
        title="Solved by problem rating"
        lines={['1 block = 10 problems, rounded up', 'Block colour = rank at that rating']}
        width={8.4}
        titleSize={0.58}
        lineSize={0.37}
        accent={shadeFor('Expert', '#0000ff')}
        lift={0.9}
        position={[xb - 4.9, 0, HIST.z + 0.3]}
      />
    </>
  );
}
