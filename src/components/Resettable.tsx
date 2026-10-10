import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody, RigidBodyProps } from '@react-three/rapier';
import { car } from '../state/car.ts';

type Props = RigidBodyProps & {
  children: ReactNode;
  idleSeconds?: number; // how long it must sit displaced, with the car away, before it goes home
  carDistance?: number; // the car must be at least this far (m) away
};

type Home = { t: { x: number; y: number; z: number }; r: { x: number; y: number; z: number; w: number } };

// A dynamic body that returns to where it started once the car has left it alone for a while
// (letters, skill bricks, crates). It snaps back while nobody is looking closely.
export function Resettable({ children, idleSeconds = 14, carDistance = 14, ...props }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const home = useRef<Home | null>(null);
  const idle = useRef(0);
  const check = useRef(0);

  useEffect(() => {
    // Record the spawn transform once the body exists (after parent transforms are applied).
    const id = requestAnimationFrame(() => {
      const b = body.current;
      if (b) home.current = { t: { ...b.translation() }, r: { ...b.rotation() } };
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useFrame((_, delta) => {
    check.current += delta;
    if (check.current < 0.25) return;
    const dt = check.current;
    check.current = 0;
    const b = body.current;
    const h = home.current;
    if (!b || !h) return;
    const t = b.translation();
    const r = b.rotation();
    const moved = Math.hypot(t.x - h.t.x, t.y - h.t.y, t.z - h.t.z) > 0.4 || Math.abs(r.x * h.r.x + r.y * h.r.y + r.z * h.r.z + r.w * h.r.w) < 0.985;
    const far = Math.hypot(car.x - h.t.x, car.z - h.t.z) > carDistance;
    const v = b.linvel();
    const still = Math.hypot(v.x, v.y, v.z) < 0.3;
    if (moved && far && still) idle.current += dt;
    else idle.current = 0;
    if (idle.current > idleSeconds || t.y < -10) {
      idle.current = 0;
      b.setTranslation(h.t, true);
      b.setRotation(h.r, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  return (
    <RigidBody ref={body} {...props}>
      {children}
    </RigidBody>
  );
}
