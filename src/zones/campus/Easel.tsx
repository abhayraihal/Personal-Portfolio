import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CylinderGeometry, Quaternion, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ImagePlane } from '../../components/ImagePlane.tsx';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { profile } from '../../data/profile.ts';
import { mergeParts, roundedBox } from './boxes.ts';
import { EASEL } from './layout.ts';
import { NightWash } from './Night.tsx';

export const CAPTION = 'Kamand valley, Himachal Pradesh';

const _up = new Vector3(0, 1, 0);
const _d = new Vector3();
const _q = new Quaternion();

// A cylinder from a to b (used for easel legs and the bicycle frame).
export function rod(a: [number, number, number], b: [number, number, number], r: number, seg = 8): BufferGeometry {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  _d.subVectors(vb, va);
  const g = new CylinderGeometry(r, r, _d.length(), seg, 1);
  _q.setFromUnitVectors(_up, _d.normalize());
  g.applyQuaternion(_q);
  g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  return g;
}

const PHOTO = 3; // photo edge (m)
const BORDER = 0.18;
const STRIP = 0.95; // caption margin under the photo
const FRAME_W = PHOTO + BORDER * 2;
const FRAME_H = PHOTO + STRIP + BORDER * 2;
const FRAME_D = 0.09;
const TILT = -0.6; // leans back ~35 deg, so it faces the 45 deg camera almost square on and stays low
const LEG_R = 0.07;
const LEG_Z = -(FRAME_D / 2 + LEG_R + 0.03); // front legs run behind the frame, in its plane

// The frame's own space: origin at the middle of its bottom edge, +y up the frame, +z out of the
// photo. It rests on the shelf with its bottom edge 0.56 m up and 0.3 m in front of the easel origin.
const COS = Math.cos(TILT);
const SIN = Math.sin(TILT);
const BOTTOM: [number, number] = [0.56, 0.3]; // (y, z)
const onFrame = (x: number, y: number, z: number): [number, number, number] => [x, BOTTOM[0] + y * COS - z * SIN, BOTTOM[1] + y * SIN + z * COS];

export function Easel() {
  const geo = useMemo(() => {
    const footY = (LEG_Z * SIN - BOTTOM[0]) / COS; // frame-space y where a front leg meets the ground
    const topY = FRAME_H + 0.3;
    const backTop = onFrame(0, topY - 0.25, LEG_Z - 0.1);
    const legs = mergeGeometries([
      rod(onFrame(-1.3, footY, LEG_Z), onFrame(-0.32, topY, LEG_Z), LEG_R),
      rod(onFrame(1.3, footY, LEG_Z), onFrame(0.32, topY, LEG_Z), LEG_R),
      rod([0, 0, backTop[2] - 1.3], backTop, LEG_R),
    ]);
    return mergeParts([
      { geo: legs, color: '#a8744a' },
      // Shelf across the front legs that the frame stands on.
      { geo: roundedBox(FRAME_W + 0.2, 0.08, 0.3, 0.03), color: '#946038', position: onFrame(0, -0.04, -0.05), rotation: [TILT, 0, 0] },
      { geo: roundedBox(FRAME_W, FRAME_H, FRAME_D, 0.04), color: COLORS.paper, position: onFrame(0, FRAME_H / 2, 0), rotation: [TILT, 0, 0] },
    ]);
  }, []);
  return (
    <group position={[EASEL[0], 0, EASEL[1]]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[FRAME_W / 2, 1.4, 1.45]} position={[0, 1.4, -0.85]} />
      </RigidBody>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} />
      </mesh>
      <group position={onFrame(0, 0, 0)} rotation={[TILT, 0, 0]}>
        <NightWash width={FRAME_W - 0.1} height={FRAME_H - 0.1} position={[0, FRAME_H / 2, FRAME_D / 2 + 0.002]} />
        <ImagePlane url={profile.campusPhoto.src} width={PHOTO} height={PHOTO} position={[0, FRAME_H - BORDER - PHOTO / 2, FRAME_D / 2 + 0.005]} />
        <Label size={0.34} maxWidth={PHOTO - 0.1} textAlign="center" lineHeight={1.15} color={COLORS.ink} position={[0, BORDER + STRIP / 2 - 0.05, FRAME_D / 2 + 0.005]}>
          {CAPTION}
        </Label>
      </group>
    </group>
  );
}
