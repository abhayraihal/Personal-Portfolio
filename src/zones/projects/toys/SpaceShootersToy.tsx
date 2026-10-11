import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { InstancedMesh, Mesh, MeshStandardMaterial } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { useStore } from '../../../state/store.ts';
import { canvasTexture, makeCanvas } from '../canvas.ts';
import { carWithin, ZONE } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';
import { shootersSignal } from './signals.ts';
import { setLabelText } from './text.ts';
import type { TextMesh } from './text.ts';

// Space Shooters toy: the game screen as a diorama. Six blocky aliens sweep sideways in front of a
// starry backdrop; each one drops a row and turns back when it reaches an edge, as in the
// project's main.py. The ship at the bottom fires one laser bolt at a time, and a hit pops the
// alien and sends it back to the top. An alien that gets down to the ship's level ends the game,
// and the round starts again. Full speed while the car is parked on the Space Shooters pad, slow
// otherwise.

const W = 5.2; // backdrop width
const BASE_H = 0.42;
const BACK_H = 4.2;
const BACK_Z = -0.95; // backdrop centre
const FACE_Z = BACK_Z + 0.15; // its front face
const PLAY_Z = -0.25; // the aliens, ship and bolt move in this plane
const X_MAX = 2.08; // alien centres sweep between -X_MAX and X_MAX
const TOP_ROWS = [4.12, 3.72];
const STEP = 0.36; // drop at each edge
const SHIP_Y = 0.66; // ship base (it hovers over the plinth on its exhaust)
const LOSE_Y = 1.95; // an alien centre this low has reached the ship
const ALIEN_SPEED = 1.15; // m/s at full speed
const SHIP_SPEED = 2.8;
const BOLT_SPEED = 6.5;
const FIRE_GAP = 0.9; // s between shots at full speed
const IDLE = 0.3; // time scale while nobody is parked
const HIT = { x: 0.36, y: 0.3 }; // bolt-to-alien hit box (half sizes)
const BITS = 24; // burst cubes
const RANGE = 45; // m: the toy rests while the car is farther than this

type Alien = { x: number; y: number; dir: number; hidden: number; grow: number };
type Bit = { life: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number };

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _axis = new Vector3(0.3, 1, 0.5).normalize();
const _c = new Color();
const BIT_COLORS = ['#b45be0', '#f2c230', COLORS.accent].map((c) => new Color(c));

function alienGeometry() {
  const body = '#a24bd1';
  const dark = '#6d2a95';
  return mergeParts([
    { g: new BoxGeometry(0.62, 0.34, 0.3), color: body },
    { g: new BoxGeometry(0.44, 0.1, 0.26), color: body, at: [0, 0.21, 0] },
    { g: new BoxGeometry(0.26, 0.19, 0.04), color: '#f6e7a1', at: [0, 0.02, 0.16] },
    { g: new BoxGeometry(0.12, 0.12, 0.04), color: COLORS.ink, at: [0, 0.02, 0.185] },
    // antennae with tips, like the tentacles on the game's alien
    { g: new BoxGeometry(0.05, 0.17, 0.05), color: dark, at: [-0.14, 0.33, 0] },
    { g: new BoxGeometry(0.05, 0.17, 0.05), color: dark, at: [0.14, 0.33, 0] },
    { g: new BoxGeometry(0.1, 0.08, 0.08), color: COLORS.accent, at: [-0.14, 0.44, 0] },
    { g: new BoxGeometry(0.1, 0.08, 0.08), color: COLORS.accent, at: [0.14, 0.44, 0] },
    { g: new BoxGeometry(0.1, 0.12, 0.2), color: dark, at: [-0.22, -0.22, 0] },
    { g: new BoxGeometry(0.1, 0.12, 0.2), color: dark, at: [0, -0.22, 0] },
    { g: new BoxGeometry(0.1, 0.12, 0.2), color: dark, at: [0.22, -0.22, 0] },
  ]);
}

// Upright rocket, origin at its base.
function shipGeometry() {
  const red = '#d94141';
  return mergeParts([
    { g: new CylinderGeometry(0.15, 0.19, 0.55, 14), color: '#f4f1ea', at: [0, 0.38, 0] },
    { g: new ConeGeometry(0.15, 0.32, 14), color: red, at: [0, 0.81, 0] },
    { g: new CylinderGeometry(0.075, 0.075, 0.05, 14), color: '#5fb8e8', at: [0, 0.47, 0.16], rot: [Math.PI / 2, 0, 0] },
    { g: new BoxGeometry(0.12, 0.32, 0.1), color: red, at: [-0.2, 0.22, 0], rot: [0, 0, 0.35] },
    { g: new BoxGeometry(0.12, 0.32, 0.1), color: red, at: [0.2, 0.22, 0], rot: [0, 0, -0.35] },
    { g: new CylinderGeometry(0.11, 0.08, 0.1, 12), color: COLORS.inkSoft, at: [0, 0.07, 0] },
  ]);
}

// Plinth, backdrop body, frame and the two planets from the game's background.
function stageGeometry() {
  const parts: Part[] = [
    { g: new BoxGeometry(W + 0.6, BASE_H, 2.3), color: '#2b2560', at: [0, BASE_H / 2, -0.25] },
    { g: new BoxGeometry(W + 0.7, 0.07, 2.4), color: ZONE.color, at: [0, BASE_H - 0.02, -0.25] },
    { g: new BoxGeometry(W, BACK_H, 0.3), color: '#161c4f', at: [0, BASE_H + BACK_H / 2, BACK_Z] },
    { g: new BoxGeometry(0.34, BACK_H + 0.42, 0.5), color: ZONE.color, at: [-W / 2 - 0.17, BASE_H + (BACK_H + 0.42) / 2, BACK_Z + 0.05] },
    { g: new BoxGeometry(0.34, BACK_H + 0.42, 0.5), color: ZONE.color, at: [W / 2 + 0.17, BASE_H + (BACK_H + 0.42) / 2, BACK_Z + 0.05] },
    { g: new BoxGeometry(W + 0.68, 0.46, 0.56), color: ZONE.color, at: [0, BASE_H + BACK_H + 0.23, BACK_Z + 0.05] },
    { g: new SphereGeometry(0.34, 18, 12), color: '#d9508a', at: [1.62, 2.55, FACE_Z], scale: [1, 1, 0.4] },
    { g: new TorusGeometry(0.55, 0.05, 6, 30), color: '#f2c230', at: [1.62, 2.55, FACE_Z + 0.04], rot: [0.25, 0, 0.3], scale: [1, 0.32, 1] },
    { g: new SphereGeometry(0.27, 16, 10), color: '#c9ccd6', at: [-1.7, 3.25, FACE_Z], scale: [1, 1, 0.4] },
    { g: new SphereGeometry(0.07, 8, 6), color: '#9a9db0', at: [-1.78, 3.32, FACE_Z + 0.1] },
    { g: new SphereGeometry(0.05, 8, 6), color: '#9a9db0', at: [-1.6, 3.16, FACE_Z + 0.1] },
  ];
  return mergeParts(parts);
}

// Tiny stars scattered over the backdrop face (fixed seed, so every load looks the same).
function starGeometry() {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const parts: Part[] = [];
  for (let i = 0; i < 46; i++) {
    const s = 0.035 + rnd() * 0.05;
    parts.push({ g: new BoxGeometry(s, s, 0.01), color: rnd() < 0.2 ? '#ffe9a8' : '#ffffff', at: [(rnd() - 0.5) * (W - 0.2), BASE_H + 0.15 + rnd() * (BACK_H - 0.3), FACE_Z + 0.01] });
  }
  return mergeParts(parts);
}

// Deep blue to violet, like the game's space background.
function skyTexture() {
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#23206b');
  grad.addColorStop(0.6, '#1f2f86');
  grad.addColorStop(1, '#3a2a8c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return canvasTexture(c, 1);
}

function spawnAlien(a: Alien, i: number) {
  a.x = (Math.random() * 2 - 1) * X_MAX;
  a.y = TOP_ROWS[i % TOP_ROWS.length];
  a.dir = 1;
  a.hidden = 0;
  a.grow = 0;
}

export function SpaceShootersToy({ position }: { position: [number, number, number] }) {
  const aliens = useRef<InstancedMesh>(null);
  const bitsMesh = useRef<InstancedMesh>(null);
  const ship = useRef<Mesh>(null);
  const flame = useRef<Mesh>(null);
  const bolt = useRef<Mesh>(null);
  const face = useRef<MeshStandardMaterial>(null);
  const alienMat = useRef<MeshStandardMaterial>(null);
  const score = useRef<TextMesh>(null);
  const over = useRef<Mesh>(null);
  const scoreText = useRef('Score 0');
  const geo = useMemo(() => ({ alien: alienGeometry(), ship: shipGeometry(), stage: stageGeometry(), stars: starGeometry(), sky: skyTexture() }), []);
  const st = useMemo(() => {
    const list: Alien[] = Array.from({ length: 6 }, () => ({ x: 0, y: 0, dir: 1, hidden: 0, grow: 1 }));
    // a tidy formation to start from (and to hold with reduced motion)
    list.forEach((a, i) => {
      a.x = -X_MAX + (i % 3) * X_MAX + (i < 3 ? 0.3 : -0.3);
      a.y = TOP_ROWS[i < 3 ? 0 : 1];
    });
    return {
      aliens: list,
      bits: Array.from({ length: BITS }, (): Bit => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 })),
      shipX: 0,
      bolt: { on: false, x: 0, y: 0 },
      aimErr: 0,
      cool: 0,
      score: 0,
      over: 0,
      nextBit: 0,
      t: 0,
      glow: -1,
      started: false,
    };
  }, []);

  const writeAliens = () => {
    const m = aliens.current;
    if (!m) return;
    st.aliens.forEach((a, i) => {
      const k = a.hidden > 0 || st.over > 0 ? 0.0001 : 0.35 + 0.65 * a.grow;
      const bob = Math.sin(st.t * 3 + i) * 0.03;
      m.setMatrixAt(i, _m.compose(_p.set(a.x, a.y + bob, PLAY_Z), _q.identity(), _s.setScalar(k)));
    });
    m.instanceMatrix.needsUpdate = true;
  };

  const setScore = (n: number) => {
    st.score = n;
    setLabelText(score.current, scoreText, `Score ${n}`);
  };

  const burst = (x: number, y: number) => {
    if (useStore.getState().quality === 'low') return;
    for (let k = 0; k < 8; k++) {
      const b = st.bits[st.nextBit++ % BITS];
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 1.4 + Math.random() * 1.6;
      Object.assign(b, { life: 0.55, x, y, z: PLAY_Z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: (Math.random() - 0.2) * 1.2, spin: Math.random() * 6 });
      bitsMesh.current?.setColorAt((st.nextBit - 1) % BITS, BIT_COLORS[k % BIT_COLORS.length]);
    }
    const m = bitsMesh.current;
    if (m?.instanceColor) m.instanceColor.needsUpdate = true;
  };

  useLayoutEffect(() => {
    writeAliens();
    const m = bitsMesh.current;
    if (m) {
      for (let i = 0; i < BITS; i++) {
        m.setMatrixAt(i, _m.compose(_p.set(0, -5, 0), _q.identity(), _s.setScalar(0.0001)));
        m.setColorAt(i, _c.set(BIT_COLORS[0]));
      }
      m.instanceMatrix.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const store = useStore.getState();
    // the backdrop glows like a screen, more at night
    const glow = store.night ? 0.9 : 0.35;
    if (st.glow !== glow && face.current && alienMat.current) {
      st.glow = glow;
      face.current.emissiveIntensity = glow;
      alienMat.current.emissiveIntensity = store.night ? 0.35 : 0;
    }
    if (store.reducedMotion || !carWithin(position[0], position[2], RANGE)) return;
    const real = Math.min(delta, 0.05);
    const dt = real * (shootersSignal.parked ? 1 : IDLE);
    st.t += dt;

    if (!st.started) {
      st.started = true;
      st.aliens.forEach((a, i) => spawnAlien(a, i));
    }

    if (st.over > 0) {
      st.over -= real;
      if (over.current) over.current.visible = st.over > 0;
      if (st.over <= 0) {
        st.aliens.forEach((a, i) => spawnAlien(a, i));
        setScore(0);
      }
    } else {
      // aliens: each sweeps on its own and drops a row at the edges
      let lowest = -1;
      for (let i = 0; i < st.aliens.length; i++) {
        const a = st.aliens[i];
        if (a.hidden > 0) {
          a.hidden -= dt;
          if (a.hidden <= 0) spawnAlien(a, i);
          continue;
        }
        a.grow = Math.min(1, a.grow + dt * 4);
        a.x += a.dir * ALIEN_SPEED * dt;
        if (a.x > X_MAX || a.x < -X_MAX) {
          a.x = Math.max(-X_MAX, Math.min(X_MAX, a.x));
          a.dir = -a.dir;
          a.y -= STEP;
        }
        if (a.y < LOSE_Y) {
          st.over = 2.4;
          st.bolt.on = false;
          if (over.current) over.current.visible = true;
          break;
        }
        if (lowest < 0 || a.y < st.aliens[lowest].y) lowest = i;
      }

      // ship: lines up under the lowest alien, leading it, and fires when it is lined up
      if (lowest >= 0 && st.over <= 0) {
        const a = st.aliens[lowest];
        const flight = (a.y - (SHIP_Y + 1)) / BOLT_SPEED;
        let aim = a.x + a.dir * ALIEN_SPEED * flight;
        if (aim > X_MAX) aim = 2 * X_MAX - aim;
        if (aim < -X_MAX) aim = -2 * X_MAX - aim;
        aim += st.aimErr;
        const d = aim - st.shipX;
        st.shipX += Math.max(-SHIP_SPEED * dt, Math.min(SHIP_SPEED * dt, d));
        st.cool -= dt;
        if (!st.bolt.on && st.cool <= 0 && Math.abs(d) < 0.08) {
          st.bolt.on = true;
          st.cool = FIRE_GAP;
          st.bolt.x = st.shipX;
          st.bolt.y = SHIP_Y + 1.0;
          // now and then the next shot is a little off
          st.aimErr = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.3) : 0;
        }
      }

      if (st.bolt.on) {
        st.bolt.y += BOLT_SPEED * dt;
        for (let i = 0; i < st.aliens.length; i++) {
          const a = st.aliens[i];
          if (a.hidden > 0 || Math.abs(st.bolt.x - a.x) > HIT.x || Math.abs(st.bolt.y - a.y) > HIT.y) continue;
          st.bolt.on = false;
          a.hidden = 0.5;
          burst(a.x, a.y);
          setScore(st.score + 1);
          break;
        }
        if (st.bolt.y > BASE_H + BACK_H) st.bolt.on = false;
      }
    }

    writeAliens();
    if (ship.current) ship.current.position.x = st.shipX;
    if (flame.current) {
      flame.current.position.x = st.shipX;
      flame.current.scale.y = 0.8 + Math.sin(st.t * 40) * 0.2;
    }
    if (bolt.current) {
      bolt.current.visible = st.bolt.on;
      bolt.current.position.set(st.bolt.x, st.bolt.y, PLAY_Z);
    }
    const m = bitsMesh.current;
    if (m) {
      let any = false;
      for (let i = 0; i < BITS; i++) {
        const b = st.bits[i];
        if (b.life <= 0) continue;
        any = true;
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.vx *= 1 - 2 * dt;
        b.vy *= 1 - 2 * dt;
        const k = b.life > 0 ? Math.min(1, b.life / 0.3) : 0.0001;
        _q.setFromAxisAngle(_axis, b.spin * (0.55 - b.life) * 3);
        m.setMatrixAt(i, _m.compose(_p.set(b.x, b.y, b.z), _q, _s.setScalar(k)));
      }
      if (any) m.instanceMatrix.needsUpdate = true;
    }
  });

  const faceW = W - 0.04;
  const faceH = BACK_H - 0.04;
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 0.3, 0.6, 1.15]} position={[0, 0.6, -0.25]} />
        <CuboidCollider args={[W / 2 + 0.34, (BACK_H + BASE_H + 0.46) / 2, 0.28]} position={[0, (BACK_H + BASE_H + 0.46) / 2, BACK_Z + 0.05]} />
      </RigidBody>
      <mesh geometry={geo.stage} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <mesh position={[0, BASE_H + BACK_H / 2, FACE_Z + 0.002]} receiveShadow>
        <planeGeometry args={[faceW, faceH]} />
        <meshStandardMaterial ref={face} map={geo.sky} emissiveMap={geo.sky} emissive="#ffffff" emissiveIntensity={0.35} roughness={1} />
      </mesh>
      <mesh geometry={geo.stars}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <instancedMesh ref={aliens} args={[geo.alien, undefined, 6]} castShadow frustumCulled={false}>
        <meshStandardMaterial ref={alienMat} vertexColors roughness={0.55} emissive="#7a3aa8" emissiveIntensity={0} />
      </instancedMesh>
      <mesh ref={ship} geometry={geo.ship} position={[0, SHIP_Y, PLAY_Z]} castShadow>
        <meshStandardMaterial vertexColors roughness={0.5} />
      </mesh>
      <mesh ref={flame} position={[0, SHIP_Y - 0.1, PLAY_Z]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.09, 0.26, 10]} />
        <meshBasicMaterial color="#ffb347" toneMapped={false} />
      </mesh>
      <mesh ref={bolt} visible={false}>
        <capsuleGeometry args={[0.05, 0.28, 4, 8]} />
        <meshBasicMaterial color="#ff6fb1" toneMapped={false} />
      </mesh>
      <instancedMesh ref={bitsMesh} args={[undefined, undefined, BITS]} frustumCulled={false}>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <Label ref={score} font="bodyBold" size={0.3} color={COLORS.paper} anchorX="left" position={[-W / 2 + 0.05, BASE_H + BACK_H + 0.23, BACK_Z + 0.34]}>
        {scoreText.current}
      </Label>
      <mesh ref={over} visible={false} position={[0, 2.95, PLAY_Z + 0.3]}>
        <planeGeometry args={[3.3, 0.95]} />
        <meshBasicMaterial color={COLORS.ink} transparent opacity={0.82} depthWrite={false} toneMapped={false} />
        <Label font="display" size={0.62} color={COLORS.paper} position={[0, 0.02, 0.01]}>
          Game over
        </Label>
      </mesh>
    </group>
  );
}
