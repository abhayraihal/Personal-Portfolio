import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, Color, ConeGeometry, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Group, InstancedMesh, Mesh } from 'three';
import { useStore } from '../../state/store.ts';
import type { V3 } from '../career/kit/frame.ts';
import { box, cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { volleyballGeometry } from './balls.ts';
import { rect } from './geom.ts';
import { PEG, SKIN, pegArm, pegBody } from './people.ts';
import { meshMaterial, netTexture } from './textures.ts';

// Beach volleyball: a sand court inside a rope barrier, a net with antennae, and two pairs of peg
// players who keep a rally going on their own (dig, set, hit over the net). Beside the court: an
// umbrella, a towel, a cool box and a beach ball. Nothing here is physics except the barrier.

export const SAND = { x0: -8.6, x1: 9.8, z0: -5.2, z1: 5.2 };
const COURT = { half: 7, depth: 3.5 };
const NET = { top: 1.95, h: 0.85, half: 4.3 };
const BALL_R = 0.27;
const HAND_HIGH = 2.15;
const HAND_LOW = 1.15;

function sandGeometry(): BufferGeometry {
  const w = SAND.x1 - SAND.x0;
  const d = SAND.z1 - SAND.z0;
  const g = new PlaneGeometry(w, d, 46, 26);
  g.rotateX(-Math.PI / 2);
  g.translate((SAND.x0 + SAND.x1) / 2, 0.03, 0);
  // Speckled sand, darker where it is raked into low ridges.
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const base = new Color('#ecd9a6');
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = Math.sin(x * 3.1 + Math.sin(z * 1.7) * 2) * 0.5 + Math.sin(z * 4.3 + x * 0.7) * 0.5;
    const k = 1 + n * 0.035 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.05;
    c.copy(base).multiplyScalar(k);
    c.toArray(col, i * 3);
    pos.setY(i, 0.03 + Math.max(0, n) * 0.025);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

function courtGeometry(): BufferGeometry {
  const tape = '#2f6fd6';
  const y = 0.075;
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    parts.push(rect(s * COURT.half, 0, 0.09, COURT.depth * 2 + 0.09, y, tape));
    parts.push(rect(0, s * COURT.depth, COURT.half * 2 + 0.09, 0.09, y, tape));
  }
  // Timber edging round the sand.
  const wood = '#b98a58';
  const w = SAND.x1 - SAND.x0;
  const cx = (SAND.x0 + SAND.x1) / 2;
  parts.push({ geo: box(w + 0.3, 0.16, 0.18, 0.03), color: wood, at: [cx, 0.08, SAND.z0 - 0.06] });
  parts.push({ geo: box(w + 0.3, 0.16, 0.18, 0.03), color: wood, at: [cx, 0.08, SAND.z1 + 0.06] });
  parts.push({ geo: box(0.18, 0.16, SAND.z1 - SAND.z0, 0.03), color: wood, at: [SAND.x0 - 0.06, 0.08, 0] });
  parts.push({ geo: box(0.18, 0.16, SAND.z1 - SAND.z0, 0.03), color: wood, at: [SAND.x1 + 0.06, 0.08, 0] });
  // Net posts with padding, the top band, and red-and-white antennae at the sidelines.
  for (const s of [-1, 1]) {
    parts.push({ geo: cyl(0.07, 0.08, NET.top + 0.2, 10), color: '#e9e6de', at: [0, (NET.top + 0.2) / 2, s * NET.half] });
    parts.push({ geo: cyl(0.12, 0.12, 1.1, 12), color: '#2f6fd6', at: [0, 0.75, s * NET.half] });
    for (let k = 0; k < 6; k++) {
      parts.push({ geo: cyl(0.02, 0.02, 0.14, 6), color: k % 2 ? '#f6f6f2' : '#d94141', at: [0, NET.top - NET.h + 0.07 + k * 0.14 + 0.35, s * COURT.depth] });
    }
  }
  parts.push({ geo: box(0.04, 0.08, NET.half * 2, 0.01), color: '#f6f6f2', at: [0, NET.top - 0.04, 0] });
  parts.push({ geo: box(0.04, 0.06, NET.half * 2, 0.01), color: '#f6f6f2', at: [0, NET.top - NET.h + 0.03, 0] });
  return paint(parts);
}

// Rope barrier: posts round the sand and a rope between them.
const ROPE = { y: 0.72, m: 0.7 };
function ropePosts(): [number, number][] {
  const pts: [number, number][] = [];
  const x0 = SAND.x0 - ROPE.m;
  const x1 = SAND.x1 + ROPE.m;
  const z0 = SAND.z0 - ROPE.m;
  const z1 = SAND.z1 + ROPE.m;
  const along = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3));
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  };
  along(x0, z0, x1, z0);
  along(x1, z0, x1, z1);
  along(x1, z1, x0, z1);
  along(x0, z1, x0, z0);
  return pts;
}

function barrierGeometry(): BufferGeometry {
  const pts = ropePosts();
  const parts: Part[] = [];
  pts.forEach(([x, z], i) => {
    parts.push({ geo: cyl(0.06, 0.07, ROPE.y + 0.12, 8), color: '#c9a36b', at: [x, (ROPE.y + 0.12) / 2, z] });
    parts.push({ geo: cyl(0.09, 0.09, 0.06, 10), color: '#7a5a36', at: [x, ROPE.y + 0.14, z] });
    const [nx, nz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(nx - x, nz - z);
    parts.push({ geo: cyl(0.025, 0.025, len, 6), color: '#f2efe6', at: [(x + nx) / 2, ROPE.y, (z + nz) / 2], rot: [Math.PI / 2, 0, Math.atan2(-(nx - x), nz - z)] });
  });
  return paint(parts);
}

// Umbrella canopy: ten panels in two colours, each its own painted part.
function canopy(r: number, h: number, a: string, b: string, at: V3, rot: V3): Part[] {
  return Array.from({ length: 10 }, (_, k) => ({
    geo: new ConeGeometry(r, h, 1, 1, true, (k / 10) * Math.PI * 2, Math.PI / 5),
    color: k % 2 ? a : b,
    at,
    rot,
  }));
}

function beachGeometry(): BufferGeometry {
  const x = 8.4;
  const parts: Part[] = [
    { geo: cyl(0.04, 0.05, 2.6, 8), color: '#f2efe6', at: [x, 1.3, -2.2], rot: [0.12, 0, -0.08] },
    ...canopy(1.7, 0.7, '#e2557f', '#f6f4ee', [x + 0.2, 2.7, -2.05], [0.12, 0, -0.08]),
    // Towel with stripes.
    ...['#2f6fd6', '#f6f4ee', '#2f6fd6', '#f2c230', '#2f6fd6'].map((c, i) => rect(x - 0.2, -1.5 + i * 0.38, 1.1, 0.38, 0.08, c, 0.15)),
    // Cool box.
    { geo: box(0.8, 0.5, 0.5, 0.06), color: '#2f8fd6', at: [x + 0.3, 0.3, 1.6] },
    { geo: box(0.84, 0.12, 0.54, 0.04), color: '#f6f4ee', at: [x + 0.3, 0.58, 1.6] },
    { geo: box(0.4, 0.05, 0.08, 0.02), color: '#f6f4ee', at: [x + 0.3, 0.66, 1.6] },
  ];
  return paint(parts);
}

type Flight = { from: Vector3; to: Vector3; T: number; apex: number; t: number };
type Player = { side: -1 | 1; x: number; z: number; tx: number; tz: number; hop: number; hopH: number; swing: number };

const TEAM = [
  { shirt: '#d94141', cap: '#f6f4ee' },
  { shirt: '#2f6fd6', cap: '#f2c230' },
];
const HAIR = ['#2b1d14', '#5a3b22', '#1c1c22', '#7a4a2a'];

const _m = new Matrix4();
const _q = new Quaternion();
const _qa = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const _off = new Vector3();
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

export function Volleyball({ position }: { position: V3 }) {
  const sand = useMemo(sandGeometry, []);
  const court = useMemo(courtGeometry, []);
  const barrier = useMemo(barrierGeometry, []);
  const beach = useMemo(beachGeometry, []);
  const ballGeo = useMemo(() => volleyballGeometry(BALL_R), []);
  const bodies = useMemo(() => [0, 1, 2, 3].map((i) => pegBody(TEAM[i < 2 ? 0 : 1].shirt, SKIN[i], HAIR[i], i % 2 ? TEAM[i < 2 ? 0 : 1].cap : undefined)), []);
  const arm = useMemo(() => pegArm(SKIN[0], '#f6f4ee'), []);
  const net = useMemo(() => {
    const g = new PlaneGeometry(NET.half * 2, NET.h - 0.08);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * NET.half * 2) / 0.14, (uv.getY(i) * (NET.h - 0.08)) / 0.14);
    g.rotateY(Math.PI / 2);
    g.translate(0, NET.top - NET.h / 2, 0);
    return { geo: g, mat: meshMaterial(netTexture(), '#26292f') };
  }, []);
  useEffect(() => () => {
    net.mat.map?.dispose();
    net.mat.dispose();
  }, [net]);

  const ball = useRef<Mesh>(null);
  const figures = useRef<(Group | null)[]>([]);
  const arms = useRef<InstancedMesh>(null);
  const sim = useRef<{ f: Flight; players: Player[]; hitter: number; receiver: number; touches: number; spin: number } | null>(null);
  if (!sim.current) {
    const players: Player[] = [
      { side: -1, x: -5, z: -1.4, tx: -5, tz: -1.4, hop: 0, hopH: 0, swing: 0 },
      { side: -1, x: -2.4, z: 1.5, tx: -2.4, tz: 1.5, hop: 0, hopH: 0, swing: 0 },
      { side: 1, x: 5, z: 1.4, tx: 5, tz: 1.4, hop: 0, hopH: 0, swing: 0 },
      { side: 1, x: 2.4, z: -1.5, tx: 2.4, tz: -1.5, hop: 0, hopH: 0, swing: 0 },
    ];
    sim.current = {
      f: { from: new Vector3(-2.4, HAND_HIGH, 1.5), to: new Vector3(5, HAND_LOW, 1.4), T: 1.4, apex: 2.8, t: 0 },
      players, hitter: 1, receiver: 2, touches: 0, spin: 0,
    };
  }

  useFrame((_, delta) => {
    const s = sim.current;
    if (!s) return;
    const slow = useStore.getState().reducedMotion ? 0.5 : 1;
    const dt = Math.min(delta, 0.05) * slow;
    const f = s.f;
    f.t += dt;
    if (f.t >= f.T) {
      // The receiver plays it: a dig to the partner, then the partner sends it over.
      const r = s.players[s.receiver];
      const mate = s.receiver ^ 1;
      s.hitter = s.receiver;
      f.from.copy(f.to);
      f.t -= f.T;
      if (s.touches === 0) {
        const m = s.players[mate];
        m.tx = r.side * (1.4 + Math.random() * 0.8);
        m.tz = (Math.random() * 2 - 1) * 1.6;
        f.to.set(m.tx, HAND_HIGH, m.tz);
        f.T = 0.95;
        f.apex = 1.9;
        s.receiver = mate;
        s.touches = 1;
        r.hop = 0.3;
        r.hopH = 0.12;
      } else {
        // Over the net to a spot in the other half; the nearer opponent runs to it.
        const side = -r.side;
        const lx = side * (2.6 + Math.random() * 3.4);
        const lz = (Math.random() * 2 - 1) * 2.6;
        const a = side === -1 ? 0 : 2;
        const pick = Math.hypot(s.players[a].x - lx, s.players[a].z - lz) < Math.hypot(s.players[a + 1].x - lx, s.players[a + 1].z - lz) ? a : a + 1;
        const o = s.players[pick];
        o.tx = lx;
        o.tz = lz;
        // The partner drifts back to cover.
        const p2 = s.players[pick ^ 1];
        p2.tx = side * (lx * side > 4 ? 2.4 : 5);
        p2.tz = -lz * 0.6;
        f.to.set(lx, HAND_LOW, lz);
        f.T = 1.25 + Math.random() * 0.25;
        f.apex = 2.5 + Math.random() * 0.8;
        s.receiver = pick;
        s.touches = 0;
        r.hop = 0.45;
        r.hopH = 0.42;
      }
      r.swing = 1;
    }
    const u = Math.min(f.t / f.T, 1);
    const b = ball.current;
    if (b) {
      b.position.lerpVectors(f.from, f.to, u);
      b.position.y += f.apex * 4 * u * (1 - u);
      s.spin += dt * 6;
      b.rotation.set(s.spin, s.spin * 0.6, 0);
    }
    const am = arms.current;
    for (let i = 0; i < 4; i++) {
      const p = s.players[i];
      const k = 1 - Math.exp(-dt * 5);
      p.x += (p.tx - p.x) * k;
      p.z += (p.tz - p.z) * k;
      p.hop = Math.max(0, p.hop - dt);
      p.swing = Math.max(0, p.swing - dt * 2.4);
      const jump = p.hop > 0 ? Math.sin((p.hop / 0.45) * Math.PI) * p.hopH : 0;
      const g = figures.current[i];
      // Face the ball, mostly towards the net.
      const yaw = Math.atan2((b?.position.x ?? 0) - p.x, (b?.position.z ?? 0) - p.z);
      if (g) {
        g.position.set(p.x, jump, p.z);
        g.rotation.y = yaw;
      }
      if (am) {
        // Arms swing up for a hit and settle slightly forward, ready.
        const lift = 0.35 + Math.sin(p.swing * Math.PI) * 2.4;
        _q.setFromAxisAngle(Y, yaw);
        for (let k2 = 0; k2 < 2; k2++) {
          _off.set(k2 ? 0.33 : -0.33, PEG.shoulderY, 0).applyQuaternion(_q);
          _p.set(p.x + _off.x, jump + _off.y, p.z + _off.z);
          _qa.setFromAxisAngle(X, -lift).premultiply(_q);
          am.setMatrixAt(i * 2 + k2, _m.compose(_p, _qa, _s));
        }
      }
    }
    if (am) am.instanceMatrix.needsUpdate = true;
  });

  const ropeX0 = SAND.x0 - ROPE.m;
  const ropeX1 = SAND.x1 + ROPE.m;
  const ropeZ0 = SAND.z0 - ROPE.m;
  const ropeZ1 = SAND.z1 + ROPE.m;
  return (
    <group position={position}>
      <mesh geometry={sand} material={paintMaterial} receiveShadow />
      <mesh geometry={court} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={barrier} material={paintMaterial} castShadow />
      <mesh geometry={beach} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={net.geo} material={net.mat} castShadow />
      <mesh ref={ball} geometry={ballGeo} material={paintMaterial} castShadow />
      {bodies.map((g, i) => (
        <group key={i} ref={(el) => { figures.current[i] = el; }}>
          <mesh geometry={g} material={paintMaterial} castShadow />
        </group>
      ))}
      <instancedMesh ref={arms} args={[arm, paintMaterial, 8]} castShadow frustumCulled={false} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(ropeX1 - ropeX0) / 2, 0.5, 0.08]} position={[(ropeX0 + ropeX1) / 2, 0.5, ropeZ0]} />
        <CuboidCollider args={[(ropeX1 - ropeX0) / 2, 0.5, 0.08]} position={[(ropeX0 + ropeX1) / 2, 0.5, ropeZ1]} />
        <CuboidCollider args={[0.08, 0.5, (ropeZ1 - ropeZ0) / 2]} position={[ropeX0, 0.5, 0]} />
        <CuboidCollider args={[0.08, 0.5, (ropeZ1 - ropeZ0) / 2]} position={[ropeX1, 0.5, 0]} />
      </RigidBody>
    </group>
  );
}
