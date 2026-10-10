import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CylinderGeometry } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import type { V3 } from './kit/frame.ts';
import { box, paint, paintMaterial } from './kit/paint.ts';

const W = 2.3;
const BODY_H = 1.9;
const D = 0.72;
const BASE_H = 0.3;
const CAP_Y = BASE_H + BODY_H;

// Indian highway milestone: white stone with a yellow cap, drawn at toy scale.
export function Milestone({ position, cap, place, year }: { position: V3; cap: string; place: string; year: string }) {
  const geometry = useMemo(() => {
    // Half cylinder, axis along Z, dome up: the yellow cap.
    const dome = new CylinderGeometry(W / 2, W / 2, D, 28, 1, false, -Math.PI / 2, Math.PI);
    return paint([
      { geo: box(W + 0.5, BASE_H, D + 0.5, 0.06), color: '#b9bcc6', at: [0, BASE_H / 2, 0] },
      { geo: box(W, BODY_H, D, 0.05), color: '#f7f5ee', at: [0, BASE_H + BODY_H / 2, 0] },
      { geo: dome, color: '#f2c230', at: [0, CAP_Y, 0], rot: [-Math.PI / 2, 0, 0] },
      { geo: box(W + 0.02, 0.1, D + 0.02, 0.02), color: '#e0ad1f', at: [0, CAP_Y + 0.02, 0] },
    ]);
  }, []);
  const z = D / 2 + 0.015;
  return (
    <group position={position}>
      <mesh geometry={geometry} material={paintMaterial} castShadow receiveShadow />
      <Label font="display" size={0.52} color={COLORS.ink} position={[0, CAP_Y + 0.45, z]}>
        {cap}
      </Label>
      <Label font="display" size={0.42} color={COLORS.ink} position={[0, BASE_H + 1.38, z]}>
        {place}
      </Label>
      <Label font="display" size={0.68} color={COLORS.ink} position={[0, BASE_H + 0.62, z]}>
        {year}
      </Label>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 0.25, 1.65, D / 2 + 0.25]} position={[0, 1.65, 0]} />
      </RigidBody>
    </group>
  );
}
