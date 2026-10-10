import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { ImagePlane } from '../../components/ImagePlane.tsx';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { profile } from '../../data/profile.ts';
import { hubAt, SPOT } from './layout.ts';
import { mergeParts } from './merge.ts';

export const wood = new MeshStandardMaterial({ color: '#9a6641', roughness: 0.9 });
const woodDark = new MeshStandardMaterial({ color: '#6e4429', roughness: 0.9 });
const mat = new MeshStandardMaterial({ color: COLORS.paper, roughness: 0.95 });

const PHOTO = 3.3; // the photo is square
const MARGIN = 0.22;
const CAPTION_H = 0.62;
const MAT_W = PHOTO + MARGIN * 2;
const MAT_H = PHOTO + MARGIN * 2 + CAPTION_H;
const FRAME = 0.2; // wooden border
const OUTER_W = MAT_W + FRAME * 2;
const OUTER_H = MAT_H + FRAME * 2;
const LIFT = 0.62; // bottom of the frame above the ground
const TILT = 0.24; // radians the easel leans back, so the photo faces the raised camera more squarely
const LEG_BELOW = LIFT / Math.cos(TILT) + 0.05; // leg length below the frame, down to the ground
const CAPTION = 'At IIT Mandi, Kamand valley';

// The back leg runs from a point behind the frame, 80% of the way up, to the ground 1.6 m behind.
const BACK_LEG = (() => {
  const y = OUTER_H * 0.8;
  const z = -0.2;
  const topY = LIFT + y * Math.cos(TILT) + z * Math.sin(TILT);
  const topZ = -y * Math.sin(TILT) + z * Math.cos(TILT);
  const footZ = -1.6;
  const length = Math.hypot(topY, topZ - footZ);
  return { y: topY / 2, z: (topZ + footZ) / 2, length, angle: Math.asin((topZ - footZ) / length) };
})();

function at(x: number, y: number, z: number, rx = 0, parent?: Matrix4) {
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, 0, 0)), new Vector3(1, 1, 1));
  return parent ? parent.clone().multiply(m) : m;
}

// The ledge, the two front legs (leaning back with the frame) and the back leg, as one mesh.
const TILTED = at(0, LIFT, 0, -TILT);
const EASEL = mergeParts([
  { geometry: new BoxGeometry(OUTER_W + 0.3, 0.12, 0.4), matrix: at(0, LIFT - 0.06, 0.1) },
  ...[-1, 1].map((s) => ({
    geometry: new BoxGeometry(0.16, OUTER_H + 0.35 + LEG_BELOW, 0.14),
    matrix: at(s * (OUTER_W / 2 - 0.5), (OUTER_H + 0.35 - LEG_BELOW) / 2, -0.2, 0, TILTED),
  })),
  { geometry: new BoxGeometry(0.14, BACK_LEG.length, 0.14), matrix: at(0, BACK_LEG.y, BACK_LEG.z, BACK_LEG.angle) },
]);

// Abhay's photo on an easel near the spawn, with a pad that opens the About panel.
export function PhotoBoard() {
  const [pu, pv] = SPOT.photo;
  const [qu, qv] = SPOT.photoPad;
  const cy = OUTER_H / 2;
  return (
    <>
      <group position={hubAt(pu, pv)}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[OUTER_W / 2, (LIFT + OUTER_H) / 2, 0.45]} position={[0, (LIFT + OUTER_H) / 2, -0.25]} />
          <CuboidCollider args={[0.12, BACK_LEG.length / 2, 0.12]} position={[0, BACK_LEG.y, BACK_LEG.z]} rotation={[BACK_LEG.angle, 0, 0]} />
        </RigidBody>
        <mesh geometry={EASEL} material={woodDark} castShadow receiveShadow />
        <group position={[0, LIFT, 0]} rotation={[-TILT, 0, 0]}>
          <group position={[0, cy, 0]}>
            <RoundedBox args={[OUTER_W, OUTER_H, 0.26]} radius={0.07} smoothness={2} material={wood} castShadow receiveShadow />
            <mesh material={mat} position={[0, 0, 0.135]} receiveShadow>
              <planeGeometry args={[MAT_W, MAT_H]} />
            </mesh>
            <ImagePlane url={profile.photo.src} width={PHOTO} height={PHOTO} position={[0, MAT_H / 2 - MARGIN - PHOTO / 2, 0.14]} />
            <Label font="display" size={0.27} color={COLORS.ink} position={[0, -MAT_H / 2 + CAPTION_H / 2 + 0.05, 0.145]} maxWidth={MAT_W - 0.1}>
              {CAPTION}
            </Label>
          </group>
        </group>
      </group>
      <Pad id="hub-about" label="Read about Abhay" icon="About" action={{ kind: 'panel', panel: 'about' }} position={hubAt(qu, qv)} radius={2.4} />
    </>
  );
}
