import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { SphereGeometry } from 'three';
import type { Group, Mesh } from 'three';
import { useStore } from '../../state/store.ts';
import type { V3 } from '../career/kit/frame.ts';
import { box, cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';

// A table-tennis table (1.25x real size) with two paddles that keep a rally going on their own.

const L = 3.4; // along x
const W = 1.9;
const TOP = 0.95;
const BALL_R = 0.11;
const HIT_X = L / 2 + 0.32; // where the paddles meet the ball
const BOUNCE_X = 0.82; // distance from the net to the bounce, on the receiver's side
const CROSSING = 0.82; // s per crossing
const TURN = 0.85; // rad: the paddle blades face partly towards the camera

function tableGeometry() {
  const white = '#f4f4f0';
  const leg = '#30343e';
  const y = TOP + 0.004;
  const parts: Part[] = [
    { geo: box(L, 0.07, W, 0.02), color: '#2a5fc4', at: [0, TOP - 0.035, 0] },
    { geo: box(L, 0.008, 0.05, 0), color: white, at: [0, y, W / 2 - 0.03] },
    { geo: box(L, 0.008, 0.05, 0), color: white, at: [0, y, -W / 2 + 0.03] },
    { geo: box(0.05, 0.008, W, 0), color: white, at: [L / 2 - 0.03, y, 0] },
    { geo: box(0.05, 0.008, W, 0), color: white, at: [-L / 2 + 0.03, y, 0] },
    { geo: box(L, 0.008, 0.025, 0), color: white, at: [0, y, 0] },
    // Net with its white top band and two posts.
    { geo: box(0.016, 0.17, W + 0.14, 0), color: '#2a2e38', at: [0, TOP + 0.085, 0] },
    { geo: box(0.03, 0.035, W + 0.16, 0), color: white, at: [0, TOP + 0.18, 0] },
    { geo: box(0.05, 0.22, 0.05, 0.01), color: leg, at: [0, TOP + 0.1, W / 2 + 0.08] },
    { geo: box(0.05, 0.22, 0.05, 0.01), color: leg, at: [0, TOP + 0.1, -W / 2 - 0.08] },
  ];
  for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) {
    for (const z of [-W / 2 + 0.2, W / 2 - 0.2]) parts.push({ geo: box(0.07, TOP - 0.07, 0.07, 0.02), color: leg, at: [x, (TOP - 0.07) / 2, z] });
    parts.push({ geo: box(0.05, 0.05, W - 0.4, 0), color: leg, at: [x, 0.28, 0] });
  }
  parts.push({ geo: box(L - 0.6, 0.05, 0.05, 0), color: leg, at: [0, 0.28, 0] });
  return paint(parts);
}

// Paddle in its own frame: blade facing +x, handle hanging down. Drawn 1.5x so it reads from the
// camera.
function paddleGeometry(rubber: string) {
  return paint([
    { geo: cyl(0.27, 0.27, 0.045, 22), color: rubber, rot: [0, 0, Math.PI / 2] },
    { geo: cyl(0.285, 0.285, 0.025, 22), color: '#c48a50', at: [-0.032, 0, 0], rot: [0, 0, Math.PI / 2] },
    { geo: box(0.06, 0.27, 0.07, 0.02), color: '#c48a50', at: [-0.03, -0.37, 0] },
  ]);
}

// Concrete pad under the table.
function matGeometry() {
  return paint([
    { geo: box(L + 2.6, 0.06, W + 1.8, 0.03), color: '#c9c2b2', at: [0, 0.03, 0] },
    { geo: box(L + 2.3, 0.012, 0.06, 0), color: '#f1ece0', at: [0, 0.066, (W + 1.5) / 2] },
    { geo: box(L + 2.3, 0.012, 0.06, 0), color: '#f1ece0', at: [0, 0.066, -(W + 1.5) / 2] },
  ]);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function TableTennis({ position }: { position: V3 }) {
  const table = useMemo(tableGeometry, []);
  const mat = useMemo(matGeometry, []);
  const red = useMemo(() => paddleGeometry('#d8383a'), []);
  const black = useMemo(() => paddleGeometry('#26292f'), []);
  const ballGeo = useMemo(() => paint([{ geo: new SphereGeometry(BALL_R, 14, 10), color: '#ff8a1c' }]), []);
  const ball = useRef<Mesh>(null);
  const paddles = useRef<(Group | null)[]>([]);
  const rally = useRef({ t: 0, dir: 1, z0: 0, z1: 0.3, swing: [0, 0] });

  useFrame((_, delta) => {
    const r = rally.current;
    const slow = useStore.getState().reducedMotion ? 0.6 : 1;
    r.t += Math.min(delta, 0.05) * slow;
    let s = r.t / CROSSING;
    if (s >= 1) {
      // The receiver hits it back.
      r.t -= CROSSING;
      s = r.t / CROSSING;
      r.dir = -r.dir;
      r.z0 = r.z1;
      r.z1 = (Math.random() * 2 - 1) * 0.55;
      r.swing[r.dir > 0 ? 0 : 1] = 1;
    }
    const x0 = -r.dir * HIT_X;
    const xb = r.dir * BOUNCE_X;
    const x1 = r.dir * HIT_X;
    const sb = (xb - x0) / (x1 - x0);
    const yHit = TOP + 0.32;
    const yBounce = TOP + BALL_R;
    let x: number;
    let y: number;
    if (s < sb) {
      const u = s / sb;
      x = lerp(x0, xb, u);
      y = lerp(yHit, yBounce, u) + 0.42 * 4 * u * (1 - u);
    } else {
      const u = (s - sb) / (1 - sb);
      x = lerp(xb, x1, u);
      y = lerp(yBounce, yHit, u) + 0.2 * 4 * u * (1 - u);
    }
    const z = lerp(r.z0, r.z1, s);
    ball.current?.position.set(x, y, z);
    // Paddles: the receiver drifts towards where the ball will arrive; the hitter swings.
    for (let i = 0; i < 2; i++) {
      const g = paddles.current[i];
      if (!g) continue;
      const side = i === 0 ? -1 : 1;
      const receiving = side === r.dir;
      const targetZ = receiving ? r.z1 : r.z0;
      g.position.z += (targetZ - g.position.z) * (1 - Math.exp(-delta * 6));
      r.swing[i] = Math.max(0, r.swing[i] - delta * 3.2);
      const k = r.swing[i];
      // Blades turned half towards the camera, plus the swing.
      g.rotation.y = side * (TURN + Math.sin(k * Math.PI) * 0.6);
      g.position.x = side * (HIT_X + 0.06) - side * Math.sin(k * Math.PI) * 0.18;
    }
  });

  return (
    <group position={position}>
      <mesh geometry={mat} material={paintMaterial} receiveShadow />
      <mesh geometry={table} material={paintMaterial} castShadow receiveShadow />
      <mesh ref={ball} geometry={ballGeo} material={paintMaterial} castShadow />
      {[0, 1].map((i) => (
        <group key={i} ref={(g) => { paddles.current[i] = g; }} position={[(i === 0 ? -1 : 1) * (HIT_X + 0.06), TOP + 0.36, 0]}>
          {/* The blade faces the table: +x for the left paddle, -x for the right. */}
          <mesh geometry={i === 0 ? red : black} material={paintMaterial} rotation={[0, i === 0 ? 0 : Math.PI, 0]} castShadow />
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[L / 2, TOP / 2, W / 2]} position={[0, TOP / 2, 0]} />
      </RigidBody>
    </group>
  );
}
