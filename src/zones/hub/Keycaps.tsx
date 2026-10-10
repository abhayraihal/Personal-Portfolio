import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, Matrix4, MeshStandardMaterial } from 'three';
import type { Group } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { useStore } from '../../state/store.ts';
import type { ControlName } from '../../vehicle/controls.ts';
import { hubAt, SPOT } from './layout.ts';
import { mergeParts } from './merge.ts';

// W A S D keycaps on the grass beside the painted controls. They press down while the key (or the
// touch stick in that direction) is held.
const KEYS: { label: string; control: ControlName; du: number; dv: number }[] = [
  { label: 'W', control: 'forward', du: 0, dv: 0 },
  { label: 'A', control: 'left', du: -1, dv: -1 },
  { label: 'S', control: 'backward', du: 0, dv: -1 },
  { label: 'D', control: 'right', du: 1, dv: -1 },
];
const PITCH = 1.2; // centre to centre
const SIZE = 1.02; // cap footprint
const CAP_H = 0.3;
const BASE_H = 0.08;
const TRAVEL = 0.17;

const up = new Color(COLORS.paper);
const down = new Color(COLORS.accent);
const baseMaterial = new MeshStandardMaterial({ color: COLORS.ink, roughness: 0.8 });
const [KU, KV] = SPOT.keycaps;
const keyAt = (key: (typeof KEYS)[number]) => hubAt(KU + key.du * PITCH, KV + key.dv * PITCH);
const CAP = new RoundedBoxGeometry(SIZE, CAP_H, SIZE, 2, 0.09);
const BASES = mergeParts(
  KEYS.map((key) => {
    const [x, , z] = keyAt(key);
    return { geometry: new BoxGeometry(SIZE + 0.12, BASE_H, SIZE + 0.12), matrix: new Matrix4().makeTranslation(x, BASE_H / 2, z) };
  }),
);

function touchHeld(control: ControlName, t: { throttle: number; steer: number }) {
  if (control === 'forward') return t.throttle > 0.2;
  if (control === 'backward') return t.throttle < -0.2;
  if (control === 'left') return t.steer > 0.2;
  return t.steer < -0.2;
}

export function Keycaps() {
  const [, getKeys] = useKeyboardControls<ControlName>();
  const caps = useRef<(Group | null)[]>([]);
  const press = useRef(KEYS.map(() => 0));
  const materials = useMemo(() => KEYS.map(() => new MeshStandardMaterial({ color: COLORS.paper, roughness: 0.6 })), []);

  useFrame((_, delta) => {
    const k = getKeys();
    const touch = useStore.getState().touch;
    const rate = 1 - Math.exp(-delta * 28);
    KEYS.forEach((key, i) => {
      const target = k[key.control] || touchHeld(key.control, touch) ? 1 : 0;
      const p = press.current[i] + (target - press.current[i]) * rate;
      press.current[i] = p;
      const cap = caps.current[i];
      if (cap) cap.position.y = BASE_H + CAP_H / 2 - p * TRAVEL;
      materials[i].color.lerpColors(up, down, p);
    });
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {KEYS.map((key) => (
          <CuboidCollider
            key={key.label}
            args={[SIZE / 2, (BASE_H + CAP_H) / 2, SIZE / 2]}
            position={[keyAt(key)[0], (BASE_H + CAP_H) / 2, keyAt(key)[2]]}
          />
        ))}
      </RigidBody>
      <mesh geometry={BASES} material={baseMaterial} receiveShadow />
      {KEYS.map((key, i) => (
        <group key={key.label} position={keyAt(key)}>
          <group
            ref={(el) => {
              caps.current[i] = el;
            }}
            position={[0, BASE_H + CAP_H / 2, 0]}
          >
            <mesh geometry={CAP} material={materials[i]} castShadow receiveShadow />
            <Label flat font="display" size={0.62} color={COLORS.ink} position={[0, CAP_H / 2 + 0.006, 0.02]}>
              {key.label}
            </Label>
          </group>
        </group>
      ))}
    </group>
  );
}
