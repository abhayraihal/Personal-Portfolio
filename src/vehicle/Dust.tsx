import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DynamicDrawUsage, Euler, IcosahedronGeometry, InstancedBufferAttribute, Matrix4, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { ROADS, ROUNDABOUT } from '../config/layout.ts';
import { worldToScreen } from '../config/world.ts';
import { car } from '../state/car.ts';
import { events } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { wheelFx } from './fx.ts';
import { DRIVE } from './tuning.ts';

// Dust puffs kicked up by the rear wheels (launches, boost, slides, hard braking, landings) and
// faint skid marks. Both are one InstancedMesh each with a fixed cap; nothing is allocated per frame.
const MAX_PUFFS = 72;
const MAX_SKIDS = 240;
const SKID_SEGMENT = 0.4; // m between skid mark points
const SKID_WIDTH = 0.3;

type Surface = 'asphalt' | 'dirt' | 'grass';
const DUST_COLOR: Record<Surface, Color> = {
  asphalt: new Color('#d8d6dd'),
  dirt: new Color('#d3b183'),
  grass: new Color('#ddd2ac'),
};

function distToSegment(u: number, v: number, a: [number, number], b: [number, number]): number {
  const du = b[0] - a[0];
  const dv = b[1] - a[1];
  const len2 = du * du + dv * dv;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[1]) * dv) / len2)) : 0;
  return Math.hypot(u - (a[0] + du * t), v - (a[1] + dv * t));
}

// What the tyres are on, from the shared road layout (screen coordinates).
function surfaceAt(x: number, z: number): Surface {
  const [u, v] = worldToScreen(x, z);
  if (Math.abs(Math.hypot(u - ROUNDABOUT.u, v - ROUNDABOUT.v) - ROUNDABOUT.r) < ROUNDABOUT.width / 2) return 'asphalt';
  for (const road of ROADS) {
    for (let i = 1; i < road.points.length; i++) {
      if (distToSegment(u, v, road.points[i - 1], road.points[i]) < road.width / 2) return road.kind === 'asphalt' ? 'asphalt' : 'dirt';
    }
  }
  return 'grass';
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

export function Dust() {
  const puffMesh = useRef<InstancedMesh>(null);
  const skidMesh = useRef<InstancedMesh>(null);
  const res = useMemo(() => {
    const puffGeo = new IcosahedronGeometry(1, 1);
    // Emissive lifts the shaded side so puffs read as soft dust, not stones.
    const puffMat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#5a5852' });
    const skidGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const skidMat = new MeshBasicMaterial({
      color: '#262830', transparent: true, opacity: 0.2, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    return { puffGeo, puffMat, skidGeo, skidMat };
  }, []);
  // Struct-of-arrays puff pool.
  const pool = useMemo(() => ({
    pos: new Float32Array(MAX_PUFFS * 3),
    vel: new Float32Array(MAX_PUFFS * 3),
    col: new Float32Array(MAX_PUFFS * 3),
    age: new Float32Array(MAX_PUFFS),
    life: new Float32Array(MAX_PUFFS), // 0 = free
    size: new Float32Array(MAX_PUFFS),
    rot: new Float32Array(MAX_PUFFS * 2),
    next: 0,
  }), []);
  const emitAcc = useRef([0, 0]);
  const skid = useRef({ active: [false, false], last: [new Vector3(), new Vector3()], next: 0, count: 0 });

  useEffect(() => () => {
    res.puffGeo.dispose();
    res.puffMat.dispose();
    res.skidGeo.dispose();
    res.skidMat.dispose();
  }, [res]);

  useEffect(() => {
    const pm = puffMesh.current;
    if (pm) {
      pm.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_PUFFS * 3), 3);
      pm.instanceColor.setUsage(DynamicDrawUsage);
      pm.instanceMatrix.setUsage(DynamicDrawUsage);
      pm.count = 0;
    }
    const sm = skidMesh.current;
    if (sm) sm.count = 0;
    // A teleport or reset must not draw a skid mark across the map.
    return events.on('teleported', () => {
      skid.current.active[0] = false;
      skid.current.active[1] = false;
    });
  }, []);

  const spawn = (x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, color: Color) => {
    const i = pool.next;
    pool.next = (pool.next + 1) % MAX_PUFFS;
    pool.pos[i * 3] = x;
    pool.pos[i * 3 + 1] = y;
    pool.pos[i * 3 + 2] = z;
    pool.vel[i * 3] = vx;
    pool.vel[i * 3 + 1] = vy;
    pool.vel[i * 3 + 2] = vz;
    const shade = 0.92 + Math.random() * 0.1;
    pool.col[i * 3] = color.r * shade;
    pool.col[i * 3 + 1] = color.g * shade;
    pool.col[i * 3 + 2] = color.b * shade;
    pool.age[i] = 0;
    pool.life[i] = life;
    pool.size[i] = size;
    pool.rot[i * 2] = Math.random() * Math.PI * 2;
    pool.rot[i * 2 + 1] = Math.random() * Math.PI * 2;
  };

  useFrame((_, delta) => {
    const pm = puffMesh.current;
    const sm = skidMesh.current;
    if (!pm || !sm || !car.ready) return;
    const dt = Math.min(delta, 0.05);
    const s = useStore.getState();
    const low = s.quality === 'low';
    const rateScale = (low ? 0.5 : 1) * (s.reducedMotion ? 0.6 : 1);
    const speed = Math.abs(car.speed);
    const fx = Math.cos(car.yaw);
    const fz = -Math.sin(car.yaw);
    const grounded = car.contacts >= 2 && !car.recovering;

    // Puffs per second per rear wheel.
    let rate = 0;
    if (grounded) {
      if (car.throttle > 0.6 && car.speed > -0.5 && speed < 6) rate = 6 + 14 * (1 - speed / 6);
      // Boost kicks dust while it pulls; the trail thins out towards boost top speed.
      if (car.boosting && speed > 2) rate = Math.max(rate, 14 * (1 - smoothstep(Math.min(speed / DRIVE.boostMaxSpeed, 1))));
      if (car.slip > 2.5) rate = Math.max(rate, Math.min(26, (car.slip - 2.5) * 7));
      if (car.brakeLight && car.throttle <= 0 && speed > 8) rate = Math.max(rate, 6);
    }
    rate *= rateScale;
    const surface = rate > 0 || wheelFx.landing > 0 ? surfaceAt(car.x, car.z) : 'grass';
    const color = DUST_COLOR[surface];
    for (let k = 0; k < 2; k++) {
      emitAcc.current[k] = rate > 0 ? emitAcc.current[k] + rate * dt : 0;
      while (emitAcc.current[k] >= 1) {
        emitAcc.current[k] -= 1;
        if (!wheelFx.contact[k]) continue;
        const p = wheelFx.point[k];
        const kickBack = 0.8 + Math.min(speed, 12) * 0.06 + (car.boosting ? 0.6 : 0);
        const side = (Math.random() - 0.5) * 1.8;
        const back = 0.3 + Math.random() * 0.3;
        const off = (Math.random() - 0.5) * 0.5;
        spawn(
          p[0] - fx * back + fz * off, p[1] + 0.1 + Math.random() * 0.15, p[2] - fz * back - fx * off,
          car.vx * 0.2 - fx * kickBack + fz * side, 0.4 + Math.random() * 0.8, car.vz * 0.2 - fz * kickBack - fx * side,
          0.1 + Math.random() * 0.16 + (car.boosting ? 0.05 : 0), 0.6 + Math.random() * 0.45, color,
        );
      }
    }

    // Landing: a ring of bigger puffs around the car.
    if (wheelFx.landing > 0) {
      const n = Math.round(Math.min(14, 5 + wheelFx.landing * 1.2) * (low ? 0.5 : 1));
      const groundY = Math.max(0, car.y - 1);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + Math.random() * 0.4;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // Ellipse around the 3.8 x 2.2 m footprint.
        const ox = ca * 2.0 * fx - sa * 1.2 * fz;
        const oz = ca * 2.0 * fz + sa * 1.2 * fx;
        const out = 1.4 + Math.random() * 1.2;
        spawn(car.x + ox, groundY + 0.2, car.z + oz, ox * out * 0.5, 0.5 + Math.random() * 0.5, oz * out * 0.5, 0.2 + Math.random() * 0.12, 0.7 + Math.random() * 0.3, color);
      }
      wheelFx.landing = 0;
    }

    // Integrate and pack the live puffs at the front of the instance buffer.
    let live = 0;
    const drag = Math.exp(-dt * 2.4);
    for (let i = 0; i < MAX_PUFFS; i++) {
      if (pool.life[i] <= 0) continue;
      pool.age[i] += dt;
      const t = pool.age[i] / pool.life[i];
      if (t >= 1) {
        pool.life[i] = 0;
        continue;
      }
      const j = i * 3;
      pool.vel[j] *= drag;
      pool.vel[j + 1] = pool.vel[j + 1] * drag + 0.5 * dt;
      pool.vel[j + 2] *= drag;
      pool.pos[j] += pool.vel[j] * dt;
      pool.pos[j + 1] += pool.vel[j + 1] * dt;
      pool.pos[j + 2] += pool.vel[j + 2] * dt;
      const grow = 1 - (1 - Math.min(t / 0.18, 1)) ** 2;
      const r = pool.size[i] * grow * (1 - t * t) * (1 + t * 1.3);
      _e.set(pool.rot[i * 2], pool.rot[i * 2 + 1] + t * 1.5, 0);
      _q.setFromEuler(_e);
      _p.set(pool.pos[j], Math.max(pool.pos[j + 1], r * 0.6), pool.pos[j + 2]);
      _s.setScalar(r);
      pm.setMatrixAt(live, _m.compose(_p, _q, _s));
      pm.setColorAt(live, _c.setRGB(pool.col[j], pool.col[j + 1], pool.col[j + 2]));
      live++;
    }
    pm.count = live;
    if (live > 0) {
      pm.instanceMatrix.needsUpdate = true;
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }

    // Skid marks from the rear tyres while sliding, braking hard or spinning up with boost.
    const marking = !low && grounded && (car.slip > 3.2 || (car.brakeLight && car.braking && speed > 7) || (car.boosting && car.throttle > 0.8 && speed < 5));
    sm.visible = !low;
    const sk = skid.current;
    let changed = false;
    for (let k = 0; k < 2; k++) {
      const p = wheelFx.point[k];
      if (!marking || !wheelFx.contact[k] || wheelFx.normalY[k] < 0.95) {
        sk.active[k] = false;
        continue;
      }
      const last = sk.last[k];
      if (!sk.active[k]) {
        last.set(p[0], p[1], p[2]);
        sk.active[k] = true;
        continue;
      }
      const dx = p[0] - last.x;
      const dz = p[2] - last.z;
      const len = Math.hypot(dx, dz);
      if (len < SKID_SEGMENT) continue;
      if (len > 3) {
        last.set(p[0], p[1], p[2]); // a gap (jump, teleport): start a new trail
        continue;
      }
      _p.set((p[0] + last.x) / 2, Math.max(p[1], last.y) + 0.03, (p[2] + last.z) / 2);
      _q.setFromAxisAngle(UP, Math.atan2(-dz, dx));
      _s.set(len + 0.02, 1, SKID_WIDTH);
      sm.setMatrixAt(sk.next, _m.compose(_p, _q, _s));
      sk.next = (sk.next + 1) % MAX_SKIDS;
      sk.count = Math.min(sk.count + 1, MAX_SKIDS);
      last.set(p[0], p[1], p[2]);
      changed = true;
    }
    if (changed) {
      sm.count = sk.count;
      sm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={puffMesh} args={[res.puffGeo, res.puffMat, MAX_PUFFS]} frustumCulled={false} />
      <instancedMesh ref={skidMesh} args={[res.skidGeo, res.skidMat, MAX_SKIDS]} frustumCulled={false} renderOrder={-1} />
    </>
  );
}
