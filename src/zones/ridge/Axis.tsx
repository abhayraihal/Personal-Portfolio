import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { R0, STRATA, YEARS, deckY, hwAt, ratingY, sContest } from './profile.ts';
import { faceFoot, faceRun } from './shape.ts';
import { chamferedBox } from './geometry.ts';

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
        return { year, x: f.x + f.n.x * 1.2, z: f.z + f.n.z * 1.2, yaw: Math.atan2(f.n.x, f.n.z) };
      }),
    [],
  );
  const parts = useMemo(() => {
    const capGeo = new CylinderGeometry(W / 2, W / 2, D, 18, 1, false, Math.PI / 2, Math.PI);
    capGeo.rotateX(Math.PI / 2);
    return {
      bodyGeo: chamferedBox(W, H, D, 0.05),
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
// repeated at a few places along the ridge.
const AXIS_S = [24, 62, 100, 134];
const AXIS_SIZE = 0.42;
const FRONT_RUN = faceRun({ x: 0, z: 1 });

export function RatingLabels() {
  const labels = useMemo(() => {
    const out: { key: string; text: string; pos: [number, number, number] }[] = [];
    const lines = STRATA.map((st) => st.rating).filter((r) => r > R0);
    for (const s of AXIS_S) {
      const top = deckY(s);
      for (const r of lines) {
        const y = ratingY(r) + 0.32;
        if (top < y + AXIS_SIZE * 0.6) continue;
        out.push({ key: `${s}-${r}`, text: String(r), pos: [-s, y, hwAt(s) + FRONT_RUN * (top - y) + 0.03] });
      }
    }
    return out;
  }, []);
  const tilt = -Math.atan(FRONT_RUN);
  return (
    <>
      {labels.map((l) => (
        <Label key={l.key} font="bodyBold" size={AXIS_SIZE} color="#ffffff" fillOpacity={0.8} anchorX="left" rotation={[tilt, 0, 0]} position={[l.pos[0] + 0.3, l.pos[1], l.pos[2]]}>
          {l.text}
        </Label>
      ))}
    </>
  );
}
