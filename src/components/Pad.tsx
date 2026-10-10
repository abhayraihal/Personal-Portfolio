import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { COLORS } from '../config/palette.ts';
import { car } from '../state/car.ts';
import { playSound } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import type { Action } from '../state/store.ts';
import { Label } from './Label.tsx';

export type PadProps = {
  id: string; // unique across the world
  label: string; // shown in the interact prompt, e.g. 'Read about Razorpay'
  action: Action; // what Enter / tap does
  position?: [number, number, number];
  radius?: number;
  color?: string;
  icon?: string; // short text painted on the pad
  stopSpeed?: number; // the car must be slower than this (m/s) to focus the pad
  onEnter?: () => void; // car parked on the pad (focus gained)
  onLeave?: () => void;
  hidden?: boolean; // logic only, no ring
};

const _p = new Vector3();

// Ground pad: drive onto it and slow down, the UI shows "Enter: <label>". Uses a distance check
// against the car telemetry, not a physics sensor.
export function Pad({ id, label, action, position = [0, 0, 0], radius = 2.6, color = COLORS.accent, icon, stopSpeed = 4, onEnter, onLeave, hidden }: PadProps) {
  const ref = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const world = useRef(new Vector3());
  const state = useRef({ inside: false, focused: false, slowFor: 0, pulse: 0 });
  const latest = useRef({ label, action, onEnter, onLeave });
  latest.current = { label, action, onEnter, onLeave };

  useLayoutEffect(() => {
    ref.current?.updateWorldMatrix(true, false);
    ref.current?.getWorldPosition(world.current);
  }, []);

  useFrame((_, delta) => {
    const s = state.current;
    const w = world.current;
    const d = Math.hypot(car.x - w.x, car.z - w.z);
    const inside = car.ready && d < radius;
    if (inside && Math.abs(car.speed) < stopSpeed) s.slowFor += delta;
    else s.slowFor = 0;
    if (!s.focused && inside && s.slowFor > 0.2) {
      s.focused = true;
      useStore.getState().setFocus({ id, label: latest.current.label, action: latest.current.action });
      playSound('pad');
      latest.current.onEnter?.();
    } else if (s.focused && d > radius + 0.6) {
      s.focused = false;
      useStore.getState().clearFocus(id);
      latest.current.onLeave?.();
    }
    s.pulse += delta * (s.focused ? 4 : 1.5);
    if (ring.current) {
      const m = ring.current.material as MeshBasicMaterial;
      m.opacity = s.focused ? 0.85 + Math.sin(s.pulse) * 0.15 : 0.45 + Math.sin(s.pulse) * 0.1;
      _p.setScalar(s.focused ? 1.06 : 1);
      ring.current.scale.lerp(_p, 0.2);
    }
  });

  useLayoutEffect(() => () => useStore.getState().clearFocus(id), [id]);

  return (
    <group ref={ref} position={position}>
      {!hidden && (
        <>
          <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <ringGeometry args={[radius - 0.28, radius, 48]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[radius - 0.28, 48]} />
            <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} toneMapped={false} />
          </mesh>
          {icon && (
            <Label flat font="bodyBold" size={radius * 0.28} color={color} position={[0, 0.05, 0]} maxWidth={radius * 1.6} textAlign="center">
              {icon}
            </Label>
          )}
        </>
      )}
    </group>
  );
}
