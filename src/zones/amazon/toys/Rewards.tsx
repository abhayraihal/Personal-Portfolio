import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, DoubleSide, Euler, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import type { BufferAttribute, Group, InstancedMesh, Mesh } from 'three';
import { Label } from '../../../components/Label.tsx';
import { modelScale, useMerged } from '../../../components/Model.tsx';
import { COLORS } from '../../../config/palette.ts';
import { playSound } from '../../../state/events.ts';
import { useStore } from '../../../state/store.ts';
import { BOARDS, TOY_TEXT } from '../copy.ts';
import { M } from '../materials.ts';
import { fixBounds, frameDt, seg } from '../shared.ts';
import type { ToyProps, ToySpec } from '../Station.tsx';

// Drive-in screen with the three launch countries' flags on top. Parking on the pad drops gold
// coins onto a chute that rolls them into the buy box.

const FRAME_W = 8.4;
const FRAME_H = 4.5;
const LEGS = 0.55;
const SCREEN_Z = -2.05;
const FACE_W = 8.0;
const FACE_H = 3.74;

const COINS = 10;
const COIN_S = 0.47; // 0.7 m coins
const COIN_R = 0.35;
const CHUTE = { x0: -3.2, y0: 1.6, x1: 2.15, y1: 1.0, z: 1.0 };
const SLOPE = (CHUTE.y1 - CHUTE.y0) / (CHUTE.x1 - CHUTE.x0);
const BOX = { x: 2.95, w: 1.6, h: 1.0, d: 1.2, z: 1.0 };
const SLOT_X = 2.85;
const DROP_Y = 8;
const G = 14;
const START = 0.3;
const GAP = 0.32;
const TB = 0.28; // bounce
const TR = 1.25; // roll
const TD = 0.32; // into the slot
const GLOW_IDLE = 0.18;
const GLOW_LIT = 0.75;

const surface = (x: number) => CHUTE.y0 + (x - CHUTE.x0) * SLOPE;

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();

type FlagKind = 'japan' | 'us' | 'brazil';

function drawFlag(kind: FlagKind) {
  const W = 192;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  if (kind === 'japan') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#bc002d';
    g.beginPath();
    g.arc(W / 2, H / 2, H * 0.3, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'us') {
    const sh = H / 13;
    for (let i = 0; i < 13; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#b22234';
      g.fillRect(0, i * sh, W, Math.ceil(sh));
    }
    const cw = W * 0.4;
    const ch = sh * 7;
    g.fillStyle = '#3c3b6e';
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#ffffff';
    for (let r = 0; r < 9; r++) {
      const n = r % 2 ? 5 : 6;
      for (let k = 0; k < n; k++) {
        const x = (cw / 12) * (1 + 2 * k + (r % 2));
        const y = (ch / 10) * (r + 1);
        g.beginPath();
        g.arc(x, y, 1.9, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else {
    g.fillStyle = '#009c3b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffdf00';
    g.beginPath();
    g.moveTo(W * 0.085, H / 2);
    g.lineTo(W / 2, H * 0.085);
    g.lineTo(W * 0.915, H / 2);
    g.lineTo(W / 2, H * 0.915);
    g.closePath();
    g.fill();
    g.fillStyle = '#002776';
    g.beginPath();
    g.arc(W / 2, H / 2, H * 0.25, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(W / 2 - 4, H * 0.95, H * 0.5, Math.PI * 1.32, Math.PI * 1.72);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Flag on a mast; the cloth ripples (vertex update on a 10 x 2 plane) unless motion is reduced.
function Flag({ kind, phase }: { kind: FlagKind; phase: number }) {
  const cloth = useRef<Mesh>(null);
  const { geometry, material, base } = useMemo(() => {
    const geo = new PlaneGeometry(1.05, 0.7, 10, 1);
    geo.translate(0.525, 0, 0);
    const mat = new MeshStandardMaterial({ map: drawFlag(kind), roughness: 0.9, side: DoubleSide });
    return { geometry: geo, material: mat, base: Float32Array.from(geo.attributes.position.array as Float32Array) };
  }, [kind]);
  useEffect(() => () => {
    geometry.dispose();
    material.map?.dispose();
    material.dispose();
  }, [geometry, material]);
  useFrame(({ clock }) => {
    if (useStore.getState().reducedMotion || !cloth.current) return;
    const pos = geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = clock.elapsedTime * 3.2 + phase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      arr[i * 3 + 2] = Math.sin(x * 5.5 - t) * 0.07 * (x / 1.05);
    }
    pos.needsUpdate = true;
  });
  return (
    <group>
      <mesh position={[0, 0.6, 0]} material={M.metal} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 1.2, 8]} />
      </mesh>
      <mesh position={[0, 1.24, 0]} material={M.orange}>
        <sphereGeometry args={[0.08, 10, 8]} />
      </mesh>
      <mesh ref={cloth} geometry={geometry} material={material} position={[0.04, 0.82, 0]} castShadow />
    </group>
  );
}

function Screen({ face }: { face: MeshStandardMaterial }) {
  const b = BOARDS['amazon-rewards'];
  const faceY = LEGS + 0.2 + FACE_H / 2;
  const top = LEGS + FRAME_H;
  return (
    <group position={[0, 0, SCREEN_Z]}>
      {[-3.1, 3.1].map((x) => (
        <mesh key={x} position={[x, LEGS / 2, -0.05]} material={M.slate} castShadow>
          <boxGeometry args={[0.36, LEGS, 0.36]} />
        </mesh>
      ))}
      <RoundedBox args={[FRAME_W, FRAME_H, 0.3]} radius={0.1} smoothness={2} bevelSegments={1} position={[0, LEGS + FRAME_H / 2, -0.12]} material={M.slate} castShadow receiveShadow />
      <mesh position={[0, faceY, 0.04]} material={face} receiveShadow>
        <boxGeometry args={[FACE_W, FACE_H, 0.04]} />
      </mesh>
      <mesh position={[0, faceY + FACE_H / 2 - 0.08, 0.065]} material={M.orange}>
        <boxGeometry args={[FACE_W - 0.2, 0.1, 0.01]} />
      </mesh>
      <Label font="display" size={0.56} color={COLORS.ink} position={[0, faceY + FACE_H / 2 - 0.3, 0.07]} anchorY="top">
        {b.title}
      </Label>
      {b.lines.map((line, i) => (
        <Label key={i} size={0.4} color={COLORS.inkSoft} position={[0, faceY + FACE_H / 2 - 1.18 - i * 0.58, 0.07]} anchorY="top">
          {line}
        </Label>
      ))}
      {TOY_TEXT.flags.map((name, i) => (
        <group key={name} position={[(i - 1) * 2.8, 0, 0]}>
          <Label font="bodyBold" size={0.3} color="#ffffff" position={[0, top - 0.27, 0.04]}>
            {name}
          </Label>
          <group position={[0, top, -0.12]}>
            <Flag kind={(['japan', 'us', 'brazil'] as const)[i]} phase={i * 1.3} />
          </group>
        </group>
      ))}
    </group>
  );
}

function Chute() {
  const len = Math.hypot(CHUTE.x1 - CHUTE.x0, CHUTE.y1 - CHUTE.y0);
  const ang = Math.atan2(CHUTE.y1 - CHUTE.y0, CHUTE.x1 - CHUTE.x0);
  const mx = (CHUTE.x0 + CHUTE.x1) / 2;
  const my = (CHUTE.y0 + CHUTE.y1) / 2;
  return (
    <group>
      <group position={[mx, my, CHUTE.z]} rotation={[0, 0, ang]}>
        <mesh position={[0, -0.06, 0]} material={M.metal} castShadow receiveShadow>
          <boxGeometry args={[len, 0.12, 0.8]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 0.1, s * 0.38]} material={M.orangeDeep} castShadow>
            <boxGeometry args={[len, 0.22, 0.06]} />
          </mesh>
        ))}
      </group>
      {[-2.6, 1.3].map((x) => (
        <mesh key={x} position={[x, surface(x) / 2 - 0.06, CHUTE.z]} material={M.slate} castShadow>
          <boxGeometry args={[0.16, surface(x) - 0.12, 0.16]} />
        </mesh>
      ))}
    </group>
  );
}

function RewardsToy({ clock }: ToyProps) {
  const { geometry: coinGeo0, material: coinMat } = useMerged('coin-gold');
  // Coin pivot at its centre so it can roll.
  const coinGeo = useMemo(() => {
    const g = coinGeo0.clone();
    g.translate(0, -0.2, 0);
    g.computeBoundingSphere();
    return g;
  }, [coinGeo0]);
  useEffect(() => () => coinGeo.dispose(), [coinGeo]);
  const coins = useRef<InstancedMesh>(null);
  const box = useRef<Group>(null);
  const quality = useStore((s) => s.quality);
  const count = quality === 'low' ? 6 : COINS;
  const plan = useMemo(() => Array.from({ length: COINS }, (_, i) => {
    const x0 = CHUTE.x0 + 0.45 + ((i * 7) % 5) * 0.1;
    const yLand = surface(x0) + COIN_R;
    const tf = Math.sqrt((2 * (DROP_Y - yLand)) / G);
    const t0 = START + i * GAP;
    return { t0, x0, yLand, tf, end: t0 + tf + TB + TR + TD, spin: (i % 2 ? 1 : -1) * (3 + (i % 3)) };
  }), []);
  const entered = useRef<boolean[]>(Array(COINS).fill(false));
  // The screen glows like a drive-in when the last coin is in the buy box.
  const face = useMemo(() => new MeshStandardMaterial({ color: COLORS.paper, emissive: '#fff1d6', emissiveIntensity: GLOW_IDLE, roughness: 0.9 }), []);
  useEffect(() => () => face.dispose(), [face]);
  const gulp = useRef(1);
  const scale = modelScale('coin-gold') * COIN_S;
  useLayoutEffect(() => fixBounds(coins.current, 9, 0, 4, CHUTE.z), []);

  useFrame((_, delta) => {
    const dt = frameDt(delta);
    clock.step(dt);
    const m = coins.current;
    if (!m) return;
    const t = clock.time;
    const active = clock.phase === 'play';
    m.visible = active;
    if (clock.phase === 'idle' || clock.phase === 'rewind') entered.current.fill(false);
    if (active) {
      for (let i = 0; i < count; i++) {
        const c = plan[i];
        const tau = t - c.t0;
        let x = c.x0;
        let y = DROP_Y;
        let roll = 0;
        let wob = 0;
        let s = scale;
        if (tau < 0) s = 0;
        else if (tau < c.tf) {
          y = DROP_Y - 0.5 * G * tau * tau;
          wob = Math.sin(tau * 9) * 0.35;
          roll = tau * c.spin;
        } else if (tau < c.tf + TB) {
          const k = (tau - c.tf) / TB;
          x = c.x0 + 0.15 * k;
          y = c.yLand + 0.3 * 4 * k * (1 - k);
          roll = c.tf * c.spin - k * 0.6;
        } else if (tau < c.tf + TB + TR) {
          const k = (tau - c.tf - TB) / TR;
          const xs = c.x0 + 0.15;
          x = xs + (CHUTE.x1 - xs) * (0.4 * k + 0.6 * k * k);
          y = surface(x) + COIN_R;
          roll = c.tf * c.spin - 0.6 - (x - xs) / COIN_R;
        } else if (tau < c.tf + TB + TR + TD) {
          const k = (tau - c.tf - TB - TR) / TD;
          if (!entered.current[i]) {
            entered.current[i] = true;
            gulp.current = 0;
            playSound('coin', 0.5);
          }
          x = CHUTE.x1 + (SLOT_X - CHUTE.x1) * Math.min(1, k * 1.6);
          y = BOX.h + COIN_R - (BOX.h + COIN_R - 0.15) * k * k;
          roll = c.tf * c.spin - 0.6 - (CHUTE.x1 - c.x0 - 0.15) / COIN_R - k * 2;
        } else s = 0;
        _p.set(x, y, CHUTE.z);
        _q.setFromEuler(_e.set(0, wob, roll));
        _s.setScalar(s);
        m.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      for (let i = count; i < COINS; i++) m.setMatrixAt(i, _m.makeScale(0, 0, 0));
      m.instanceMatrix.needsUpdate = true;
    }
    const lit = clock.phase === 'idle' ? 0 : seg(t, plan[count - 1].end, plan[count - 1].end + 0.5) * (clock.phase === 'rewind' ? 1 - clock.r : 1);
    const flicker = lit > 0 && lit < 1 ? 0.6 + 0.4 * Math.sin(t * 70) : 1;
    face.emissiveIntensity = GLOW_IDLE + (GLOW_LIT - GLOW_IDLE) * lit * flicker;
    const g = box.current;
    if (g) {
      gulp.current = Math.min(1, gulp.current + dt / 0.2);
      const k = Math.sin(Math.PI * gulp.current);
      g.scale.set(1 + 0.04 * k, 1 - 0.07 * k, 1 + 0.04 * k);
    }
  });

  return (
    <>
      <Screen face={face} />
      <Chute />
      <group ref={box} position={[BOX.x, 0, BOX.z]}>
        <RoundedBox args={[BOX.w, BOX.h, BOX.d]} radius={0.08} smoothness={2} bevelSegments={1} position={[0, BOX.h / 2, 0]} material={M.orange} castShadow receiveShadow />
        <mesh position={[SLOT_X - BOX.x, BOX.h + 0.005, 0]} material={M.ink}>
          <boxGeometry args={[0.9, 0.02, 0.42]} />
        </mesh>
        <Label font="bodyBold" size={0.32} color="#ffffff" position={[0, BOX.h * 0.5, BOX.d / 2 + 0.01]}>
          {TOY_TEXT.buyBox}
        </Label>
      </group>
      <instancedMesh ref={coins} args={[coinGeo, coinMat, COINS]} castShadow visible={false} />
    </>
  );
}

// Coins finish at START + 9 * GAP + fall + bounce + roll + slot, about 6 s.
export const rewardsToy: ToySpec = { Component: RewardsToy, length: 6.9 };
