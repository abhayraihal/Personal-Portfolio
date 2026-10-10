import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { Frustum, Matrix4, Sphere } from 'three';
import { car } from '../../state/car.ts';
import { events } from '../../state/events.ts';

// Group version of components/Resettable: every body in a group goes home in the same frame, and
// only while none of the displaced bodies (or their homes) is inside the camera frustum. Resetting
// one letter at a time can drop it inside a neighbour that is still lying on its spot.

type Vec = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };
type Entry = { body: RapierRigidBody; t: Vec; r: Quat; radius: number; home: boolean; riding: number };

export type HomeGroupOptions = {
  idleSeconds?: number; // displaced, still and out of view for this long before the reset
  carClear?: number; // the car must be at least this far (m) from every home and displaced body
};

export class HomeGroup {
  entries: Entry[] = [];
  idle = 0;
  readonly idleSeconds: number;
  readonly carClear: number;

  constructor({ idleSeconds = 4, carClear = 9 }: HomeGroupOptions = {}) {
    this.idleSeconds = idleSeconds;
    this.carClear = carClear;
  }

  add(body: RapierRigidBody, radius: number) {
    if (this.entries.some((e) => e.body === body)) return;
    const t = body.translation();
    const r = body.rotation();
    this.entries.push({ body, t: { x: t.x, y: t.y, z: t.z }, r: { x: r.x, y: r.y, z: r.z, w: r.w }, radius, home: true, riding: 0 });
    // Start asleep: stacked bricks and standing letters stay exactly where they were placed until
    // something touches them.
    body.sleep();
  }

  // Bodies currently touching the car (kept by HubBody's collision events).
  readonly touchingCar = new Set<RapierRigidBody>();

  // Listeners hear when the group goes from all-home to partly displaced and back.
  private displaced = false;
  readonly listeners = new Set<(displaced: boolean) => void>();
  setDisplaced(d: boolean) {
    if (d === this.displaced) return;
    this.displaced = d;
    for (const f of this.listeners) f(d);
  }

  remove(body: RapierRigidBody) {
    this.entries = this.entries.filter((e) => e.body !== body);
    this.touchingCar.delete(body);
  }

  // True when the car (at x, z) is close to a home or to a displaced body.
  carNear(x: number, z: number): boolean {
    for (const e of this.entries) {
      if (Math.hypot(x - e.t.x, z - e.t.z) < this.carClear) return true;
      if (!e.home) {
        const p = e.body.translation();
        if (Math.hypot(x - p.x, z - p.z) < this.carClear) return true;
      }
    }
    return false;
  }

  // Moved bodies are left awake for a few frames: the physics wrapper only copies awake bodies
  // to their meshes, so sleeping them straight away would leave the meshes where they were.
  resetAll() {
    for (const e of this.entries) {
      const b = e.body;
      b.setTranslation(e.t, true);
      b.setRotation(e.r, true);
      b.setLinvel(ZERO, true);
      b.setAngvel(ZERO, true);
      e.home = true;
    }
    this.idle = 0;
    this.sleepAt = performance.now() + 150;
    this.setDisplaced(false);
  }

  sleepAt = 0;

  sleepAll() {
    for (const e of this.entries) e.body.sleep();
    this.sleepAt = 0;
  }
}

const ZERO = { x: 0, y: 0, z: 0 };
const _frustum = new Frustum();
const _m = new Matrix4();
const _sphere = new Sphere();

// Registers a rigid body with a group once it exists and has its spawn transform.
export function useHome(group: HomeGroup, radius: number) {
  const ref = useRef<RapierRigidBody>(null);
  useEffect(() => {
    let added: RapierRigidBody | null = null;
    // One frame later the body has been moved to its place inside the zone frame.
    const id = requestAnimationFrame(() => {
      added = ref.current;
      if (added) group.add(added, radius);
    });
    return () => {
      cancelAnimationFrame(id);
      if (added) group.remove(added);
    };
  }, [group, radius]);
  return ref;
}

function seen(frustum: Frustum, p: Vec, radius: number) {
  _sphere.center.set(p.x, p.y, p.z);
  _sphere.radius = radius;
  return frustum.intersectsSphere(_sphere);
}

// Drives a group: call once per group, anywhere under the Canvas.
export function useHomeGroup(group: HomeGroup) {
  const acc = useRef(0);

  // A teleport or reset is a camera cut, so the group can go home right away.
  useEffect(
    () =>
      events.on('teleported', ({ x, z }) => {
        if (group.entries.some((e) => !e.home) && !group.carNear(x, z)) group.resetAll();
      }),
    [group],
  );

  useFrame(({ camera }, delta) => {
    if (group.sleepAt && performance.now() > group.sleepAt) group.sleepAll();
    acc.current += delta;
    if (acc.current < 0.25) return;
    const dt = acc.current;
    acc.current = 0;

    camera.updateMatrixWorld();
    _frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

    let away = false;
    let still = true;
    let visible = false;
    let fell = false;
    for (const e of group.entries) {
      const b = e.body;
      if (e.home && b.isSleeping()) continue;
      const t = b.translation();
      const r = b.rotation();
      const dot = Math.abs(r.x * e.r.x + r.y * e.r.y + r.z * e.r.z + r.w * e.r.w);
      e.home = Math.hypot(t.x - e.t.x, t.y - e.t.y, t.z - e.t.z) < 0.25 && dot > 0.996;
      if (e.home) continue;
      away = true;
      if (t.y < -10) fell = true;
      // Something left on the car's bonnet or roof would ride along forever, always in view, and
      // keep its group from going home. After a moment it slides off sideways.
      if (group.touchingCar.has(b) && t.y > car.y + 0.4) {
        e.riding += dt;
        if (e.riding > 1.5) {
          e.riding = 0;
          const side = Math.random() < 0.5 ? -1 : 1;
          const sx = -Math.sin(car.yaw) * side;
          const sz = -Math.cos(car.yaw) * side;
          b.setLinvel({ x: car.vx + sx * 3.5, y: 1.5, z: car.vz + sz * 3.5 }, true);
        }
      } else e.riding = 0;
      if (!b.isSleeping()) {
        const v = b.linvel();
        if (v.x * v.x + v.y * v.y + v.z * v.z > 0.09) still = false;
      }
      if (!visible && (seen(_frustum, t, e.radius) || seen(_frustum, e.t, e.radius))) visible = true;
    }
    group.setDisplaced(away);
    if (!away) {
      group.idle = 0;
      return;
    }
    if (fell) {
      group.resetAll();
      return;
    }
    if (still && !visible && !group.carNear(car.x, car.z)) group.idle += dt;
    else group.idle = 0;
    if (group.idle > group.idleSeconds) group.resetAll();
  });
}
