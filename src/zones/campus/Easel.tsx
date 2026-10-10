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

const PHOTO = 2.8; // photo edge (m)
const BORDER = 0.16;
const STRIP = 0.9; // caption margin under the photo
const TILT = -0.6; // leans back ~35 deg, so it faces the 45 deg camera almost square on and stays low
const LEDGE_Y = 0.5;

export function Easel() {
  const frameH = PHOTO + STRIP + BORDER * 2;
  const frameW = PHOTO + BORDER * 2;
  const geo = useMemo(() => {
    // Front legs follow the lean of the frame; the back leg props it up.
    const topY = LEDGE_Y + Math.cos(-TILT) * (frameH + 0.25);
    const topZ = 0.3 - Math.sin(-TILT) * (frameH + 0.25) - 0.08;
    const legs = mergeGeometries([
      rod([-1.25, 0, 0.75], [-0.3, topY, topZ], 0.07),
      rod([1.25, 0, 0.75], [0.3, topY, topZ], 0.07),
      rod([0, 0, topZ - 1.1], [0, topY - 0.15, topZ + 0.05], 0.07),
      rod([-1.75, LEDGE_Y, 0.36], [1.75, LEDGE_Y, 0.36], 0.06),
    ]);
    // Frame centre: half its height up the lean from where it rests on the ledge.
    const fy = LEDGE_Y + 0.06 + Math.cos(TILT) * (frameH / 2);
    const fz = 0.3 + Math.sin(TILT) * (frameH / 2);
    return mergeParts([
      { geo: legs, color: '#a8744a' },
      { geo: roundedBox(frameW, frameH, 0.09, 0.04), color: COLORS.paper, position: [0, fy, fz], rotation: [TILT, 0, 0] },
    ]);
  }, [frameH, frameW]);
  return (
    <group position={[EASEL[0], 0, EASEL[1]]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.6, 1.4, 1.3]} position={[0, 1.4, -0.7]} />
      </RigidBody>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} />
      </mesh>
      {/* Photo and caption on the frame, which rests on the ledge and leans back against the legs. */}
      <group position={[0, LEDGE_Y + 0.06, 0.3]} rotation={[TILT, 0, 0]}>
        <ImagePlane url={profile.photo.src} width={PHOTO} height={PHOTO} position={[0, frameH - BORDER - PHOTO / 2, 0.05]} />
        <Label size={0.34} maxWidth={frameW - 0.12} textAlign="center" lineHeight={1.15} color={COLORS.ink} position={[0, BORDER + STRIP / 2, 0.05]}>
          {CAPTION}
        </Label>
      </group>
    </group>
  );
}
