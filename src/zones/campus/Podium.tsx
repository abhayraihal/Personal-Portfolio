import { useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload, RapierRigidBody } from '@react-three/rapier';
import type { MeshStandardMaterial } from 'three';
import { Label } from '../../components/Label.tsx';
import { modelScale, useMerged } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { Resettable } from '../../components/Resettable.tsx';
import { COLORS } from '../../config/palette.ts';
import { car } from '../../state/car.ts';
import { playSound } from '../../state/events.ts';
import { mergeParts, roundedBox } from './boxes.ts';
import { Y } from './Ground.tsx';
import { PODIUM } from './layout.ts';

// Wording from panels.hackathons in profile.ts.
const PLACES = [
  { rank: '2', place: '2nd place', event: 'Frosthack 2022', h: 0.85, x: -1.55, cap: '#c9d2dc', metal: 'silver' as const },
  { rank: '1', place: '1st place', event: 'AI Innovation 3.0, IIT Mandi', h: 1.35, x: 1.55, cap: '#f2c230', metal: 'gold' as const },
];
const BLOCK = { w: 2.9, d: 2.5 };
const STAGE = { w: 7.6, d: 5.2, h: 0.16 };
const BLOCK_Z = -0.75; // blocks sit towards the back of the stage, labels in front
const TROPHY_S = 0.78;

// Gold keeps the kit palette with a little shine; silver is the same texture desaturated.
function useTrophyMaterials() {
  const { material } = useMerged('trophy-gold-cup');
  return useMemo(() => {
    const gold = material.clone() as MeshStandardMaterial;
    gold.roughness = 0.45;
    gold.metalness = 0.25;
    const silver = material.clone() as MeshStandardMaterial;
    silver.roughness = 0.4;
    silver.metalness = 0.25;
    silver.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = vec3(lum) * vec3(1.02, 1.08, 1.16) * 1.25;`,
      );
    };
    silver.customProgramCacheKey = () => 'campus-trophy-silver';
    return { gold, silver };
  }, [material]);
}

export function Podium() {
  const trophy = useMerged('trophy-gold-cup');
  const mats = useTrophyMaterials();
  const k = modelScale('trophy-gold-cup') * TROPHY_S;
  // Bodies are captured from their first contact (they spawn resting on the blocks), since
  // <Resettable> keeps its own ref.
  const trophies = useRef<(RapierRigidBody | null)[]>([null, null]);
  const lastBump = useRef(0);
  const geo = useMemo(() => mergeParts([
    { geo: roundedBox(STAGE.w, STAGE.h, STAGE.d, 0.05), color: '#d9cdb4', position: [0, STAGE.h / 2, 0] },
    ...PLACES.flatMap((p) => [
      { geo: roundedBox(BLOCK.w, p.h, BLOCK.d, 0.07), color: COLORS.paper, position: [p.x, STAGE.h + p.h / 2, BLOCK_Z] as [number, number, number] },
      { geo: roundedBox(BLOCK.w + 0.06, 0.16, BLOCK.d + 0.06, 0.05), color: p.cap, position: [p.x, STAGE.h + p.h - 0.06, BLOCK_Z] as [number, number, number] },
    ]),
  ]), []);

  const onBump = (e: CollisionEnterPayload) => {
    if (e.other.rigidBodyObject?.name !== 'car') return;
    const speed = Math.abs(car.speed);
    const now = performance.now();
    if (speed < 1.5 || now - lastBump.current < 400) return;
    lastBump.current = now;
    const hx = car.vx / (Math.hypot(car.vx, car.vz) || 1);
    const hz = car.vz / (Math.hypot(car.vx, car.vz) || 1);
    for (const b of trophies.current) {
      if (!b) continue;
      const m = b.mass();
      const up = Math.min(6.5, 1.2 + speed * 0.38);
      const push = Math.min(4, speed * 0.22);
      b.applyImpulse({ x: m * (hx * push + (Math.random() - 0.5)), y: m * up, z: m * (hz * push + (Math.random() - 0.5)) }, true);
      b.applyTorqueImpulse({ x: m * (Math.random() - 0.5) * 0.8, y: m * (Math.random() - 0.5) * 0.4, z: m * (Math.random() - 0.5) * 0.8 }, true);
    }
    playSound('thud', Math.min(1, speed / 12));
  };

  return (
    <group name="campus-podium" position={[PODIUM.x, 0, PODIUM.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[STAGE.w / 2, STAGE.h / 2, STAGE.d / 2]} position={[0, STAGE.h / 2, 0]} />
      </RigidBody>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      <RigidBody type="fixed" colliders={false} onCollisionEnter={onBump}>
        {PLACES.map((p) => (
          <CuboidCollider key={p.rank} args={[BLOCK.w / 2, p.h / 2, BLOCK.d / 2]} position={[p.x, STAGE.h + p.h / 2, BLOCK_Z]} />
        ))}
      </RigidBody>
      {PLACES.map((p, i) => (
        <group key={p.rank}>
          <Label font="display" size={p.h > 1 ? 1.0 : 0.72} color={COLORS.ink} position={[p.x, STAGE.h + p.h / 2 - 0.06, BLOCK_Z + BLOCK.d / 2 + 0.01]}>
            {p.rank}
          </Label>
          <Label flat font="bodyBold" size={0.5} color={COLORS.ink} position={[p.x, STAGE.h + 0.01, 1.25]}>
            {p.place}
          </Label>
          <Label flat size={0.38} maxWidth={2.9} textAlign="center" lineHeight={1.1} color={COLORS.inkSoft} anchorY="top" position={[p.x, STAGE.h + 0.01, 1.62]}>
            {p.event}
          </Label>
          <Resettable
            position={[p.x, STAGE.h + p.h + 0.02, BLOCK_Z]}
            rotation={[0, i === 0 ? 0.25 : -0.2, 0]}
            colliders="hull"
            density={9}
            linearDamping={0.2}
            angularDamping={0.4}
            onCollisionEnter={(e: CollisionEnterPayload) => {
              trophies.current[i] = e.target.rigidBody ?? trophies.current[i];
            }}
          >
            <mesh geometry={trophy.geometry} material={p.metal === 'gold' ? mats.gold : mats.silver} scale={k} castShadow receiveShadow />
          </Resettable>
        </group>
      ))}
      <Pad
        id="campus-hackathons"
        label="Read about the hackathons"
        action={{ kind: 'panel', panel: 'hackathons' }}
        position={[PODIUM.pad[0] - PODIUM.x, Y.pad, PODIUM.pad[1] - PODIUM.z]}
        radius={2.3}
        icon="Awards"
      />
    </group>
  );
}
