import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { car } from '../../state/car.ts';

type Home = { t: { x: number; y: number; z: number }; r: { x: number; y: number; z: number; w: number } };

// <Resettable>'s rules for a set of bodies (e.g. InstancedRigidBodies): each body goes home once it
// has sat displaced and still for `idleSeconds` with the car at least `carDistance` away.
export function useHomeReset(bodies: RefObject<(RapierRigidBody | null)[] | null>, idleSeconds = 14, carDistance = 14) {
  const homes = useRef<(Home | null)[]>([]);
  const idle = useRef<number[]>([]);
  const acc = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const list = bodies.current ?? [];
      homes.current = list.map((b) => (b ? { t: { ...b.translation() }, r: { ...b.rotation() } } : null));
      idle.current = list.map(() => 0);
    });
    return () => cancelAnimationFrame(id);
  }, [bodies]);

  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.25) return;
    const dt = acc.current;
    acc.current = 0;
    const list = bodies.current;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const h = homes.current[i];
      if (!b || !h) continue;
      const t = b.translation();
      const r = b.rotation();
      const moved = Math.hypot(t.x - h.t.x, t.y - h.t.y, t.z - h.t.z) > 0.4 || Math.abs(r.x * h.r.x + r.y * h.r.y + r.z * h.r.z + r.w * h.r.w) < 0.985;
      const far = Math.hypot(car.x - h.t.x, car.z - h.t.z) > carDistance;
      const v = b.linvel();
      const still = Math.hypot(v.x, v.y, v.z) < 0.3;
      idle.current[i] = moved && far && still ? idle.current[i] + dt : 0;
      if (idle.current[i] > idleSeconds || t.y < -10) {
        idle.current[i] = 0;
        b.setTranslation(h.t, true);
        b.setRotation(h.r, true);
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  });
}
