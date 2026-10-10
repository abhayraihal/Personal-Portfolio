import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import type { IntersectionEnterHandler, IntersectionExitHandler, RapierRigidBody } from '@react-three/rapier';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { Label } from '../../components/Label.tsx';
import { Model, modelSize } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { panels } from '../../data/profile.ts';
import { car } from '../../state/car.ts';
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
const ISLAND_R = BED_R + 0.3; // collider round the dais and the flower bed
const _w = new Vector3();

// The plaza's respawn faces the island, so a car driven straight in meets it head-on. A flat-nosed
// car with grippy tyres turns into anything convex it hits head-on (a round island, slanted guides
// at 35 and 55 degrees: all tried, all pinned it until the vehicle's unstuck hop two seconds later).
// So once a car has pushed against the island with the throttle held for a moment, the island
// gives it a small hop sideways and turns it in the air, a third of the way from the island's edge
// to the way it was going, on the side it is already on (the right when dead centre): the throttle
// then carries it clear of the island and on up the plaza.
const ASIDE = { after: 0.3, hop: 2.6, slide: 1.5, turnRate: 6, maxSpin: 6, turnFor: 0.7, cooldown: 1.2 };

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
  const island = useRef<Group>(null);
  const hop = useRef(-1); // seconds since the last hop, -1 = none
  const spin = useRef(0);
  const touching = useRef(0); // car colliders inside the island's sensors
  const body = useRef<RapierRigidBody | null>(null);
  const press = useRef(0); // seconds pushed against the island; < 0 while cooling down
  const turn = useRef({ t: -1, yaw: 0, body: null as RapierRigidBody | null }); // t >= 0 while turning

  const onTouch: IntersectionEnterHandler = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'car') return;
    touching.current++;
    body.current = other.rigidBody ?? null;
  };
  const onLeave: IntersectionExitHandler = ({ other }) => {
    if (other.rigidBodyObject?.name === 'car') touching.current = Math.max(0, touching.current - 1);
  };

  // Hop the car sideways and aim it between the island's edge (perpendicular to the line from the
  // island centre) and its own heading, on the side of the island it is already on.
  const turnAside = (b: RapierRigidBody) => {
    island.current?.getWorldPosition(_w);
    const rx = Math.sin(car.yaw);
    const rz = Math.cos(car.yaw); // the car's right, in world space
    const dx = car.x - _w.x;
    const dz = car.z - _w.z;
    const lateral = -dx * rx - dz * rz; // > 0: island centre to the car's right
    const side = lateral > 0.2 ? -1 : 1; // +1: go right
    let tx = -dz;
    let tz = dx; // a tangent; flip it to the chosen side
    if ((tx * rx + tz * rz) * side < 0) {
      tx = -tx;
      tz = -tz;
    }
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const ax = 2 * tx + Math.cos(car.yaw);
    const az = 2 * tz - Math.sin(car.yaw); // plus half the car's heading
    b.setLinvel({ x: tx * ASIDE.slide, y: ASIDE.hop, z: tz * ASIDE.slide }, true);
    turn.current = { t: 0, yaw: Math.atan2(-az, ax), body: b };
    playSound('whoosh', 0.3);
  };

  useFrame((_, delta) => {
    const dt = frameDt(delta);
    const b = body.current;
    const pushing = touching.current > 0 && !!b && car.throttle > 0.5 && Math.abs(car.speed) < 1.5 && !car.recovering && !car.airborne;
    if (press.current < 0) press.current = Math.min(0, press.current + dt);
    else press.current = pushing ? press.current + dt : 0;
    if (b && press.current > ASIDE.after) {
      turnAside(b);
      press.current = -ASIDE.cooldown;
    }
    const tr = turn.current;
    if (tr.t >= 0 && tr.body) {
      tr.t += dt;
      const err = Math.atan2(Math.sin(tr.yaw - car.yaw), Math.cos(tr.yaw - car.yaw));
      const w = tr.body.angvel();
      const spinY = Math.max(-ASIDE.maxSpin, Math.min(ASIDE.maxSpin, err * ASIDE.turnRate));
      tr.body.setAngvel({ x: w.x, y: spinY, z: w.z }, true);
      if (tr.t > ASIDE.turnFor || Math.abs(err) < 0.06) {
        tr.body.setAngvel({ x: w.x, y: 0, z: w.z }, true);
        tr.t = -1;
      }
    }

    const g = cup.current;
    if (!g) return;
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
      <group ref={island} position={at(TROPHY.u, TROPHY.v)}>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[0.75, ISLAND_R]} position={[0, 0.75, 0]} />
          <CuboidCollider args={[2.55, 0.6, 0.36]} position={[0, 0.6, PLAQUE_Z]} />
          {/* Sensors a little larger than the colliders: a car in them is touching the island. */}
          <CylinderCollider sensor args={[0.8, ISLAND_R + 0.35]} position={[0, 0.8, 0]} onIntersectionEnter={onTouch} onIntersectionExit={onLeave} />
          <CuboidCollider sensor args={[2.9, 0.8, 0.75]} position={[0, 0.8, PLAQUE_Z]} onIntersectionEnter={onTouch} onIntersectionExit={onLeave} />
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
