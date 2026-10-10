import { useEffect } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Label } from '../../components/Label.tsx';
import { Model, modelSize } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { jobs } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { FLOOR_Y } from './Floor.tsx';
import { MAIN_FRAME, MAIN_PAD, OFFICE, PAD_COLOR } from './layout.ts';
import { M } from './materials.ts';
import { frameCamera } from './Station.tsx';
import { at } from './shared.ts';

const [W, H, D] = modelSize('building-office', OFFICE.scale); // 16 x 11.3 x 7.2 m
const amazon = jobs.find((j) => j.company === 'Amazon')!;
const SUBTITLE = `${amazon.role} · ${amazon.place} · ${amazon.dates}`;
const CAM = 'amazon-cam-office';

// The office block at the back of the plaza: rooftop sign, a band over the entrance with the role,
// and the overview pad in front of the doors. The model's shop front is its -Z side, so it is
// turned around to face the camera.
export function Office() {
  useEffect(() => () => useStore.getState().clearCameraOverride(CAM), []);
  const front = D / 2;
  return (
    <>
      <group position={at(OFFICE.u, OFFICE.v)}>
        <Model name="building-office" scale={OFFICE.scale} rotation={[0, Math.PI, 0]} />
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[W / 2, H / 2, D / 2]} position={[0, H / 2, 0]} />
        </RigidBody>

        {/* Rooftop sign on two legs, set back from the parapet. */}
        <group position={[0, H - 0.25, front - 2.2]}>
          {[-3.8, 3.8].map((x) => (
            <mesh key={x} position={[x, 0.55, -0.15]} material={M.slate} castShadow>
              <boxGeometry args={[0.28, 1.1, 0.28]} />
            </mesh>
          ))}
          <RoundedBox args={[10.4, 2.7, 0.35]} radius={0.12} smoothness={2} bevelSegments={1} position={[0, 2.35, 0]} material={M.slate} castShadow />
          <mesh position={[0, 1.12, 0.18]} material={M.orange}>
            <boxGeometry args={[10.0, 0.16, 0.04]} />
          </mesh>
          <Label font="display" size={2.3} color={COLORS.amazon} position={[0, 2.42, 0.19]} letterSpacing={0.06}>
            AMAZON
          </Label>
        </group>

        {/* Role band over the entrance awning. */}
        <group position={[0, 4.55, front + 0.12]}>
          <RoundedBox args={[14.6, 0.95, 0.16]} radius={0.06} smoothness={2} bevelSegments={1} material={M.paper} castShadow />
          <mesh position={[0, -0.41, 0.085]} material={M.orange}>
            <boxGeometry args={[14.4, 0.1, 0.02]} />
          </mesh>
          <Label font="bodyBold" size={0.46} color={COLORS.ink} position={[0, 0.03, 0.09]}>
            {SUBTITLE}
          </Label>
        </group>
      </group>

      <Pad
        id="amazon-main"
        label="Amazon overview"
        action={{ kind: 'panel', panel: 'amazon' }}
        position={at(MAIN_PAD[0], MAIN_PAD[1], FLOOR_Y)}
        radius={2.4}
        color={PAD_COLOR}
        icon="Amazon"
        onEnter={() => frameCamera(CAM, MAIN_FRAME)}
        onLeave={() => frameCamera(CAM, null)}
      />
    </>
  );
}
