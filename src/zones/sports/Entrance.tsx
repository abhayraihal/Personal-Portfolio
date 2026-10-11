import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { PlaneGeometry } from 'three';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { box, cyl, flatMaterial, paint, paintMaterial } from '../career/kit/paint.ts';
import { bowlingBallGeometry, footballGeometry, tennisBallGeometry, volleyballGeometry } from './balls.ts';
import { Flags } from './Flags.tsx';
import type { FlagSpec } from './Flags.tsx';
import { ENTRANCE_PAD, ENTRANCE_SIGN } from './plan.ts';

const GREEN = ZONE_BY_ID.sports.color;
const DARK_GREEN = '#2f7d3a';

// The park gate sign at the end of the road: a wide board on two posts with four of the park's
// balls along its top, flagpoles either side, and the pad for the sports panel.
const W = 10.4;
const H = 2.5;
const LIFT = 1.9;
const D = 0.32;
const CY = LIFT + H / 2;
const TOP = LIFT + H;

const FLAGS: FlagSpec[] = [
  { at: [ENTRANCE_SIGN.x - W / 2 - 1.1, 0, ENTRANCE_SIGN.z - 0.3], height: 6.4, stripes: [GREEN, '#f4f4f0', '#2f6fd6'], width: 1.7, depth: 1.05 },
  { at: [ENTRANCE_SIGN.x + W / 2 + 1.1, 0, ENTRANCE_SIGN.z - 0.3], height: 6.4, stripes: ['#f2c230', '#f4f4f0', '#e2557f'], width: 1.7, depth: 1.05 },
];

function signGeometry() {
  const postX = W / 2 - 0.9;
  const frame = paint([
    { geo: box(0.34, LIFT + 0.2, 0.34, 0.05), color: DARK_GREEN, at: [-postX, (LIFT + 0.2) / 2, -0.04] },
    { geo: box(0.34, LIFT + 0.2, 0.34, 0.05), color: DARK_GREEN, at: [postX, (LIFT + 0.2) / 2, -0.04] },
    { geo: box(W, H, D, 0.12, 2), color: DARK_GREEN, at: [0, CY, 0] },
    // Cups for the balls along the top edge.
    ...[-3.3, -1.1, 1.1, 3.3].map((x) => ({ geo: cyl(0.3, 0.2, 0.16, 14), color: '#e9e6de', at: [x, TOP + 0.06, 0] as [number, number, number] })),
  ]);
  const face = paint([
    { geo: new PlaneGeometry(W - 0.32, H - 0.32), color: COLORS.paper, at: [0, CY, D / 2 + 0.004] },
    { geo: new PlaneGeometry(W - 0.32, 0.16), color: GREEN, at: [0, LIFT + 0.32, D / 2 + 0.008] },
  ]);
  return { frame, face };
}

export function Entrance() {
  const { frame, face } = useMemo(signGeometry, []);
  const balls = useMemo(() => [
    { geo: footballGeometry(0.46), x: -3.3, r: 0.46 },
    { geo: volleyballGeometry(0.44), x: -1.1, r: 0.44 },
    { geo: tennisBallGeometry(0.34), x: 1.1, r: 0.34 },
    { geo: bowlingBallGeometry(0.42), x: 3.3, r: 0.42 },
  ], []);
  const z = D / 2 + 0.014;
  return (
    <group>
      <group position={[ENTRANCE_SIGN.x, 0, ENTRANCE_SIGN.z]}>
        <mesh geometry={frame} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={face} material={flatMaterial} />
        {balls.map((b) => (
          <mesh key={b.x} geometry={b.geo} material={paintMaterial} position={[b.x, TOP + 0.1 + b.r, 0]} rotation={[0.4, b.x, 0.2]} castShadow />
        ))}
        <Label font="display" size={1.25} color={COLORS.ink} position={[0, CY + 0.32, z]}>
          Sports park
        </Label>
        <Label font="bodyBold" size={0.4} color={COLORS.inkSoft} position={[0, CY - 0.55, z]}>
          Nine sports, a gaming den and a keyboard
        </Label>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[W / 2, H / 2, D / 2 + 0.05]} position={[0, CY, 0]} />
          <CuboidCollider args={[0.2, LIFT / 2, 0.2]} position={[-(W / 2 - 0.9), LIFT / 2, -0.04]} />
          <CuboidCollider args={[0.2, LIFT / 2, 0.2]} position={[W / 2 - 0.9, LIFT / 2, -0.04]} />
        </RigidBody>
      </group>
      <Flags list={FLAGS} />
      <Pad id="sports-park" label="Read about sports" icon="Sports" action={{ kind: 'panel', panel: 'sports' }} position={[ENTRANCE_PAD.x, 0, ENTRANCE_PAD.z]} color={GREEN} />
    </group>
  );
}
