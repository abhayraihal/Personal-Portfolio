import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { useOcclusionFade } from './kit/fade.ts';
import type { V3 } from './kit/frame.ts';
import { box, paint, shade } from './kit/paint.ts';
import type { Part } from './kit/paint.ts';
import { NightGlow } from './NightGlow.tsx';

type Props = {
  position: V3; // road centre under the gantry, zone-local
  title: string;
  subtitle: string;
  color: string;
  half?: number; // pillar centre distance from the road centre
};

const PILLAR = 0.9;
const PILLAR_H = 7.4;
const SIGN_H = 2.7;
const SIGN_Y = 5.75; // sign centre; its bottom edge clears the road by 4.4 m
const SIGN_Z = 0.52;
const SIGN_D = 0.36;
const FACE_Z = SIGN_Z + SIGN_D / 2 + 0.01;
const STRIP_Y = SIGN_Y - SIGN_H / 2 + 0.62;
// Once the car has driven through, the gantry stays faint while it stands between the camera and
// the car, so it does not cover the pad and board just past it.
const BEYOND = { min: [-20, -5, -40] as V3, max: [20, 30, -1.3] as V3, opacity: 0.3 };

// Overhead sign gantry across the road: two pillars, a beam and a sign in the company colour.
export function Gantry({ position, title, subtitle, color, half = 6.4 }: Props) {
  const signW = half * 2 - PILLAR - 0.5;
  const root = useRef<Group>(null);
  const occluder = useMemo(() => ({ min: [-half - 0.3, SIGN_Y - SIGN_H / 2, -0.32] as V3, max: [half + 0.3, PILLAR_H, SIGN_Z + SIGN_D / 2] as V3 }), [half]);
  const fade = useOcclusionFade(root, occluder, 0.3, BEYOND);
  const glows = useMemo<V3[]>(() => [[-half, PILLAR_H + 0.42, 0], [half, PILLAR_H + 0.42, 0]], [half]);
  const [lit, face] = useMemo(() => {
    const dark = shade(color, -0.55);
    const white = '#f4f6fa';
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const x = s * half;
      parts.push(
        { geo: box(1.2, 0.5, 1.2, 0.08), color: shade(COLORS.rock, 0.35), at: [x, 0.25, 0] },
        { geo: box(PILLAR, PILLAR_H, PILLAR, 0.12), color: white, at: [x, PILLAR_H / 2, 0] },
        { geo: box(PILLAR + 0.08, 0.5, PILLAR + 0.08, 0.06), color, at: [x, 1.2, 0] },
        { geo: box(PILLAR + 0.08, 0.22, PILLAR + 0.08, 0.05), color, at: [x, 1.75, 0] },
        { geo: box(PILLAR + 0.16, 0.3, PILLAR + 0.16, 0.06), color: dark, at: [x, PILLAR_H + 0.1, 0] },
      );
    }
    parts.push(
      // Beam, with two hangers that hold the sign in front of it.
      { geo: box(half * 2 + 0.6, 0.62, 0.62, 0.1), color: dark, at: [0, PILLAR_H - 0.35, 0] },
      { geo: box(0.18, 0.5, 0.5), color: dark, at: [-signW * 0.3, SIGN_Y + SIGN_H / 2 + 0.05, 0.3] },
      { geo: box(0.18, 0.5, 0.5), color: dark, at: [signW * 0.3, SIGN_Y + SIGN_H / 2 + 0.05, 0.3] },
      { geo: box(signW, SIGN_H, SIGN_D, 0.14), color: dark, at: [0, SIGN_Y, SIGN_Z] },
    );
    // Sign face, unlit: the company colour with a white strip along the bottom for the dates.
    const faceParts: Part[] = [
      { geo: box(signW - 0.26, SIGN_H - 0.26, 0.02, 0), color, at: [0, SIGN_Y, FACE_Z] },
      { geo: box(signW - 0.7, 0.86, 0.02, 0), color: white, at: [0, STRIP_Y, FACE_Z + 0.012] },
    ];
    return [paint(parts), paint(faceParts)];
  }, [color, half, signW]);

  const textZ = FACE_Z + 0.04;
  return (
    <group ref={root} position={position}>
      <mesh geometry={lit} material={fade.lit} castShadow receiveShadow renderOrder={1} />
      <mesh geometry={face} material={fade.flat} renderOrder={1} />
      <NightGlow positions={glows} radius={0.26} material={fade.glow} />
      <Label ref={fade.label[0]} font="display" size={1.3} color="#ffffff" position={[0, SIGN_Y + 0.45, textZ]} renderOrder={2}>
        {title}
      </Label>
      <Label ref={fade.label[1]} size={0.54} color={COLORS.ink} position={[0, STRIP_Y, textZ]} maxWidth={signW - 0.8} renderOrder={2}>
        {subtitle}
      </Label>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.6, PILLAR_H / 2, 0.6]} position={[s * half, PILLAR_H / 2, 0]} />
        ))}
        <CuboidCollider args={[half + 0.3, 1.75, 0.55]} position={[0, SIGN_Y + 0.25, 0.25]} />
      </RigidBody>
    </group>
  );
}
