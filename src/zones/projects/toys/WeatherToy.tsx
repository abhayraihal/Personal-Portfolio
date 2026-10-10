import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Matrix4, SphereGeometry } from 'three';
import type { Group, InstancedMesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { car } from '../../../state/car.ts';
import { useStore } from '../../../state/store.ts';
import { carNearZone, carX, carZ } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';

// Weather monitor toy: a mast with a cup anemometer and wind vane, a louvred instrument screen,
// and a board with the six cities the project polls. One city's light comes on at a time, in
// turn. The anemometer spins faster when the car drives past quickly. The board leans back 30
// degrees so it faces the camera almost head-on and the city names stay readable.

// The six cities named in profile.ts (project-weather).
const CITIES = ['Delhi', 'Mumbai', 'Chennai', 'Bangalore', 'Kolkata', 'Hyderabad'];
const MAST_H = 4.3;
const TILT = Math.PI / 6;
const BOARD = { x: -1.1, z: 0.15, w: 4.1, h: 2.4, lift: 0.55, t: 0.2 };
const CITY = 0.3;
const ROWS = CITIES.map((c, i) => ({ c, x: i < 3 ? -1.73 : 0.08, y: BOARD.h - 0.95 - (i % 3) * 0.5 }));
const _m = new Matrix4();
const LED_ON = new Color('#5ee07a');
const LED_OFF = new Color('#2c5a3a');

const MAST = { x: 2.3, z: -0.4 };
const SCREEN_AT = { x: 1.45, z: 0.35 };
// Board-frame point (y up the face from its bottom edge, z out of the face) in toy coordinates.
const boardY = (y: number, z: number) => BOARD.lift + y * Math.cos(TILT) + z * Math.sin(TILT);
const boardZ = (y: number, z: number) => BOARD.z - y * Math.sin(TILT) + z * Math.cos(TILT);
// The two legs meet the back of the board 60% of the way up.
const LEG = { y: boardY(BOARD.h * 0.6, -BOARD.t), z: boardZ(BOARD.h * 0.6, -BOARD.t) };

function weatherParts() {
  const legs: Part[] = [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]].map(([x, z]) => ({
    g: new BoxGeometry(0.07, 1.1, 0.07), color: '#e8e2d6', at: [SCREEN_AT.x + x, 0.55, SCREEN_AT.z + z],
  }));
  const louvres: Part[] = [0, 1, 2, 3].map((i) => ({
    g: new BoxGeometry(0.6, 0.035, 0.01), color: '#c9c4b8', at: [SCREEN_AT.x, 1.2 + i * 0.13, SCREEN_AT.z + 0.285],
  }));
  const cups: Part[] = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].flatMap((a) => [
    { g: new CylinderGeometry(0.025, 0.025, 0.56, 6).rotateZ(Math.PI / 2).translate(0.28, 0, 0), color: COLORS.inkSoft, rot: [0, a, 0] },
    { g: new SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0.56, 0, 0), color: COLORS.accent, rot: [0, a, 0] },
  ]);
  return {
    still: mergeParts([
      { g: new BoxGeometry(6.0, 0.14, 2.0), color: '#cfc6b6', at: [-0.25, 0.07, 0] },
      { g: new BoxGeometry(0.16, LEG.y, 0.16), color: COLORS.inkSoft, at: [BOARD.x - 1.5, LEG.y / 2, LEG.z] },
      { g: new BoxGeometry(0.16, LEG.y, 0.16), color: COLORS.inkSoft, at: [BOARD.x + 1.5, LEG.y / 2, LEG.z] },
      // short front feet, so the board does not look as if it floats over the base
      ...[-1.5, 1.5].map((x): Part => ({ g: new BoxGeometry(0.14, BOARD.lift, 0.14), color: COLORS.inkSoft, at: [BOARD.x + x, BOARD.lift / 2, BOARD.z - 0.12] })),
      { g: new BoxGeometry(BOARD.w, BOARD.h, BOARD.t), color: COLORS.ink, at: [BOARD.x, boardY(BOARD.h / 2, -BOARD.t / 2), boardZ(BOARD.h / 2, -BOARD.t / 2)], rot: [-TILT, 0, 0] },
      ...legs,
      { g: new BoxGeometry(0.66, 0.66, 0.56), color: '#fbfaf6', at: [SCREEN_AT.x, 1.42, SCREEN_AT.z] },
      { g: new BoxGeometry(0.78, 0.1, 0.68), color: '#fbfaf6', at: [SCREEN_AT.x, 1.8, SCREEN_AT.z] },
      ...louvres,
      { g: new CylinderGeometry(0.06, 0.08, MAST_H, 10), color: '#d9dde3', at: [MAST.x, MAST_H / 2, MAST.z] },
      { g: new BoxGeometry(0.9, 0.6, 0.05), color: '#2a3f7a', at: [MAST.x, 2.5, MAST.z + 0.32], rot: [-0.7, 0, 0] },
    ]),
    vane: mergeParts([
      { g: new ConeGeometry(0.08, 0.24, 8), color: COLORS.ink, at: [0.32, 0, 0], rot: [0, 0, -Math.PI / 2] },
      { g: new BoxGeometry(0.7, 0.03, 0.03), color: COLORS.ink },
      { g: new BoxGeometry(0.18, 0.2, 0.02), color: COLORS.ink, at: [-0.32, 0.06, 0] },
    ]),
    spinner: mergeParts([{ g: new CylinderGeometry(0.07, 0.07, 0.16, 10), color: COLORS.ink }, ...cups]),
  };
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
    const dx = carX() - (position[0] + MAST.x);
    const dz = carZ() - (position[2] + MAST.z);
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

  const parts = useMemo(weatherParts, []);
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
        <CuboidCollider args={[BOARD.w / 2, BOARD.h / 2, BOARD.t / 2]} position={[BOARD.x, boardY(BOARD.h / 2, -BOARD.t / 2), boardZ(BOARD.h / 2, -BOARD.t / 2)]} rotation={[-TILT, 0, 0]} />
        <CuboidCollider args={[0.1, LEG.y / 2, 0.1]} position={[BOARD.x - 1.5, LEG.y / 2, LEG.z]} />
        <CuboidCollider args={[0.1, LEG.y / 2, 0.1]} position={[BOARD.x + 1.5, LEG.y / 2, LEG.z]} />
        <CuboidCollider args={[0.36, 0.85, 0.32]} position={[SCREEN_AT.x, 0.85, SCREEN_AT.z]} />
        <CylinderCollider args={[MAST_H / 2, 0.12]} position={[MAST.x, MAST_H / 2, MAST.z]} />
      </RigidBody>
      <mesh geometry={parts.still} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.75} />
      </mesh>
      <group position={[BOARD.x, boardY(0, 0.005), boardZ(0, 0.005)]} rotation={[-TILT, 0, 0]}>
        <Label font="bodyBold" size={0.28} color="#9fd3e6" anchorX="left" position={[-1.81, BOARD.h - 0.38, 0]}>
          Every 5 minutes
        </Label>
        <instancedMesh ref={leds} args={[undefined, undefined, CITIES.length]} frustumCulled={false}>
          <circleGeometry args={[0.09, 14]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {ROWS.map((r) => (
          <Label key={r.c} font="bodyBold" size={CITY} color={COLORS.paper} anchorX="left" position={[r.x + 0.17, r.y, 0.01]}>
            {r.c}
          </Label>
        ))}
      </group>

      <group ref={vane} position={[MAST.x, 3.7, MAST.z]}>
        <mesh geometry={parts.vane}>
          <meshStandardMaterial vertexColors roughness={0.5} />
        </mesh>
      </group>
      <group ref={spinner} position={[MAST.x, MAST_H + 0.08, MAST.z]}>
        <mesh geometry={parts.spinner} castShadow>
          <meshStandardMaterial vertexColors roughness={0.6} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
