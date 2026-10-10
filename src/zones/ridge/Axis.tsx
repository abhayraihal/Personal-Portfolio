import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { K, R0, STRATA, YEARS, deckY, hwAt, ratingY, sContest } from './profile.ts';
import { faceFoot, frontFaceAt } from './shape.ts';
import { cornerCutBox } from './geometry.ts';

const W = 1.0;
const H = 0.95;
const D = 0.42;

// Where the camera-side cliff meets the ground below a point s along the road, and which way it faces.
function cliffFoot(s: number) {
  const slope = (hwAt(s + 0.1) - hwAt(s - 0.1)) / 0.2;
  const l = Math.hypot(slope, 1);
  const n = { x: slope / l, z: 1 / l };
  const f = faceFoot({ s, x: -s, z: hwAt(s), y: deckY(s), n });
  return { x: f.x, z: f.z, n };
}

// A milestone at the foot of the ridge under the first contest of each year, painted like the
// national highway stones in India: white with a yellow top.
export function YearStones() {
  const body = useRef<InstancedMesh>(null);
  const cap = useRef<InstancedMesh>(null);
  const stones = useMemo(
    () =>
      YEARS.map(({ year, index }) => {
        const f = cliffFoot(sContest(index));
        // straight out towards the camera, so the funnel and the plaza flare do not turn them
        return { year, x: f.x, z: f.z + 1.2, yaw: 0 };
      }),
    [],
  );
  const parts = useMemo(() => {
    const capGeo = new CylinderGeometry(W / 2, W / 2, D, 18, 1, false, Math.PI / 2, Math.PI);
    capGeo.rotateX(Math.PI / 2);
    return {
      bodyGeo: cornerCutBox(W, H, D, 0.05),
      capGeo,
      bodyMat: new MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.9 }),
      capMat: new MeshStandardMaterial({ color: COLORS.flags[4], roughness: 0.8 }),
    };
  }, []);

  useLayoutEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const p = new Vector3();
    const up = new Vector3(0, 1, 0);
    stones.forEach((st, i) => {
      q.setFromAxisAngle(up, st.yaw);
      body.current?.setMatrixAt(i, m.compose(p.set(st.x, H / 2, st.z), q, one));
      cap.current?.setMatrixAt(i, m.compose(p.set(st.x, H, st.z), q, one));
    });
    for (const r of [body.current, cap.current]) {
      if (!r) continue;
      r.instanceMatrix.needsUpdate = true;
      r.computeBoundingSphere();
    }
  }, [stones]);

  return (
    <>
      <instancedMesh ref={body} args={[parts.bodyGeo, parts.bodyMat, stones.length]} castShadow receiveShadow />
      <instancedMesh ref={cap} args={[parts.capGeo, parts.capMat, stones.length]} castShadow receiveShadow />
      {stones.map((st) => (
        <group key={st.year} position={[st.x, 0, st.z]} rotation={[0, st.yaw, 0]}>
          <Label font="display" size={0.36} color={COLORS.ink} position={[0, H * 0.52, D / 2 + 0.012]}>
            {st.year}
          </Label>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[W / 2, (H + W / 2) / 2, D / 2]} position={[0, (H + W / 2) / 2, 0]} />
          </RigidBody>
        </group>
      ))}
    </>
  );
}

// Rating values painted on the cliff just above each stratum line, like the y axis of a chart,
// repeated often enough that a phone's narrower view always has a column in it. Clear of the year
// stones and of the plaza flare, where the face turns. The face under a point is one leaning plane,
// so each column is a single text block with one line per 200 rating points.
const AXIS_S = [16, 38, 60, 80, 110, 136];
const AXIS_SIZE = 0.46;
const MID = 0.32; // label centre above its stratum line

export function RatingLabels() {
  const columns = useMemo(() => {
    const lines = STRATA.map((st) => st.rating).filter((r) => r > R0 && r % 200 === 0);
    return AXIS_S.flatMap((s) => {
      const shown = lines.filter((r) => ratingY(r) + MID + AXIS_SIZE * 0.6 <= deckY(s));
      if (!shown.length) return [];
      const lean = frontFaceAt(s, 0).lean;
      // in front of the face along the whole label: the face's lean changes along the ridge
      let out = 0;
      for (const r of shown) {
        const y = ratingY(r) + MID;
        const z0 = frontFaceAt(s, y).z;
        for (let d = 0.2; d <= 1.8; d += 0.2) out = Math.max(out, frontFaceAt(s - d, y).z - z0);
      }
      const y = ratingY(shown[0]) + MID - 0.35 * AXIS_SIZE; // baseline of the lowest label
      const pos: [number, number, number] = [-s + 0.3, y, frontFaceAt(s, y).z + out + 0.03];
      return [{ s, text: shown.toReversed().join('\n'), lean, lineHeight: (200 * K) / Math.cos(lean) / AXIS_SIZE, pos }];
    });
  }, []);
  return (
    <>
      {columns.map((c) => (
        <Label key={c.s} font="bodyBold" size={AXIS_SIZE} lineHeight={c.lineHeight} color="#ffffff" fillOpacity={0.92} outlineWidth={0.035} outlineColor={COLORS.ink} outlineOpacity={0.45} anchorX="left" anchorY="bottom-baseline" rotation={[-c.lean, 0, 0]} position={c.pos}>
          {c.text}
        </Label>
      ))}
    </>
  );
}
