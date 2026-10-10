import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { useStore } from '../../../state/store.ts';
import { carNearZone, carX, carZ } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';

// A cannon tower (the project's towers include a cannon). Its head turns to follow the player's
// car; when the car is close it recoils and puffs every couple of seconds.

const STONE = '#8c8fa3';
const STONE_DARK = '#6f7286';
const BASE_H = 1.5;
const RANGE = 24;
const CLOSE = 11;
const TURN_RATE = 2.4; // rad/s

function turretParts() {
  const merlons: Part[] = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return { g: new BoxGeometry(0.36, 0.36, 0.22), color: STONE, at: [Math.sin(a) * 1.0, BASE_H + 0.36, Math.cos(a) * 1.0], rot: [0, a, 0] };
  });
  return {
    base: mergeParts([
      { g: new CylinderGeometry(1.0, 1.15, BASE_H, 8), color: STONE, at: [0, BASE_H / 2, 0] },
      { g: new CylinderGeometry(1.22, 1.3, 0.36, 8), color: STONE_DARK, at: [0, 0.18, 0] },
      { g: new CylinderGeometry(1.15, 1.05, 0.18, 8), color: STONE_DARK, at: [0, BASE_H + 0.09, 0] },
      ...merlons,
    ]),
    head: mergeParts([
      { g: new CylinderGeometry(0.58, 0.66, 0.6, 16), color: COLORS.ink, at: [0, 0.34, 0] },
      { g: new SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), color: COLORS.accent, at: [0, 0.66, 0] },
    ]),
    barrel: mergeParts([
      { g: new CylinderGeometry(0.15, 0.2, 1.25, 12), color: COLORS.inkSoft, at: [0, 0, 0.6], rot: [Math.PI / 2, 0, 0] },
      { g: new TorusGeometry(0.17, 0.06, 8, 16), color: COLORS.ink, at: [0, 0, 1.22] },
    ]),
  };
}

export function TurretToy({ position }: { position: [number, number, number] }) {
  const parts = useMemo(turretParts, []);
  const head = useRef<Group>(null);
  const barrel = useRef<Group>(null);
  const puff = useRef<Mesh>(null);
  const st = useRef({ yaw: 0, idle: 0, fire: 2, recoil: 0, puff: -1 });

  useFrame((_, delta) => {
    if (!carNearZone() || !head.current) return;
    const s = st.current;
    const dt = Math.min(delta, 0.1);
    const dx = carX() - position[0];
    const dz = carZ() - position[2];
    const dist = Math.hypot(dx, dz);
    // head's +Z is the barrel direction; yaw about Y
    let goal: number;
    if (dist < RANGE) goal = Math.atan2(dx, dz);
    else {
      s.idle += dt;
      goal = Math.sin(s.idle * 0.4) * 1.2 + Math.PI;
    }
    let diff = goal - s.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    s.yaw += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
    head.current.rotation.y = s.yaw;

    const reduced = useStore.getState().reducedMotion;
    s.fire -= dt;
    if (!reduced && dist < CLOSE && Math.abs(diff) < 0.15 && s.fire <= 0) {
      s.fire = 2.2;
      s.recoil = 1;
      s.puff = 0;
    }
    s.recoil = Math.max(0, s.recoil - dt * 4);
    if (barrel.current) barrel.current.position.z = 0.25 - s.recoil * 0.22;
    const p = puff.current;
    if (p) {
      if (s.puff >= 0) {
        s.puff += dt;
        const k = s.puff / 0.6;
        p.visible = k < 1;
        p.scale.setScalar(0.3 + k * 1.1);
        p.position.z = 1.55 + k * 0.6;
        (p.material as MeshBasicMaterial).opacity = (1 - k) * 0.8;
        if (k >= 1) s.puff = -1;
      } else p.visible = false;
    }
  });

  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[BASE_H / 2 + 0.4, 1.15]} position={[0, BASE_H / 2 + 0.4, 0]} />
      </RigidBody>
      <mesh geometry={parts.base} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} flatShading />
      </mesh>
      {/* rotating head */}
      <group ref={head} position={[0, BASE_H + 0.18, 0]}>
        <mesh geometry={parts.head} castShadow>
          <meshStandardMaterial vertexColors roughness={0.55} />
        </mesh>
        <group ref={barrel} position={[0, 0.42, 0.25]}>
          <mesh geometry={parts.barrel} castShadow>
            <meshStandardMaterial vertexColors roughness={0.45} metalness={0.3} />
          </mesh>
        </group>
        <mesh ref={puff} visible={false} position={[0, 0.42, 1.6]}>
          <sphereGeometry args={[0.3, 12, 8]} />
          <meshBasicMaterial color="#f4f1ea" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <Label flat font="bodyBold" size={0.46} color={COLORS.inkSoft} position={[0, 0.03, 2.0]}>
        team project
      </Label>
    </group>
  );
}
