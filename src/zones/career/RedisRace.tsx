import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Color, CylinderGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { PHYSICS_DT } from '../../vehicle/tuning.ts';
import { localToWorld, localToWorldInto } from './kit/frame.ts';
import type { V3 } from './kit/frame.ts';
import { FixedBoxes, InstancedModel } from './kit/instances.tsx';
import type { BoxCollider, Placement } from './kit/instances.tsx';
import { box, flatMaterial, paint, paintMaterial, shade } from './kit/paint.ts';
import type { Part } from './kit/paint.ts';
import { ZONE, p } from './plan.ts';
import { RACER, racerGeometry } from './ToyRacer.ts';

// A short drag strip beside the road. Two toy cars race when the player drives past the start;
// the one labelled "with Redis" always wins.

const U0 = 8.45; // track edges (screen u)
const U1 = 13.85;
const V0 = 40.2;
const V1 = 58.8;
const UC = (U0 + U1) / 2;
const LANE_A = 9.8;
const LANE_B = 12.5;
const START_V = 42.7;
const FINISH_V = 53.7;
const REST_V = START_V - RACER.length / 2 - 0.15; // car centre on the grid
const FINISH_S = FINISH_V - REST_V - RACER.length / 2; // distance until the nose crosses the line
const TRIGGER_V = 39.6; // the player's car crossing this line, going up, starts a race
const BARRIER_U = 7.65;
const TYRE_U = 14.45;
// The title banner stands at the far end, behind where the cars stop, so it never hides them.
const BANNER_V = V1 - 0.45;
const LIGHT_U = BARRIER_U;
const LIGHT_Y = 1.17; // on top of the barrier

type Racer = { s: number; vel: number; acc: number; vmax: number; brake: number; finished: boolean; drawn: number };
type Phase = 'ready' | 'set' | 'go' | 'done' | 'back';

function newRace() {
  const a: Racer = { s: 0, vel: 0, acc: 12, vmax: 10, brake: 12, finished: false, drawn: Number.NaN };
  const b: Racer = { s: 0, vel: 0, acc: 4, vmax: 4.5, brake: 8, finished: false, drawn: Number.NaN };
  return { phase: 'ready' as Phase, t: 0, lastV: Number.NaN, a, b, both: [a, b] };
}

const REDIS = { color: COLORS.razorpay, label: 'with Redis' };
const PLAIN = { color: '#9aa1ae', label: 'without Redis' };

function trackGeometry() {
  const parts: Part[] = [
    { geo: box(U1 - U0, 0.04, V1 - V0, 0), color: '#4a4e5c', at: p(UC, (V0 + V1) / 2, 0.02) },
    { geo: box(U1 - U0, 0.012, 0.32, 0), color: '#f4f2ea', at: p(UC, START_V, 0.046) },
  ];
  // Dashed divider between the two lanes.
  for (let v = V0 + 0.8; v < V1 - 0.6; v += 2) parts.push({ geo: box(0.14, 0.012, 1, 0), color: '#f4f2ea', at: p(UC, v + 0.5, 0.046) });
  // Chequered finish line, two rows of squares.
  const n = 14;
  const sq = (U1 - U0) / n;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n; i++) {
      const dark = (i + row) % 2 === 0;
      parts.push({ geo: box(sq, 0.012, sq, 0), color: dark ? '#23262d' : '#f4f2ea', at: p(U0 + sq * (i + 0.5), FINISH_V + sq * (row - 0.5), 0.046) });
    }
  }
  return paint(parts);
}

function bannerGeometry() {
  const w = U1 - U0 - 0.6;
  const posts: Part[] = [];
  for (const u of [U0 + 0.15, U1 - 0.15]) {
    posts.push({ geo: box(0.16, 3.6, 0.16, 0.05), color: '#e9ecf2', at: p(u, BANNER_V, 1.8) });
  }
  posts.push(
    { geo: box(w + 0.3, 0.14, 0.14, 0.04), color: shade(COLORS.razorpay, -0.5), at: p(UC, BANNER_V, 3.55) },
    { geo: box(w, 1.12, 0.12, 0.05), color: shade(COLORS.razorpay, -0.4), at: p(UC, BANNER_V, 2.88) },
  );
  // Unlit face: the title in Razorpay blue over a chequered strip.
  const [fx, , fz] = p(UC, BANNER_V);
  const face: Part[] = [{ geo: box(w - 0.12, 0.74, 0.02, 0), color: COLORS.razorpay, at: [fx, 3.05, fz + 0.07] }];
  const n = 12;
  const sq = (w - 0.12) / n;
  for (let i = 0; i < n; i++) {
    face.push({ geo: box(sq, 0.22, 0.02, 0), color: i % 2 ? '#23262d' : '#f4f2ea', at: [fx - (w - 0.12) / 2 + sq * (i + 0.5), 2.51, fz + 0.07] });
  }
  return [paint(posts), paint(face)];
}

// Start light: a post with one lamp that goes red, then green.
function lightGeometry() {
  return paint([
    { geo: box(0.14, 0.9, 0.14, 0.04), color: '#3a3f4b', at: [0, 0.45, 0] },
    { geo: box(0.56, 0.58, 0.34, 0.1), color: '#2a2e38', at: [0, 1.15, 0] },
  ]);
}

const barriers: Placement[] = Array.from({ length: 10 }, (_, i) => ({ position: p(BARRIER_U, V0 + 1 + i * 1.98) }));

// Tyre stacks: the outer side and both ends of the strip, two tyres high.
const tyreSpots: V3[] = [];
for (let v = V0 + 0.5; v <= V1 - 0.3; v += 0.95) tyreSpots.push(p(TYRE_U, v));
for (let u = U0 + 0.45; u <= U1 - 0.3; u += 0.9) {
  tyreSpots.push(p(u, V1 + 0.25));
  tyreSpots.push(p(u, V0 - 0.25));
}

const walls: BoxCollider[] = [
  { position: p(BARRIER_U, (V0 + V1) / 2, 0.6), half: [0.55, 0.6, (V1 - V0) / 2 + 0.6] },
  { position: p(TYRE_U, (V0 + V1) / 2, 0.35), half: [0.4, 0.35, (V1 - V0) / 2 + 0.6] },
  { position: p(UC, V1 + 0.25, 0.35), half: [(U1 - U0) / 2, 0.35, 0.4] },
  { position: p(UC, V0 - 0.25, 0.35), half: [(U1 - U0) / 2, 0.35, 0.4] },
  { position: p(U0 + 0.15, BANNER_V, 1.8), half: [0.1, 1.8, 0.1] },
  { position: p(U1 - 0.15, BANNER_V, 1.8), half: [0.1, 1.8, 0.1] },
];

const BANNER_TEXT: V3 = [p(UC, BANNER_V)[0], 3.06, p(UC, BANNER_V)[2] + 0.1];

const tyreMaterial = new MeshStandardMaterial({ roughness: 0.9 });
const tyreGeometry = new CylinderGeometry(0.42, 0.42, 0.33, 16);
const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3(1, 1, 1);
const _c = new Color();

function Tyres() {
  const ref = useRef<InstancedMesh>(null);
  const count = tyreSpots.length * 2;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    tyreSpots.forEach((spot, i) => {
      for (let level = 0; level < 2; level++) {
        const k = i * 2 + level;
        mesh.setMatrixAt(k, _m.compose(_v.set(spot[0], 0.17 + level * 0.34, spot[2]), _q, _s));
        mesh.setColorAt(k, _c.set((i + level) % 2 ? '#23262d' : COLORS.razorpay));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);
  return <instancedMesh ref={ref} args={[tyreGeometry, tyreMaterial, count]} castShadow receiveShadow />;
}

const lampMaterial = new MeshStandardMaterial({ color: '#4a4f5c', emissive: '#000000', roughness: 0.5 });
const LAMP_OFF = new Color('#4a4f5c');
const LAMP_RED = new Color('#ff3b3b');
const LAMP_GREEN = new Color('#38d86a');

function setLamp(c: Color | null) {
  lampMaterial.color.copy(c ?? LAMP_OFF);
  lampMaterial.emissive.copy(c ?? LAMP_OFF);
  lampMaterial.emissiveIntensity = c ? 1.6 : 0;
}

export function RedisRace() {
  const track = useMemo(trackGeometry, []);
  const [banner, bannerFace] = useMemo(bannerGeometry, []);
  const light = useMemo(lightGeometry, []);
  const redisCar = useMemo(() => racerGeometry(REDIS.color), []);
  const plainCar = useMemo(() => racerGeometry(PLAIN.color), []);
  const bodyA = useRef<RapierRigidBody>(null);
  const bodyB = useRef<RapierRigidBody>(null);
  const race = useRef(newRace());

  useLayoutEffect(() => setLamp(null), []);

  useBeforePhysicsStep(() => {
    const r = race.current;
    const dt = PHYSICS_DT;
    const v = car.v;
    // A teleport past the line (to the Amazon plaza, say) is not a drive-by.
    const crossed = car.ready && r.lastV < TRIGGER_V && v >= TRIGGER_V && v - r.lastV < 2 && car.u > -16 && car.u < 16;
    r.lastV = v;
    r.t += dt;

    if (r.phase === 'ready' && crossed) {
      r.phase = 'set';
      r.t = 0;
      setLamp(LAMP_RED);
    } else if (r.phase === 'set' && r.t > 0.9) {
      r.phase = 'go';
      r.t = 0;
      setLamp(LAMP_GREEN);
      playSound('whoosh', 0.6);
    } else if (r.phase === 'go') {
      for (const racer of r.both) {
        if (!racer.finished) {
          racer.vel = Math.min(racer.vmax, racer.vel + racer.acc * dt);
          if (racer.s >= FINISH_S) {
            racer.finished = true;
            if (racer === r.a) {
              const [lx, , lz] = p(LANE_A, FINISH_V);
              const [x, z] = localToWorld(ZONE, lx, lz);
              events.emit('confetti', { x, y: 0.8, z, colors: [COLORS.razorpay, '#ffffff', '#f2c230'], count: 36 });
              playSound('coin', 0.7);
            }
          }
        } else {
          racer.vel = Math.max(0, racer.vel - racer.brake * dt);
        }
        racer.s += racer.vel * dt;
      }
      if (r.a.finished && r.b.finished && r.a.vel === 0 && r.b.vel === 0) {
        r.phase = 'done';
        r.t = 0;
      }
    } else if (r.phase === 'done' && r.t > 2.2) {
      r.phase = 'back';
      setLamp(null);
    } else if (r.phase === 'back') {
      // Roll back to the grid, slowing down for the last metre.
      let home = 0;
      for (const racer of r.both) {
        const speed = Math.min(4, 0.6 + racer.s * 1.6);
        racer.s = Math.max(0, racer.s - speed * dt);
        if (racer.s === 0) home++;
      }
      if (home === 2) {
        r.phase = 'ready';
        r.a.finished = r.b.finished = false;
        r.a.vel = r.b.vel = 0;
      }
    }

    move(bodyA.current, GRID_A, r.a);
    move(bodyB.current, GRID_B, r.b);
  });

  return (
    <group>
      <mesh geometry={track} material={paintMaterial} receiveShadow />
      <mesh geometry={banner} material={paintMaterial} castShadow />
      <mesh geometry={bannerFace} material={flatMaterial} />
      <Label font="display" size={0.6} color="#ffffff" position={BANNER_TEXT}>
        Redis race
      </Label>
      <group position={p(LIGHT_U, START_V, LIGHT_Y)}>
        <mesh geometry={light} material={paintMaterial} castShadow />
        <mesh position={[0, 1.15, 0.18]} material={lampMaterial}>
          <circleGeometry args={[0.19, 20]} />
        </mesh>
      </group>
      <InstancedModel name="barrier-concrete" items={barriers} />
      <Tyres />
      <FixedBoxes boxes={walls} />
      {[
        { ref: bodyA, u: LANE_A, geometry: redisCar, spec: REDIS, dx: -0.3 },
        { ref: bodyB, u: LANE_B, geometry: plainCar, spec: PLAIN, dx: 0.3 },
      ].map(({ ref, u, geometry, spec, dx }) => (
        <RigidBody key={spec.label} ref={ref} type="kinematicPosition" colliders={false} position={p(u, REST_V)}>
          <CuboidCollider args={[RACER.width / 2, 0.4, RACER.length / 2]} position={[0, 0.45, 0]} />
          <mesh geometry={geometry} material={paintMaterial} rotation={[0, Math.PI, 0]} castShadow />
          <Label font="bodyBold" size={0.46} color="#ffffff" outlineWidth={0.05} outlineColor={shade(spec.color, -0.6)} position={[dx, 1.5, 0]}>
            {spec.label}
          </Label>
        </RigidBody>
      ))}
    </group>
  );
}

const _t = { x: 0, y: 0, z: 0 };
// Grid slots in the zone frame; a car's s moves it up the screen (towards -z).
const GRID_A = p(LANE_A, REST_V);
const GRID_B = p(LANE_B, REST_V);
// Parked cars are left alone so their bodies can rest.
function move(body: RapierRigidBody | null, grid: V3, racer: Racer) {
  if (!body || racer.drawn === racer.s) return;
  racer.drawn = racer.s;
  localToWorldInto(ZONE, grid[0], grid[2] - racer.s, _t);
  body.setNextKinematicTranslation(_t);
}
