import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { Label } from '../../components/Label.tsx';
import { Model, modelSize } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { panels } from '../../data/profile.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { FLOOR_Y } from './Floor.tsx';
import { PAD_COLOR, TROPHY } from './layout.ts';
import { M } from './materials.ts';
import { Static } from './merge.tsx';
import { ModelInstances } from './Instances.tsx';
import type { Placement } from './Instances.tsx';
import { at, easeOutCubic, frameDt, seg } from './shared.ts';

const DAIS_R = 2.0;
const DAIS_H = 0.45;
const COLUMN_S = 1.15;
const COLUMN_H = modelSize('pedestal-column', COLUMN_S)[1]; // 2.6 m
const CUP_SCALE = 0.78; // 2 m wide gold cup
const CUP_Y = DAIS_H + COLUMN_H;
const BED_R = 2.6; // flower bed around the dais, open at the front for the plaque
const PLAQUE_Z = DAIS_R + 0.32;
const _w = new Vector3();

const BED: Placement[] = [];
for (let i = 0; i < 16; i++) {
  const a = (0.33 + (i / 15) * (2 - 0.66)) * Math.PI; // skips about 60 degrees at the front (+z)
  BED.push({ p: [Math.sin(a) * BED_R, 0.02, Math.cos(a) * BED_R], ry: i * 1.3, s: 0.85 + (i % 3) * 0.1 });
}
const BED_FLOWERS = BED.filter((_, i) => i % 2 === 0);
const BED_LEAVES = BED.filter((_, i) => i % 2 === 1);

// Hackathon award: gold cup on a stone column, on a round dais in the middle of the plaza. It turns
// slowly; parking on its pad makes it hop and spin, with confetti.
export function Trophy() {
  const cup = useRef<Group>(null);
  const hop = useRef(-1); // seconds since the last hop, -1 = none
  const spin = useRef(0);

  useFrame((_, delta) => {
    const g = cup.current;
    if (!g) return;
    const dt = frameDt(delta);
    const reduced = useStore.getState().reducedMotion;
    if (!reduced) spin.current += dt * 0.45;
    let y = 0;
    if (hop.current >= 0) {
      hop.current += dt;
      const k = seg(hop.current, 0, 1.1);
      y = Math.sin(Math.PI * k) * 0.9;
      spin.current += dt * Math.PI * 2.2 * (1 - easeOutCubic(k));
      if (k >= 1) hop.current = -1;
    }
    g.position.y = CUP_Y + y;
    g.rotation.y = spin.current;
  });

  const celebrate = () => {
    if (useStore.getState().reducedMotion) return;
    hop.current = 0;
    playSound('win');
    cup.current?.getWorldPosition(_w);
    events.emit('confetti', { x: _w.x, y: _w.y + 1.4, z: _w.z, colors: [COLORS.amazon, '#ffd166', '#ffffff', COLORS.accent], count: 70 });
  };

  return (
    <>
      <group position={at(TROPHY.u, TROPHY.v)}>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[0.75, BED_R + 0.3]} position={[0, 0.75, 0]} />
          <CuboidCollider args={[2.55, 0.6, 0.36]} position={[0, 0.6, PLAQUE_Z]} />
        </RigidBody>
        <Static>
          <mesh position={[0, DAIS_H / 2, 0]} material={M.stone} castShadow receiveShadow>
            <cylinderGeometry args={[DAIS_R - 0.12, DAIS_R, DAIS_H, 40]} />
          </mesh>
          <mesh position={[0, DAIS_H - 0.04, 0]} material={M.orange}>
            <cylinderGeometry args={[DAIS_R - 0.1, DAIS_R - 0.1, 0.1, 40]} />
          </mesh>
          <mesh position={[0, DAIS_H + 0.02, 0]} material={M.stoneDark} receiveShadow>
            <cylinderGeometry args={[DAIS_R - 0.3, DAIS_R - 0.3, 0.06, 40]} />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.soil} receiveShadow>
            <ringGeometry args={[BED_R - 0.42, BED_R + 0.42, 40, 1, 0.33 * Math.PI - Math.PI / 2, 1.34 * Math.PI]} />
          </mesh>
        </Static>
        <Model name="pedestal-column" scale={COLUMN_S} position={[0, DAIS_H, 0]} />
        <ModelInstances name="flowers-tall" items={BED_FLOWERS} />
        <ModelInstances name="plant-leafy" items={BED_LEAVES} />
        <group ref={cup} position={[0, CUP_Y, 0]}>
          <Model name="trophy-gold-cup" scale={CUP_SCALE} />
        </group>

        {/* Plaque leaning back towards the camera, in front of the dais. */}
        <group position={[0, 0, PLAQUE_Z]}>
          <Static>
            <mesh position={[0, 0.17, 0]} material={M.slate}>
              <boxGeometry args={[5.1, 0.34, 0.62]} />
            </mesh>
          </Static>
          <group position={[0, 0.76, -0.05]} rotation={[-0.75, 0, 0]}>
            <Static>
              <mesh material={M.paper}>
                <boxGeometry args={[4.9, 1.05, 0.1]} />
              </mesh>
            </Static>
            <Label font="bodyBold" size={0.36} color={COLORS.ink} position={[0, 0.2, 0.06]}>
              Most innovative idea
            </Label>
            <Label size={0.27} color={COLORS.inkSoft} position={[0, -0.22, 0.06]}>
              Amazon Payments GenAI Hackathon
            </Label>
          </group>
        </group>
      </group>
      <Pad
        id="amazon-genai-hackathon"
        label={panels['genai-hackathon'].title}
        action={{ kind: 'panel', panel: 'genai-hackathon' }}
        position={at(TROPHY.u, TROPHY.padV, FLOOR_Y)}
        radius={2.4}
        color={PAD_COLOR}
        icon="Award"
        onEnter={celebrate}
      />
    </>
  );
}
