import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useBeforePhysicsStep } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { BoxGeometry, Color, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { COLORS } from '../../../config/palette.ts';
import { car } from '../../../state/car.ts';
import { useStore } from '../../../state/store.ts';
import { carNearZone, carX, carZ, localX, localZ, worldX, worldYaw, worldZ } from '../frame.ts';
import { useHomeReset } from '../useHomeReset.ts';
import { Y } from '../Plaza.tsx';
import { mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';
import { NetworkBoard, network } from './NetworkBoard.tsx';

// A three-lane test strip. Small kinematic cars drive up it, each casting 5 sensor rays, and
// change lanes around the traffic boxes and the player's car. Strip coordinates: s runs up the
// strip from its bottom end, t runs across it (positive = screen right).

export const STRIP = { x: 7, z0: -4.6, length: 16.2, lane: 1.4 };
const HALF_W = (STRIP.lane * 3) / 2;
const LANES = [-STRIP.lane, 0, STRIP.lane];
const N_CARS = 6;
const CAR_W = 0.62;
const CAR_L = 1.0;
const CAR_H = 0.42;
const RAYS = 5;
const RAY_LEN = 2.6;
const RAY_SPREAD = Math.PI / 4; // +-45 degrees, as in the original
const BOXES = [
  { t: -STRIP.lane, s: 5.4 },
  { t: STRIP.lane, s: 5.4 },
  { t: 0, s: 10.6 },
];
const BOX_HALF = { w: 0.34, h: 0.27, l: 0.52 };

type Obstacle = { t: number; s: number; ax: number; as: number; hl: number; hw: number };
type Sim = {
  active: boolean;
  wait: number;
  s: number;
  t: number;
  heading: number; // radians, 0 = straight up the strip, + = towards +t
  v: number;
  base: number;
  lane: number;
  scale: number;
  leaving: boolean;
  decide: number;
  readings: number[];
  steer: number;
  braking: boolean;
};

const toLocalX = (t: number) => STRIP.x + t;
const toLocalZ = (s: number) => STRIP.z0 - s;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _c = new Color();
const _pos = { x: 0, y: 0, z: 0 };
const _rot = { x: 0, y: 0, z: 0, w: 1 };
const YELLOW = new Color('#f2c230');
const DARK = new Color(COLORS.ink);

// One merged toy-car geometry (body, cabin, wheels) with vertex colours; forward is -Z.
function carGeometry(): BufferGeometry {
  const parts: Part[] = [
    { g: new BoxGeometry(CAR_W, CAR_H * 0.55, CAR_L), color: '#2f6fd6', at: [0, 0.12 + CAR_H * 0.275, 0] },
    { g: new BoxGeometry(CAR_W * 0.82, CAR_H * 0.38, CAR_L * 0.5), color: '#a9c8f5', at: [0, 0.12 + CAR_H * 0.74, 0.06] },
  ];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push({ g: new BoxGeometry(0.1, 0.22, 0.24), color: COLORS.ink, at: [x * (CAR_W / 2), 0.11, z * (CAR_L * 0.32)] });
  return mergeParts(parts);
}

// Slab test on one axis: narrows [range.t0, range.t1]; false when the ray misses.
const range = { t0: 0, t1: 0 };
function slab(p: number, d: number, h: number): boolean {
  if (Math.abs(d) < 1e-6) return Math.abs(p) <= h;
  let a = (-h - p) / d;
  let b = (h - p) / d;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  if (a > range.t0) range.t0 = a;
  if (b < range.t1) range.t1 = b;
  return range.t0 <= range.t1;
}

// Distance along a ray to an oriented rectangle, or Infinity. No allocations: runs ~600 times a step.
function rayRect(ot: number, os: number, dt: number, ds: number, o: Obstacle): number {
  const rt = ot - o.t;
  const rs = os - o.s;
  // obstacle frame: u along its heading axis (ax, as), w across it
  range.t0 = -Infinity;
  range.t1 = Infinity;
  if (!slab(rt * o.ax + rs * o.as, dt * o.ax + ds * o.as, o.hl)) return Infinity;
  if (!slab(rt * o.as - rs * o.ax, dt * o.as - ds * o.ax, o.hw)) return Infinity;
  return range.t0 >= 0 ? range.t0 : range.t1 >= 0 ? 0 : Infinity;
}

export function SelfDrivingToy() {
  const cars = useRef<InstancedMesh>(null);
  const rays = useRef<InstancedMesh>(null);
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const boxBodies = useRef<(RapierRigidBody | null)[]>([]);
  const geometry = useMemo(carGeometry, []);
  const rayGeometry = useMemo(() => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0), []);
  const sims = useMemo<Sim[]>(
    () =>
      Array.from({ length: N_CARS }, (_, i) => ({
        active: false, wait: i * 1.1, s: 0, t: 0, heading: 0, v: 0, base: 1.9 + (i % 3) * 0.35, lane: i % 3,
        scale: 0, leaving: false, decide: 0, readings: [0, 0, 0, 0, 0], steer: 0, braking: false,
      })),
    [],
  );
  const obstacles = useMemo<Obstacle[]>(() => Array.from({ length: BOXES.length + N_CARS + 1 }, () => ({ t: 0, s: -99, ax: 0, as: 1, hl: 0, hw: 0 })), []);
  const quality = useStore((s) => s.quality);
  useHomeReset(boxBodies, 8, 10);

  useLayoutEffect(() => {
    const m = cars.current;
    if (!m) return;
    _s.setScalar(0);
    for (let i = 0; i < N_CARS; i++) m.setMatrixAt(i, _m.compose(_p.set(0, -5, 0), _q.identity(), _s));
    m.instanceMatrix.needsUpdate = true;
  }, []);

  // Obstacles in strip coordinates: traffic boxes (wherever they are now), other cars, the player.
  const gatherObstacles = () => {
    let k = 0;
    for (let i = 0; i < BOXES.length; i++) {
      const b = boxBodies.current[i];
      const o = obstacles[k++];
      if (!b) {
        o.s = -99;
        continue;
      }
      const p = b.translation();
      const lx = localX(p.x, p.z);
      const lz = localZ(p.x, p.z);
      const r = b.rotation();
      // long axis is the box's local Z: (sin yaw, cos yaw) in (x, z), (sin yaw, -cos yaw) in (t, s)
      const yaw = 2 * Math.atan2(r.y, r.w) - worldYaw(0);
      o.t = lx - STRIP.x;
      o.s = STRIP.z0 - lz;
      o.ax = Math.sin(yaw);
      o.as = -Math.cos(yaw);
      o.hl = BOX_HALF.l;
      o.hw = BOX_HALF.w;
    }
    for (let i = 0; i < N_CARS; i++) {
      const c = sims[i];
      const o = obstacles[k++];
      o.s = c.active ? c.s : -99;
      o.t = c.t;
      o.ax = Math.sin(c.heading);
      o.as = Math.cos(c.heading);
      o.hl = (CAR_L / 2) * c.scale;
      o.hw = (CAR_W / 2) * c.scale;
    }
    const o = obstacles[k];
    if (car.ready) {
      const yaw = car.yaw - worldYaw(0);
      o.t = carX() - STRIP.x;
      o.s = STRIP.z0 - carZ();
      o.ax = Math.cos(yaw);
      o.as = Math.sin(yaw);
      o.hl = 1.9;
      o.hw = 1.1;
    } else o.s = -99;
  };

  // Free distance ahead in lane `lane` for car i.
  const laneFree = (i: number, lane: number) => {
    const c = sims[i];
    const tl = LANES[lane];
    let free = 8;
    for (let k = 0; k < obstacles.length; k++) {
      if (k === BOXES.length + i) continue;
      const o = obstacles[k];
      if (o.s < -50) continue;
      const reach = Math.abs(o.ax) * o.hl + Math.abs(o.as) * o.hw; // half extent across the strip
      const along = Math.abs(o.as) * o.hl + Math.abs(o.ax) * o.hw;
      if (Math.abs(o.t - tl) > reach + CAR_W / 2 + 0.12) continue;
      const ds = o.s - along - (c.s + CAR_L / 2);
      if (ds < -CAR_L - along * 2) continue; // behind
      free = Math.min(free, Math.max(ds, 0));
    }
    return free;
  };

  useBeforePhysicsStep(() => {
    if (!carNearZone(20)) return;
    const dt = 1 / 60;
    gatherObstacles();
    for (let i = 0; i < N_CARS; i++) {
      const c = sims[i];
      const body = bodies.current[i];
      if (!c.active) {
        c.wait -= dt;
        if (c.wait <= 0) {
          // spawn in a lane with room at the bottom of the strip
          const lane = (i + Math.floor(performance.now() / 997)) % 3;
          let clear = true;
          for (const o of sims) if (o.active && o.s < 2.2 && Math.abs(o.t - LANES[lane]) < 0.9) clear = false;
          if (clear) {
            Object.assign(c, { active: true, s: 0.3, t: LANES[lane], heading: 0, v: c.base, lane, scale: 0, leaving: false, decide: 0 });
          } else c.wait = 0.4;
        }
        continue;
      }
      // sensors
      const ot = c.t + Math.sin(c.heading) * (CAR_L / 2);
      const os = c.s + Math.cos(c.heading) * (CAR_L / 2);
      for (let r = 0; r < RAYS; r++) {
        const a = c.heading + (r / (RAYS - 1) - 0.5) * 2 * RAY_SPREAD;
        const dt_ = Math.sin(a);
        const ds_ = Math.cos(a);
        let hit = RAY_LEN;
        for (let k = 0; k < obstacles.length; k++) {
          if (k === BOXES.length + i || obstacles[k].s < -50) continue;
          hit = Math.min(hit, rayRect(ot, os, dt_, ds_, obstacles[k]));
        }
        if (Math.abs(dt_) > 1e-4) {
          const edge = ((dt_ > 0 ? HALF_W : -HALF_W) - ot) / dt_;
          if (edge >= 0) hit = Math.min(hit, edge);
        }
        c.readings[r] = 1 - hit / RAY_LEN;
      }
      // lane choice, a few times a second
      c.decide -= dt;
      if (c.decide <= 0) {
        c.decide = 0.15;
        const here = laneFree(i, c.lane);
        if (here < 3.4) {
          let best = c.lane;
          let bestFree = here + 0.4;
          for (let l = c.lane - 1; l <= c.lane + 1; l += 2) {
            if (l < 0 || l > 2) continue;
            const f = laneFree(i, l);
            if (f > bestFree) {
              best = l;
              bestFree = f;
            }
          }
          c.lane = best;
        }
      }
      const target = Math.max(-0.55, Math.min(0.55, (LANES[c.lane] - c.t) * 1.1));
      c.steer = target;
      c.heading += Math.max(-2 * dt, Math.min(2 * dt, target - c.heading));
      const front = Math.max(c.readings[2], c.readings[1] * 0.8, c.readings[3] * 0.8);
      const vGoal = front > 0.72 ? 0 : front > 0.5 ? 0.5 : c.base;
      c.braking = vGoal < c.v - 0.3;
      c.v += Math.max(-5 * dt, Math.min(1.6 * dt, vGoal - c.v));
      c.s += c.v * Math.cos(c.heading) * dt;
      c.t = Math.max(-HALF_W + 0.36, Math.min(HALF_W - 0.36, c.t + c.v * Math.sin(c.heading) * dt));
      if (!c.leaving && c.s > STRIP.length - 0.9) c.leaving = true;
      c.scale = c.leaving ? Math.max(0, c.scale - dt / 0.35) : Math.min(1, c.scale + dt / 0.35);
      if (c.leaving && c.scale <= 0) {
        c.active = false;
        c.wait = 0.4 + ((i * 7) % 5) * 0.25;
        // park the body out of the way until the car respawns
        _pos.x = worldX(toLocalX(0), toLocalZ(-6 - i));
        _pos.y = -10;
        _pos.z = worldZ(toLocalX(0), toLocalZ(-6 - i));
        body?.setNextKinematicTranslation(_pos);
        continue;
      }
      if (body) {
        const lx = toLocalX(c.t);
        const lz = toLocalZ(c.s);
        const yaw = worldYaw(-c.heading);
        _pos.x = worldX(lx, lz);
        _pos.y = CAR_H / 2 + 0.02 - (1 - c.scale) * 0.5;
        _pos.z = worldZ(lx, lz);
        _rot.y = Math.sin(yaw / 2);
        _rot.w = Math.cos(yaw / 2);
        body.setNextKinematicTranslation(_pos);
        body.setNextKinematicRotation(_rot);
      }
    }
    // lead car drives the network board
    let lead = -1;
    for (let i = 0; i < N_CARS; i++) if (sims[i].active && sims[i].scale > 0.9 && (lead < 0 || sims[i].s > sims[lead].s)) lead = i;
    if (lead >= 0) {
      const c = sims[lead];
      for (let r = 0; r < RAYS; r++) network.inputs[r] = c.readings[r];
      network.outputs[0] = c.v > 0.4 ? 1 : 0;
      network.outputs[1] = c.steer < -0.08 ? 1 : 0;
      network.outputs[2] = c.steer > 0.08 ? 1 : 0;
      network.outputs[3] = c.braking ? 1 : 0;
      network.dirty = true;
    }
  });

  useFrame(() => {
    if (!carNearZone(20)) return;
    const m = cars.current;
    const rm = rays.current;
    if (!m || !rm) return;
    const showRays = quality !== 'low';
    for (let i = 0; i < N_CARS; i++) {
      const c = sims[i];
      const k = c.active ? c.scale : 0;
      _q.setFromAxisAngle(_up, -c.heading);
      m.setMatrixAt(i, _m.compose(_p.set(toLocalX(c.t), 0, toLocalZ(c.s)), _q, _s.setScalar(Math.max(k, 0.0001))));
      const ot = c.t + Math.sin(c.heading) * (CAR_L / 2) * k;
      const os = c.s + Math.cos(c.heading) * (CAR_L / 2) * k;
      for (let r = 0; r < RAYS; r++) {
        const a = c.heading + (r / (RAYS - 1) - 0.5) * 2 * RAY_SPREAD;
        const hit = (1 - c.readings[r]) * RAY_LEN;
        const visible = showRays && c.active && k > 0.6;
        const yaw = Math.atan2(Math.cos(a), Math.sin(a)); // local +X onto (sin a, -cos a)
        _q.setFromAxisAngle(_up, yaw);
        _p.set(toLocalX(ot), 0.32, toLocalZ(os));
        _s.set(visible ? Math.max(hit, 0.001) : 0.0001, 1, visible ? 0.045 : 0.0001);
        rm.setMatrixAt(i * RAYS * 2 + r * 2, _m.compose(_p, _q, _s));
        rm.setColorAt(i * RAYS * 2 + r * 2, YELLOW);
        _p.set(toLocalX(ot + Math.sin(a) * hit), 0.32, toLocalZ(os + Math.cos(a) * hit));
        _s.set(visible && hit < RAY_LEN - 0.01 ? RAY_LEN - hit : 0.0001, 1, visible ? 0.045 : 0.0001);
        rm.setMatrixAt(i * RAYS * 2 + r * 2 + 1, _m.compose(_p, _q, _s));
        rm.setColorAt(i * RAYS * 2 + r * 2 + 1, _c.copy(DARK));
      }
    }
    m.instanceMatrix.needsUpdate = true;
    rm.instanceMatrix.needsUpdate = true;
    if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
  });

  const midZ = STRIP.z0 - STRIP.length / 2;
  const markings = useMemo(() => {
    const parts: Part[] = [];
    const flat = (w: number, l: number) => new PlaneGeometry(w, l).rotateX(-Math.PI / 2);
    for (const side of [-1, 1]) parts.push({ g: flat(0.1, STRIP.length), color: '#ffffff', at: [STRIP.x + side * (HALF_W + 0.05), 0, midZ] });
    for (const t of [-STRIP.lane / 2, STRIP.lane / 2])
      for (let s = 0.4; s < STRIP.length - 0.4; s += 1.2) parts.push({ g: flat(0.09, 0.6), color: '#ffffff', at: [STRIP.x + t, 0, STRIP.z0 - s - 0.3] });
    return mergeParts(parts);
  }, [midZ]);
  return (
    <group>
      {/* road surface, edge lines, lane dashes */}
      <mesh position={[STRIP.x, Y.paint + 0.002, midZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALF_W * 2 + 0.5, STRIP.length]} />
        <meshStandardMaterial color="#d4d4d0" roughness={1} />
      </mesh>
      <mesh geometry={markings} position={[0, Y.paint + 0.004, 0]}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <instancedMesh ref={cars} args={[geometry, undefined, N_CARS]} castShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={rays} args={[rayGeometry, undefined, N_CARS * RAYS * 2]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {sims.map((_, i) => (
        <RigidBody key={i} ref={(b) => void (bodies.current[i] = b)} type="kinematicPosition" colliders={false} position={[0, -10 - i, 0]}>
          <CuboidCollider args={[CAR_W / 2, CAR_H / 2, CAR_L / 2]} />
        </RigidBody>
      ))}
      {BOXES.map((b, i) => (
        <RigidBody key={i} ref={(r) => void (boxBodies.current[i] = r)} colliders={false} position={[toLocalX(b.t), BOX_HALF.h + 0.02, toLocalZ(b.s)]}>
          <CuboidCollider args={[BOX_HALF.w, BOX_HALF.h, BOX_HALF.l]} mass={2.5} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[BOX_HALF.w * 2, BOX_HALF.h * 2, BOX_HALF.l * 2]} />
            <meshStandardMaterial color="#e5402f" roughness={0.6} />
          </mesh>
        </RigidBody>
      ))}
      <NetworkBoard position={[-7, 0, -15.6]} />
    </group>
  );
}
