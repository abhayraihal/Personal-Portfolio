import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Material } from 'three';
import { carNearZone, carX, carZ } from './frame.ts';

const FADED = 0.22;

// From the fixed 45-degree camera a tall board hides the ground behind it for about its own
// height. While the car is in that strip (zone-local: within halfW + 1.6 m of x, between z and
// z - hides - 1) the materials fade, so the car never disappears behind it. They stay transparent
// at full opacity otherwise, so fading never recompiles a shader. Returns one ref callback per
// material.
export function useBehindFade(x: number, z: number, halfW: number, hides: number, count: number) {
  const mats = useRef<(Material | null)[]>([]);
  const k = useRef(1);
  useFrame((_, delta) => {
    const near = carNearZone();
    const cz = carZ();
    const behind = near && Math.abs(carX() - x) < halfW + 1.6 && cz < z && cz > z - hides - 1;
    const goal = behind ? FADED : 1;
    if (k.current === goal) return;
    // fade while the car is around; snap back once it has left (a teleport out, say)
    const next = near ? k.current + (goal - k.current) * Math.min(1, delta * 8) : goal;
    k.current = Math.abs(goal - next) < 0.01 ? goal : next;
    for (const m of mats.current) {
      if (!m) continue;
      m.opacity = k.current;
      m.depthWrite = k.current === 1;
    }
  });
  return useMemo(() => Array.from({ length: count }, (_, i) => (m: Material | null) => void (mats.current[i] = m)), [count]);
}
