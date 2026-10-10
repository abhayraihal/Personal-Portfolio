import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { car } from '../../state/car.ts';

type Home = { t: { x: number; y: number; z: number }; r: { x: number; y: number; z: number; w: number } };

// Same rule as <Resettable>, for a list of bodies the caller also needs refs to (traffic boxes,
// instanced crates and cones): a body that was knocked away goes home once it has been still for
// `idleSeconds` with the car at least `carDistance` away.
export function useHomeReset(bodies: RefObject<(RapierRigidBody | null)[]>, idleSeconds = 12, carDistance = 14) {
  const homes = useRef<(Home | null)[]>([]);
  const idle = useRef<number[]>([]);
  const check = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bodies.current.forEach((b, i) => {
        if (b) homes.current[i] = { t: { ...b.translation() }, r: { ...b.rotation() } };
        idle.current[i] = 0;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [bodies]);

  useFrame((_, delta) => {
    check.current += delta;
    if (check.current < 0.25) return;
    const dt = check.current;
    check.current = 0;
    const list = bodies.current;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const h = homes.current[i];
      if (!b || !h) continue;
      if (b.isSleeping() && idle.current[i] === 0 && atHome(b, h)) continue;
      const t = b.translation();
      const v = b.linvel();
      const moved = !atHome(b, h);
      const far = Math.hypot(car.x - h.t.x, car.z - h.t.z) > carDistance;
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

function atHome(b: RapierRigidBody, h: Home) {
  const t = b.translation();
  const r = b.rotation();
  return Math.hypot(t.x - h.t.x, t.y - h.t.y, t.z - h.t.z) <= 0.4 && Math.abs(r.x * h.r.x + r.y * h.r.y + r.z * h.r.z + r.w * h.r.w) >= 0.985;
}
