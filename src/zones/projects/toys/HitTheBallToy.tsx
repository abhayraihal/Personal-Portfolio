import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import type { Group, InstancedMesh, Mesh, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { useStore } from '../../../state/store.ts';
import { carWithin, ZONE } from '../frame.ts';
import { mergeParts } from '../geom.ts';
import { ballSignal } from './signals.ts';
import { setLabelText } from './text.ts';
import type { TextMesh } from './text.ts';

// Hit the Ball toy: the game as a tabletop box tilted towards the camera. The ball bounces off
// three walls and the paddle along the open side tracks it; every paddle hit adds a point. Now and
// then the paddle misses on purpose: the ball rolls off the edge and one of the five life balls on
// the scoreboard drops. After the fifth miss the board shows Game over and Retry, then the round
// restarts with five lives and a score of 0, as in the project's main.py. Full speed while the car
// is parked on the Hit the Ball pad, slow otherwise.

const TILT = (24 * Math.PI) / 180;
const PIVOT_Y = 1.15; // tray centre height
const IN_U = 2.05; // inner half width
const IN_W = 1.5; // inner half depth; +w is the open side (towards the camera)
const BALL_R = 0.17;
const PADDLE = { w: 1.05, d: 0.22, at: 1.22 }; // width, depth, w of its centre
const SPEED = 2.6; // ball speed at full play
const PADDLE_SPEED = 3.2;
const IDLE = 0.35; // time scale while nobody is parked
const LIVES = 5;
const BOARD = { y: 2.55, z: -1.9, w: 4.5, h: 1.0 };
const LIFE_X = (i: number) => 0.25 + i * 0.42;
const OVER_Y = BOARD.y + BOARD.h + 0.85; // the Game over sign stands on the scoreboard
const RANGE = 45;
const G = 9.8;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

// Stand, tray floor and its three walls (tray-local, origin on the floor centre).
function trayGeometry() {
  const wallH = 0.32;
  const t = 0.22;
  const wall = ZONE.color;
  return mergeParts([
    { g: new BoxGeometry(IN_U * 2 + t * 2, 0.24, IN_W * 2 + t), color: '#2d2a3a', at: [0, -0.12, -t / 2] },
    { g: new BoxGeometry(IN_U * 2, 0.01, IN_W * 2), color: '#17181d', at: [0, 0.005, 0] },
    { g: new BoxGeometry(t, wallH, IN_W * 2 + t), color: wall, at: [-IN_U - t / 2, wallH / 2, -t / 2] },
    { g: new BoxGeometry(t, wallH, IN_W * 2 + t), color: wall, at: [IN_U + t / 2, wallH / 2, -t / 2] },
    { g: new BoxGeometry(IN_U * 2 + t * 2, wallH, t), color: wall, at: [0, wallH / 2, -IN_W - t / 2] },
    // white caps on the walls
    { g: new BoxGeometry(t + 0.02, 0.05, IN_W * 2 + t), color: COLORS.paper, at: [-IN_U - t / 2, wallH + 0.02, -t / 2] },
    { g: new BoxGeometry(t + 0.02, 0.05, IN_W * 2 + t), color: COLORS.paper, at: [IN_U + t / 2, wallH + 0.02, -t / 2] },
    { g: new BoxGeometry(IN_U * 2 + t * 2, 0.05, t + 0.02), color: COLORS.paper, at: [0, wallH + 0.02, -IN_W - t / 2] },
  ]);
}

// Legs, the scoreboard and its life-ball ledge (toy-local).
function standGeometry() {
  const near = PIVOT_Y - IN_W * Math.sin(TILT); // height of the open edge
  const far = PIVOT_Y + IN_W * Math.sin(TILT);
  const zNear = IN_W * Math.cos(TILT) - 0.2;
  const zFar = -IN_W * Math.cos(TILT) + 0.1;
  const legs = [
    [-IN_U, zNear, near], [IN_U, zNear, near], [-IN_U, zFar, far], [IN_U, zFar, far],
  ].map(([x, z, h]) => ({ g: new BoxGeometry(0.2, h - 0.12, 0.2), color: COLORS.inkSoft, at: [x, (h - 0.12) / 2, z] as [number, number, number] }));
  return mergeParts([
    ...legs,
    { g: new BoxGeometry(0.2, BOARD.y, 0.2), color: COLORS.inkSoft, at: [-BOARD.w / 2 + 0.3, BOARD.y / 2, BOARD.z - 0.12] },
    { g: new BoxGeometry(0.2, BOARD.y, 0.2), color: COLORS.inkSoft, at: [BOARD.w / 2 - 0.3, BOARD.y / 2, BOARD.z - 0.12] },
    { g: new RoundedBoxGeometry(BOARD.w, BOARD.h, 0.2, 2, 0.06), color: COLORS.ink, at: [0, BOARD.y + BOARD.h / 2, BOARD.z] },
    { g: new BoxGeometry(BOARD.w - 0.1, 0.08, 0.06), color: ZONE.color, at: [0, BOARD.y + BOARD.h - 0.04, BOARD.z + 0.1] },
    { g: new BoxGeometry(2.3, 0.07, 0.22), color: COLORS.inkSoft, at: [1.1, BOARD.y + 0.2, BOARD.z + 0.18] },
  ]);
}

type Phase = 'play' | 'fall' | 'wait' | 'over';

export function HitTheBallToy({ position }: { position: [number, number, number] }) {
  const tray = useRef<Group>(null);
  const ball = useRef<Mesh>(null);
  const loose = useRef<Mesh>(null);
  const paddle = useRef<Mesh>(null);
  const lives = useRef<InstancedMesh>(null);
  const score = useRef<TextMesh>(null);
  const overSign = useRef<Group>(null);
  const retry = useRef<Mesh>(null);
  const glowMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const scoreText = useRef('Score 0');
  const geo = useMemo(
    () => ({
      tray: trayGeometry(),
      stand: standGeometry(),
      paddle: new RoundedBoxGeometry(PADDLE.w, 0.2, PADDLE.d, 2, 0.08),
      sign: mergeParts([
        { g: new RoundedBoxGeometry(3.3, 1.4, 0.14, 2, 0.08), color: '#101114' },
        { g: new BoxGeometry(0.12, 0.5, 0.1), color: COLORS.inkSoft, at: [-1.2, -0.9, -0.02] },
        { g: new BoxGeometry(0.12, 0.5, 0.1), color: COLORS.inkSoft, at: [1.2, -0.9, -0.02] },
      ]),
      button: new RoundedBoxGeometry(1.5, 0.5, 0.16, 2, 0.08),
    }),
    [],
  );
  const st = useMemo(
    () => ({
      phase: 'play' as Phase,
      u: -IN_U + BALL_R + 0.1, w: -IN_W + BALL_R + 0.1, vu: SPEED * Math.SQRT1_2, vw: SPEED * Math.SQRT1_2,
      pu: 0, kick: 0,
      hits: 0, missAt: 4, missing: false,
      left: LIVES, score: 0, timer: 0,
      fx: 0, fy: 0, fz: 0, fvx: 0, fvy: 0, fvz: 0, // the ball once it has rolled off
      drop: -1, dropT: 0, // life ball falling off the ledge
      glow: -1,
    }),
    [],
  );

  const setScore = (n: number) => {
    st.score = n;
    setLabelText(score.current, scoreText, `Score ${n}`);
  };

  // Life balls on the ledge; the one at `st.drop` falls for `st.dropT` seconds.
  const writeLives = () => {
    const m = lives.current;
    if (!m) return;
    for (let i = 0; i < LIVES; i++) {
      let y = BOARD.y + 0.2 + 0.035 + 0.15;
      let x = LIFE_X(i);
      let k = i < st.left ? 1 : 0.0001;
      if (i === st.drop) {
        const t = st.dropT;
        x += t * 0.9;
        y -= 0.5 * G * t * t;
        k = Math.max(0.0001, 1 - t * 1.4);
      }
      m.setMatrixAt(i, _m.compose(_p.set(x, y, BOARD.z + 0.2), _q.identity(), _s.setScalar(k)));
    }
    m.instanceMatrix.needsUpdate = true;
  };

  const serve = () => {
    // from the far left corner, heading diagonally towards the paddle, as the game starts its ball
    st.u = -IN_U + BALL_R + 0.1;
    st.w = -IN_W + BALL_R + 0.1;
    st.vu = SPEED * Math.SQRT1_2;
    st.vw = SPEED * Math.SQRT1_2;
    st.phase = 'play';
    st.missing = false;
    if (ball.current) ball.current.visible = true;
  };

  useLayoutEffect(() => {
    writeLives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const store = useStore.getState();
    const glow = store.night ? 0.7 : 0.12;
    if (st.glow !== glow) {
      st.glow = glow;
      for (const m of glowMats.current) if (m) m.emissiveIntensity = glow;
    }
    if (store.reducedMotion || !carWithin(position[0], position[2], RANGE)) return;
    const real = Math.min(delta, 0.05);
    const dt = real * (ballSignal.parked ? 1 : IDLE);

    if (st.phase === 'play') {
      st.u += st.vu * dt;
      st.w += st.vw * dt;
      if (st.u < -IN_U + BALL_R) {
        st.u = -IN_U + BALL_R;
        st.vu = Math.abs(st.vu);
      } else if (st.u > IN_U - BALL_R) {
        st.u = IN_U - BALL_R;
        st.vu = -Math.abs(st.vu);
      }
      if (st.w < -IN_W + BALL_R) {
        st.w = -IN_W + BALL_R;
        st.vw = Math.abs(st.vw);
        // decide on the way back whether this one gets missed
        st.missing = st.hits >= st.missAt;
      }
      const face = PADDLE.at - PADDLE.d / 2 - BALL_R;
      if (st.vw > 0 && st.w >= face && st.w < face + 0.25 && Math.abs(st.u - st.pu) < PADDLE.w / 2 + BALL_R * 0.6) {
        st.w = face;
        // the further from the paddle's middle, the wider the bounce
        const off = (st.u - st.pu) / (PADDLE.w / 2);
        const a = Math.max(-1.0, Math.min(1.0, off * 0.9 + Math.sign(st.vu) * 0.35));
        st.vu = SPEED * Math.sin(a);
        st.vw = -SPEED * Math.cos(a);
        st.hits++;
        st.kick = 1;
        setScore(st.score + 1);
      }
      if (st.w > IN_W + BALL_R) {
        // rolled off the open edge: hand the ball over to free fall in toy space
        st.phase = 'fall';
        st.timer = 0;
        const c = Math.cos(TILT);
        const sn = Math.sin(TILT);
        st.fx = st.u;
        st.fy = PIVOT_Y + BALL_R * c - st.w * sn;
        st.fz = BALL_R * sn + st.w * c;
        st.fvx = st.vu;
        st.fvy = -st.vw * sn;
        st.fvz = st.vw * c;
        if (ball.current) ball.current.visible = false;
        st.left--;
        st.drop = st.left;
        st.dropT = 0;
        st.hits = 0;
        st.missAt = 3 + Math.floor(Math.random() * 5);
      }
      // paddle: follows the ball while it comes in, drifts to the middle otherwise; when it means
      // to miss, it heads for the wrong side
      let goal = st.vw > 0 ? st.u : st.u * 0.4;
      if (st.missing && st.vw > 0) goal = st.u + (st.u > 0 ? -1.3 : 1.3);
      const lim = IN_U - PADDLE.w / 2;
      goal = Math.max(-lim, Math.min(lim, goal));
      st.pu += Math.max(-PADDLE_SPEED * dt, Math.min(PADDLE_SPEED * dt, goal - st.pu));
    } else if (st.phase === 'fall') {
      st.timer += dt;
      st.fvy -= G * dt;
      st.fx += st.fvx * dt;
      st.fy += st.fvy * dt;
      st.fz += st.fvz * dt;
      if (st.fy < BALL_R) {
        st.fy = BALL_R;
        st.fvy = Math.abs(st.fvy) * 0.45;
        st.fvx *= 0.7;
        st.fvz *= 0.7;
      }
      if (st.timer > 1.3) {
        st.phase = st.left > 0 ? 'wait' : 'over';
        st.timer = 0;
      }
    } else if (st.phase === 'wait') {
      st.timer += dt;
      if (st.timer > 0.4) serve();
    } else {
      st.timer += real;
      // Game over, then the Retry button is pressed and a new round starts
      if (st.timer > 2.6) {
        st.left = LIVES;
        st.drop = -1;
        setScore(0);
        serve();
      }
    }

    if (st.drop >= 0) {
      st.dropT += dt;
      if (st.dropT > 0.8) st.drop = -1;
    }
    writeLives();
    st.kick = Math.max(0, st.kick - dt * 5);
    if (ball.current) ball.current.position.set(st.u, BALL_R, st.w);
    if (paddle.current) {
      paddle.current.position.x = st.pu;
      paddle.current.position.z = PADDLE.at - st.kick * 0.08;
    }
    if (loose.current) {
      loose.current.visible = st.phase === 'fall';
      loose.current.position.set(st.fx, st.fy, st.fz);
      loose.current.scale.setScalar(st.timer > 0.9 ? Math.max(0.0001, 1 - (st.timer - 0.9) / 0.4) : 1);
    }
    const over = st.phase === 'over';
    if (overSign.current) {
      overSign.current.visible = over;
      // it pops up from behind the board
      overSign.current.position.y = OVER_Y - (over ? Math.max(0, 1 - st.timer / 0.3) : 1) * 1.2;
    }
    if (retry.current) retry.current.position.z = over && st.timer > 1.9 ? 0.02 : 0.1;
  });

  const glowRef = (i: number) => (m: MeshStandardMaterial | null) => void (glowMats.current[i] = m);
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[IN_U + 0.3, 1.0, IN_W * Math.cos(TILT) + 0.25]} position={[0, 1.0, 0]} />
        <CuboidCollider args={[BOARD.w / 2, (BOARD.y + BOARD.h) / 2, 0.2]} position={[0, (BOARD.y + BOARD.h) / 2, BOARD.z - 0.05]} />
      </RigidBody>
      <mesh geometry={geo.stand} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <group ref={tray} position={[0, PIVOT_Y, 0]} rotation={[TILT, 0, 0]}>
        <mesh geometry={geo.tray} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.6} />
        </mesh>
        <mesh ref={ball} position={[0, BALL_R, 0]} castShadow>
          <sphereGeometry args={[BALL_R, 18, 12]} />
          <meshStandardMaterial ref={glowRef(0)} color="#f6a53c" emissive="#f6a53c" emissiveIntensity={0.12} roughness={0.45} />
        </mesh>
        <mesh ref={paddle} geometry={geo.paddle} position={[0, 0.11, PADDLE.at]} castShadow>
          <meshStandardMaterial ref={glowRef(1)} color="#d8322c" emissive="#d8322c" emissiveIntensity={0.12} roughness={0.5} />
        </mesh>
      </group>
      <mesh ref={loose} visible={false} castShadow>
        <sphereGeometry args={[BALL_R, 18, 12]} />
        <meshStandardMaterial color="#f6a53c" roughness={0.45} />
      </mesh>
      <instancedMesh ref={lives} args={[undefined, undefined, LIVES]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.15, 16, 10]} />
        <meshStandardMaterial ref={glowRef(2)} color="#f6a53c" emissive="#f6a53c" emissiveIntensity={0.12} roughness={0.45} />
      </instancedMesh>
      <Label ref={score} font="bodyBold" size={0.36} color={COLORS.paper} anchorX="left" position={[-BOARD.w / 2 + 0.3, BOARD.y + BOARD.h / 2 - 0.02, BOARD.z + 0.11]}>
        {scoreText.current}
      </Label>
      <Label font="bodyBold" size={0.24} color="#c9c4d8" anchorX="left" position={[LIFE_X(0) - 0.16, BOARD.y + 0.74, BOARD.z + 0.11]}>
        Lives
      </Label>
      <group ref={overSign} visible={false} position={[0, OVER_Y, BOARD.z + 0.02]}>
        <mesh geometry={geo.sign} castShadow>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
        <Label font="display" size={0.56} color={COLORS.paper} position={[0, 0.3, 0.09]}>
          Game over
        </Label>
        <mesh ref={retry} position={[0, -0.33, 0.1]} geometry={geo.button}>
          <meshBasicMaterial color={COLORS.accent} toneMapped={false} />
          <Label font="bodyBold" size={0.28} color={COLORS.paper} position={[0, 0, 0.09]}>
            Retry
          </Label>
        </mesh>
      </group>
    </group>
  );
}
