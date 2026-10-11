import { useMemo } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { CylinderGeometry, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { mergeParts } from './geom.ts';

// A street-name sign: a green blade with a white edge on a post, facing the camera.
const POST_H = 3.6;
const BLADE = { w: 2.7, h: 0.82, y: 3.15 };
const GREEN = '#2f7d4f';

let shared: ReturnType<typeof mergeParts> | null = null;
const signGeometry = () =>
  (shared ??= mergeParts([
    { g: new CylinderGeometry(0.07, 0.08, POST_H, 10), color: '#9aa0b1', at: [0, POST_H / 2, -0.12] },
    { g: new SphereGeometry(0.1, 10, 8), color: '#9aa0b1', at: [0, POST_H + 0.04, -0.12] },
    { g: new RoundedBoxGeometry(BLADE.w + 0.1, BLADE.h + 0.1, 0.06, 2, 0.05), color: '#f4f4f0', at: [0, BLADE.y, -0.04] },
    { g: new RoundedBoxGeometry(BLADE.w, BLADE.h, 0.08, 2, 0.04), color: GREEN, at: [0, BLADE.y, 0] },
  ]));

export function StreetSign({ position, text }: { position: [number, number, number]; text: string }) {
  const geometry = useMemo(signGeometry, []);
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[POST_H / 2, 0.12]} position={[0, POST_H / 2, -0.12]} />
      </RigidBody>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
      <Label font="display" size={0.6} color={COLORS.paper} position={[0, BLADE.y + 0.01, 0.05]}>
        {text}
      </Label>
    </group>
  );
}
