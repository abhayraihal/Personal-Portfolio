import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Color, Matrix4 } from 'three';
import type { Group, InstancedMesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { car } from '../../../state/car.ts';
import { useStore } from '../../../state/store.ts';
import { carNearZone, carX, carZ } from '../frame.ts';

// Weather monitor toy: a mast with a cup anemometer and wind vane, a louvred instrument screen,
// and a board with the six cities the project polls. One city's light comes on at a time, in
// turn. The anemometer spins faster when the car drives past quickly.

// The six cities named in profile.ts (project-weather).
const CITIES = ['Delhi', 'Mumbai', 'Chennai', 'Bangalore', 'Kolkata', 'Hyderabad'];
const MAST_H = 4.3;
const BOARD = { x: -1.35, w: 3.3, h: 2.15, lift: 0.5 };
const ROWS = CITIES.map((c, i) => ({ c, x: i < 3 ? -1.45 : 0.02, y: 0.36 - (i % 3) * 0.44 }));
const _m = new Matrix4();
const LED_ON = new Color('#5ee07a');
const LED_OFF = new Color('#2c5a3a');

function Cup({ angle }: { angle: number }) {
  return (
    <group rotation={[0, angle, 0]}>
      <mesh position={[0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.56, 6]} />
        <meshStandardMaterial color={COLORS.inkSoft} roughness={0.5} />
      </mesh>
      <mesh position={[0.56, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <sphereGeometry args={[0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={COLORS.accent} roughness={0.6} side={2} />
      </mesh>
    </group>
  );
}

export function WeatherToy({ position }: { position: [number, number, number] }) {
  const spinner = useRef<Group>(null);
  const vane = useRef<Group>(null);
  const leds = useRef<InstancedMesh>(null);
  const st = useRef({ spin: 2, t: 0, lit: -1, ledT: 0 });

  useFrame((_, delta) => {
    if (!carNearZone()) return;
    const s = st.current;
    const dt = Math.min(delta, 0.1);
    s.t += dt;
    const reduced = useStore.getState().reducedMotion;
    const dx = carX() - (position[0] + 1.75);
    const dz = carZ() - (position[2] - 0.4);
    const near = Math.hypot(dx, dz) < 9;
    const gust = near ? Math.min(Math.abs(car.speed) * 0.6, 10) : 0;
    const goal = reduced ? 0.8 : 2 + gust;
    s.spin += (goal - s.spin) * Math.min(1, dt * (goal > s.spin ? 2.5 : 0.6));
    if (spinner.current) spinner.current.rotation.y += s.spin * dt;
    if (vane.current) vane.current.rotation.y = Math.sin(s.t * 0.3) * 0.6 + Math.sin(s.t * 1.1) * 0.12;

    s.ledT -= dt;
    const m = leds.current;
    if (m && s.ledT <= 0) {
      s.ledT = 0.7;
      s.lit = (s.lit + 1) % CITIES.length;
      for (let i = 0; i < CITIES.length; i++) m.setColorAt(i, i === s.lit ? LED_ON : LED_OFF);
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  const cy = BOARD.lift + BOARD.h / 2;
  useLayoutEffect(() => {
    const m = leds.current;
    if (!m) return;
    ROWS.forEach((r, i) => {
      m.setMatrixAt(i, _m.makeTranslation(r.x, r.y, 0.01));
      m.setColorAt(i, LED_OFF);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[BOARD.w / 2, BOARD.h / 2, 0.12]} position={[BOARD.x, cy, -0.1]} />
        <CuboidCollider args={[0.1, BOARD.lift / 2, 0.1]} position={[BOARD.x - 1.2, BOARD.lift / 2, -0.12]} />
        <CuboidCollider args={[0.1, BOARD.lift / 2, 0.1]} position={[BOARD.x + 1.2, BOARD.lift / 2, -0.12]} />
        <CuboidCollider args={[0.36, 0.85, 0.32]} position={[1.0, 0.85, 0.35]} />
        <CylinderCollider args={[MAST_H / 2, 0.12]} position={[1.75, MAST_H / 2, -0.4]} />
      </RigidBody>
      <mesh position={[-0.1, 0.07, 0]} receiveShadow castShadow>
        <boxGeometry args={[6.0, 0.14, 2.0]} />
        <meshStandardMaterial color="#cfc6b6" roughness={1} />
      </mesh>

      {/* city board */}
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[BOARD.x + x, cy / 2, -0.12]} castShadow>
          <boxGeometry args={[0.16, cy, 0.16]} />
          <meshStandardMaterial color={COLORS.inkSoft} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[BOARD.x, cy, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[BOARD.w, BOARD.h, 0.2]} />
        <meshStandardMaterial color={COLORS.ink} roughness={0.85} />
      </mesh>
      <group position={[BOARD.x, cy, 0.005]}>
        <Label font="bodyBold" size={0.25} color="#9fd3e6" anchorX="left" position={[-1.42, 0.8, 0]}>
          Every 5 minutes
        </Label>
        <instancedMesh ref={leds} args={[undefined, undefined, CITIES.length]} frustumCulled={false}>
          <circleGeometry args={[0.075, 14]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {ROWS.map((r) => (
          <Label key={r.c} font="bodyBold" size={0.26} color={COLORS.paper} anchorX="left" position={[r.x + 0.16, r.y, 0.01]}>
            {r.c}
          </Label>
        ))}
      </group>

      {/* louvred instrument screen on legs */}
      <group position={[1.0, 0, 0.35]}>
        {[[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.55, z]} castShadow>
            <boxGeometry args={[0.07, 1.1, 0.07]} />
            <meshStandardMaterial color="#e8e2d6" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 1.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.66, 0.66, 0.56]} />
          <meshStandardMaterial color="#fbfaf6" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.8, 0]} castShadow>
          <boxGeometry args={[0.78, 0.1, 0.68]} />
          <meshStandardMaterial color="#fbfaf6" roughness={0.7} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 1.2 + i * 0.13, 0.285]}>
            <boxGeometry args={[0.6, 0.035, 0.01]} />
            <meshStandardMaterial color="#c9c4b8" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* mast: solar panel, wind vane, anemometer */}
      <group position={[1.75, 0, -0.4]}>
        <mesh position={[0, MAST_H / 2, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, MAST_H, 10]} />
          <meshStandardMaterial color="#d9dde3" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 2.5, 0.32]} rotation={[-0.7, 0, 0]} castShadow>
          <boxGeometry args={[0.9, 0.6, 0.05]} />
          <meshStandardMaterial color="#2a3f7a" roughness={0.35} metalness={0.4} />
        </mesh>
        <group ref={vane} position={[0, 3.7, 0]}>
          <mesh position={[0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.08, 0.24, 8]} />
            <meshStandardMaterial color={COLORS.ink} roughness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.7, 0.03, 0.03]} />
            <meshStandardMaterial color={COLORS.ink} roughness={0.5} />
          </mesh>
          <mesh position={[-0.32, 0.06, 0]}>
            <boxGeometry args={[0.18, 0.2, 0.02]} />
            <meshStandardMaterial color={COLORS.ink} roughness={0.5} />
          </mesh>
        </group>
        <group ref={spinner} position={[0, MAST_H + 0.08, 0]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.07, 0.16, 10]} />
            <meshStandardMaterial color={COLORS.ink} roughness={0.5} />
          </mesh>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
            <Cup key={a} angle={a} />
          ))}
        </group>
      </group>
    </group>
  );
}
