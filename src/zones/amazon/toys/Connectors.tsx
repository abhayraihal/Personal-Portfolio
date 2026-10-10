import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Group, Mesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { TOY_TEXT } from '../copy.ts';
import { M } from '../materials.ts';
import { Plaque, StationBoard } from '../parts.tsx';
import { easeInOutCubic, easeOutBack, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// Four connector gauges fill to 100% one after another in steps (a staged dial-up), each gets a
// "100%" tag, then the SOP book on the lectern opens.

const TUBE_X = [-3.15, -1.05, 1.05, 3.15];
const TUBE_Z = 0.05;
const BASE_H = 0.24;
const GLASS_H = 1.7;
const GLASS_R = 0.38;
const LIQUID_MAX = 1.62;
const T0 = 0.3;
const GAP = 1.55;
const FILL = 1.25;
const STEPS = 4;
const T_BOOK = T0 + 3 * GAP + FILL + 0.25;
const BOOK = { w: 0.86, h: 1.1, d: 0.16 };
const LECTERN = { x: 2.75, z: 2.2, tilt: -1.0 };

const LIQUID = new MeshStandardMaterial({ color: COLORS.amazon, emissive: '#ff7a00', emissiveIntensity: 0.35, roughness: 0.4 });
const TAG = new MeshStandardMaterial({ color: '#2e9e5b', roughness: 0.7 });
const COVER = new MeshStandardMaterial({ color: '#28406b', roughness: 0.75 });
const LAMP_OFF = new Color('#2f3a3a');
const LAMP_ON = new Color('#3ee07a');

// Staged rise: each quarter rises quickly and then holds, like a dial-up in steps.
function staged(k: number) {
  if (k >= 1) return 1;
  const step = Math.floor(k * STEPS);
  const frac = k * STEPS - step;
  return (step + easeInOutCubic(Math.min(1, frac * 1.8))) / STEPS;
}

type TubeProps = { x: number; label: string; lamp: MeshBasicMaterial; liquidRef: (el: Mesh | null) => void; tagRef: (el: Group | null) => void };

function Tube({ x, label, lamp, liquidRef, tagRef }: TubeProps) {
  const top = BASE_H + GLASS_H;
  return (
    <group position={[x, 0, TUBE_Z]}>
      <mesh position={[0, BASE_H / 2, 0]} material={M.slate} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.55, BASE_H, 20]} />
      </mesh>
      <mesh ref={liquidRef} position={[0, BASE_H, 0]} scale={[1, 0.0001, 1]} material={LIQUID} visible={false}>
        <cylinderGeometry args={[GLASS_R - 0.07, GLASS_R - 0.07, 1, 18]} />
      </mesh>
      <mesh position={[0, BASE_H + GLASS_H / 2, 0]} material={M.glass}>
        <cylinderGeometry args={[GLASS_R, GLASS_R, GLASS_H, 20, 1, true]} />
      </mesh>
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} position={[0.22, BASE_H + LIQUID_MAX * f, GLASS_R - 0.05]} material={M.white}>
          <boxGeometry args={[0.18, 0.03, 0.01]} />
        </mesh>
      ))}
      <mesh position={[0, top + 0.1, 0]} material={M.slate} castShadow>
        <cylinderGeometry args={[0.46, 0.46, 0.2, 20]} />
      </mesh>
      <mesh position={[0, top + 0.28, 0]} material={lamp}>
        <sphereGeometry args={[0.15, 14, 10]} />
      </mesh>
      <group ref={tagRef} position={[0, top - 0.26, GLASS_R + 0.1]} visible={false}>
        <Plaque text={TOY_TEXT.full} size={0.28} material={TAG} color="#ffffff" />
      </group>
      <Plaque text={label} size={0.26} position={[0, 0.34, 0.78]} legs={0.14} />
    </group>
  );
}

// Lectern with a book lying on its sloped top. The front cover hinges on the left edge and opens
// flat to the left, so the open book shows two pages.
function SopBook({ coverRef }: { coverRef: (el: Group | null) => void }) {
  return (
    <group position={[LECTERN.x, 0, LECTERN.z]}>
      <mesh position={[0, 0.28, -0.05]} material={M.slate} castShadow>
        <boxGeometry args={[0.32, 0.56, 0.32]} />
      </mesh>
      <group position={[0, 0.66, 0]} rotation={[LECTERN.tilt, 0, 0]}>
        <RoundedBox args={[2.0, 1.3, 0.08]} radius={0.03} smoothness={2} bevelSegments={1} position={[-0.43, 0, -0.04]} material={M.slate} castShadow />
        <group position={[0, 0, 0.02]}>
          <mesh position={[0, 0, BOOK.d / 2 - 0.02]} material={COVER} castShadow>
            <boxGeometry args={[BOOK.w, BOOK.h, 0.03]} />
          </mesh>
          <mesh position={[0.01, 0, BOOK.d / 2 + 0.04]} material={M.paper}>
            <boxGeometry args={[BOOK.w - 0.06, BOOK.h - 0.06, 0.09]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((r) => (
            <mesh key={r} position={[0.03, BOOK.h / 2 - 0.25 - r * 0.16, BOOK.d / 2 + 0.09]} material={M.stoneDark}>
              <boxGeometry args={[r === 4 ? 0.36 : 0.6, 0.04, 0.005]} />
            </mesh>
          ))}
          <group ref={coverRef} position={[-BOOK.w / 2, 0, BOOK.d / 2 + 0.1]}>
            <mesh position={[BOOK.w / 2, 0, 0]} material={COVER} castShadow>
              <boxGeometry args={[BOOK.w, BOOK.h, 0.03]} />
            </mesh>
            <mesh position={[BOOK.w / 2, BOOK.h / 2 - 0.22, 0.017]} material={M.orange}>
              <boxGeometry args={[BOOK.w - 0.18, 0.05, 0.005]} />
            </mesh>
            <Label font="display" size={0.38} color="#ffffff" position={[BOOK.w / 2, -0.04, 0.02]}>
              {TOY_TEXT.sop}
            </Label>
            {/* inside of the cover, seen once it is open */}
            <mesh position={[BOOK.w / 2, 0, -0.02]} material={M.paper}>
              <boxGeometry args={[BOOK.w - 0.06, BOOK.h - 0.06, 0.01]} />
            </mesh>
            {[0, 1, 2, 3].map((r) => (
              <mesh key={r} position={[BOOK.w / 2, BOOK.h / 2 - 0.25 - r * 0.16, -0.027]} material={M.stoneDark}>
                <boxGeometry args={[0.6, 0.04, 0.005]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

function ConnectorsToy({ clock }: ToyProps) {
  const liquids = useRef<(Mesh | null)[]>([]);
  const tags = useRef<(Group | null)[]>([]);
  const cover = useRef<Group | null>(null);
  const fired = useRef([false, false, false, false]);
  const lamps = useMemo(() => TUBE_X.map(() => new MeshBasicMaterial({ color: LAMP_OFF.clone(), toneMapped: false })), []);
  useEffect(() => () => lamps.forEach((m) => m.dispose()), [lamps]);

  useFrame((_, delta) => {
    const dt = frameDt(delta);
    clock.step(dt);
    const t = clock.time;
    const phase = clock.phase;
    const rw = phase === 'rewind' ? 1 - clock.r : 1;
    if (phase === 'idle') fired.current.fill(false);
    for (let i = 0; i < TUBE_X.length; i++) {
      const t0 = T0 + i * GAP;
      const level = phase === 'idle' ? 0 : staged(seg(t, t0, t0 + FILL)) * rw;
      const liq = liquids.current[i];
      if (liq) {
        liq.scale.y = Math.max(0.0001, level * LIQUID_MAX);
        liq.position.y = BASE_H + (level * LIQUID_MAX) / 2;
        liq.visible = level > 0.001;
      }
      const done = phase !== 'idle' && t >= t0 + FILL;
      lamps[i].color.copy(done ? LAMP_ON : LAMP_OFF);
      if (phase === 'rewind') lamps[i].color.lerp(LAMP_OFF, clock.r);
      const tag = tags.current[i];
      if (tag) {
        const s = phase === 'idle' ? 0 : easeOutBack(seg(t, t0 + FILL, t0 + FILL + 0.35)) * rw;
        tag.scale.setScalar(Math.max(0.0001, s));
        tag.visible = s > 0.001;
      }
      if (phase === 'play' && done && !fired.current[i]) {
        fired.current[i] = true;
        playSound('click', 0.6);
      }
    }
    const c = cover.current;
    if (c) {
      const k = phase === 'idle' ? 0 : easeInOutCubic(seg(t, T_BOOK, T_BOOK + 0.9)) * rw;
      c.rotation.y = -Math.PI * k;
    }
  });

  return (
    <>
      <StationBoard id="amazon-connectors" position={[0, 0, -2.45]} width={7.4} titleSize={0.52} />
      {TUBE_X.map((x, i) => (
        <Tube
          key={x}
          x={x}
          label={TOY_TEXT.connectors[i]}
          lamp={lamps[i]}
          liquidRef={(el) => {
            liquids.current[i] = el;
          }}
          tagRef={(el) => {
            tags.current[i] = el;
          }}
        />
      ))}
      <SopBook
        coverRef={(el) => {
          cover.current = el;
        }}
      />
    </>
  );
}

export const connectorsToy: ToySpec = { Component: ConnectorsToy, length: T_BOOK + 1.1 };
