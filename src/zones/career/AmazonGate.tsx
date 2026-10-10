import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { useOcclusionFade } from './kit/fade.ts';
import type { V3 } from './kit/frame.ts';
import { box, paint, shade } from './kit/paint.ts';
import type { Part } from './kit/paint.ts';
import { NightGlow } from './NightGlow.tsx';

const HALF = 7.5; // pillar centre from the road centre
const PILLAR = 1.5;
const PILLAR_H = 8.4;
const SIGN_Y = 6.3;
const SIGN_H = 3.4;
const SIGN_Z = 0.42;
const FACE_Z = SIGN_Z + 0.17;
const RISE = 3.1; // height of the arch above the pillar caps

// Entrance arch at the end of the career road, leading into the Amazon plaza.
const GLOWS: V3[] = [[-HALF, PILLAR_H + 0.62, 0], [HALF, PILLAR_H + 0.62, 0]];

// The sign panel is what hides the car; the arch above it is open.
const OCCLUDER = { min: [-HALF, SIGN_Y - SIGN_H / 2, -0.2] as V3, max: [HALF, SIGN_Y + SIGN_H / 2, FACE_Z + 0.05] as V3 };

export function AmazonGate({ position, title, dates }: { position: V3; title: string; dates: string }) {
  const root = useRef<Group>(null);
  const fade = useOcclusionFade(root, OCCLUDER, 0.25);
  const [lit, face] = useMemo(() => {
    const orange = COLORS.amazon;
    const dark = shade(COLORS.ink, 0.08);
    const signW = HALF * 2 - PILLAR;
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const x = s * HALF;
      parts.push(
        { geo: box(2.1, 0.6, 2.1, 0.1), color: shade(COLORS.rock, 0.3), at: [x, 0.3, 0] },
        { geo: box(PILLAR, PILLAR_H, PILLAR, 0.16), color: dark, at: [x, PILLAR_H / 2, 0] },
        { geo: box(PILLAR + 0.1, 0.36, PILLAR + 0.1, 0.06), color: orange, at: [x, 1.1, 0] },
        { geo: box(PILLAR + 0.1, 0.36, PILLAR + 0.1, 0.06), color: orange, at: [x, 3.0, 0] },
        { geo: box(PILLAR + 0.4, 0.45, PILLAR + 0.4, 0.1), color: orange, at: [x, PILLAR_H + 0.22, 0] },
      );
    }
    parts.push({ geo: box(signW + 0.1, SIGN_H, 0.32, 0.1), color: shade(orange, -0.2), at: [0, SIGN_Y, SIGN_Z - 0.02] });
    // Flattened arch over the caps, as a tube so it keeps its thickness at the crown.
    const pts: Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * Math.PI;
      pts.push(new Vector3(Math.cos(t) * HALF, PILLAR_H + 0.4 + Math.sin(t) * RISE, 0));
    }
    parts.push({ geo: new TubeGeometry(new CatmullRomCurve3(pts), 40, 0.42, 10, false), color: orange });
    // Unlit sign face: an orange frame around a dark panel.
    const faceParts: Part[] = [
      { geo: box(signW - 0.16, SIGN_H - 0.16, 0.02, 0), color: orange, at: [0, SIGN_Y, FACE_Z] },
      { geo: box(signW - 0.62, SIGN_H - 0.62, 0.02, 0), color: dark, at: [0, SIGN_Y, FACE_Z + 0.012] },
    ];
    return [paint(parts), paint(faceParts)];
  }, []);

  const textZ = FACE_Z + 0.05;
  return (
    <group ref={root} position={position}>
      <mesh geometry={lit} material={fade.lit} castShadow receiveShadow renderOrder={1} />
      <mesh geometry={face} material={fade.flat} renderOrder={1} />
      <NightGlow positions={GLOWS} radius={0.3} material={fade.glow} />
      <Label ref={fade.label[0]} font="display" size={1.8} color="#ffffff" position={[0, SIGN_Y + 0.42, textZ]} renderOrder={2}>
        {title}
      </Label>
      <Label ref={fade.label[1]} font="bodyBold" size={0.66} color={COLORS.amazon} position={[0, SIGN_Y - 0.95, textZ]} renderOrder={2}>
        {dates}
      </Label>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[1.05, PILLAR_H / 2, 1.05]} position={[s * HALF, PILLAR_H / 2, 0]} />
        ))}
        <CuboidCollider args={[HALF, SIGN_H / 2, 0.3]} position={[0, SIGN_Y, SIGN_Z]} />
      </RigidBody>
    </group>
  );
}
