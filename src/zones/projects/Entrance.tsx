import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, ExtrudeGeometry, Shape } from 'three';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { ZONE } from './frame.ts';
import { mergeParts } from './geom.ts';
import { ENTRANCE } from './layout.ts';

// Where the road arrives: a garage-shaped sign beside the road, the zone name painted on the road
// and a pad for the projects panel.
const PAINT = '#f4eedf';
const SIGN = { x: -24.2, z: 6.6, w: 6.0, wall: 1.9, roof: 0.95, lift: 1.7 };

function garageShape(): Shape {
  const { w, wall, roof } = SIGN;
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, wall);
  s.lineTo(0, wall + roof);
  s.lineTo(-w / 2, wall);
  s.closePath();
  return s;
}

function GarageSign() {
  const postX = SIGN.w / 2 - 0.7;
  const board = useMemo(
    () =>
      mergeParts([
        { g: new BoxGeometry(0.28, SIGN.lift, 0.28), color: COLORS.inkSoft, at: [-postX, SIGN.lift / 2, -0.14] },
        { g: new BoxGeometry(0.28, SIGN.lift, 0.28), color: COLORS.inkSoft, at: [postX, SIGN.lift / 2, -0.14] },
        { g: new ExtrudeGeometry(garageShape(), { depth: 0.24, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }), color: ZONE.color, at: [0, SIGN.lift, -0.3] },
      ]),
    [postX],
  );
  const top = SIGN.lift + SIGN.wall;
  return (
    <group position={[SIGN.x, 0, SIGN.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.16, SIGN.lift / 2, 0.16]} position={[-postX, SIGN.lift / 2, -0.14]} />
        <CuboidCollider args={[0.16, SIGN.lift / 2, 0.16]} position={[postX, SIGN.lift / 2, -0.14]} />
        <CuboidCollider args={[SIGN.w / 2, SIGN.wall / 2, 0.16]} position={[0, SIGN.lift + SIGN.wall / 2, -0.14]} />
      </RigidBody>
      <mesh geometry={board} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.75} />
      </mesh>
      {/* a little roll-up door under the gable, for the garage look */}
      <mesh position={[0, top + SIGN.roof * 0.36, 0.005]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color={COLORS.paper} toneMapped={false} />
      </mesh>
      <Label font="display" size={0.78} color={COLORS.paper} position={[0, SIGN.lift + 1.22, 0.01]}>
        Projects garage
      </Label>
      <Label font="bodyBold" size={0.4} color={COLORS.paper} position={[0, SIGN.lift + 0.48, 0.01]} fillOpacity={0.9}>
        {ZONE.subtitle}
      </Label>
    </group>
  );
}

export function Entrance() {
  return (
    <group>
      <GarageSign />
      <Pad id="projects-entrance" label="See all projects" action={{ kind: 'panel', panel: 'projects' }} position={[ENTRANCE.x, 0, ENTRANCE.z]} icon="All projects" />
      <Label flat font="display" size={2.1} color={PAINT} anchorX="left" position={[-16.8, 0.03, -1.7]} fillOpacity={0.92}>
        {ZONE.title}
      </Label>
      <Label flat font="bodyBold" size={0.8} color={PAINT} anchorX="left" position={[-16.6, 0.03, 1.0]} fillOpacity={0.92}>
        {ZONE.subtitle}
      </Label>
    </group>
  );
}
