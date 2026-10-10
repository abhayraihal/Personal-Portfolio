import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Label } from '../../components/Label.tsx';
import { useStore } from '../../state/store.ts';
import type { V3 } from '../career/kit/frame.ts';
import { box, cyl, flatMaterial, paint, paintMaterial } from '../career/kit/paint.ts';

const W = 4.6;
const H = 2.7;
const Y = 2.5; // board centre
const D = 0.3;

// Stadium-style board with the goal count from the store (it persists in localStorage).
export function Scoreboard({ position }: { position: V3 }) {
  const goals = useStore((s) => s.goals);
  const [frame, face] = useMemo(() => {
    const posts = paint([
      { geo: cyl(0.1, 0.12, Y - H / 2 + 0.2, 10), color: '#3a3f4b', at: [-W / 2 + 0.55, (Y - H / 2 + 0.2) / 2, -0.05] },
      { geo: cyl(0.1, 0.12, Y - H / 2 + 0.2, 10), color: '#3a3f4b', at: [W / 2 - 0.55, (Y - H / 2 + 0.2) / 2, -0.05] },
      { geo: box(W, H, D, 0.1), color: '#1f2a24', at: [0, Y, 0] },
      { geo: box(W + 0.2, 0.18, D + 0.12, 0.05), color: '#4caf50', at: [0, Y + H / 2 + 0.05, 0] },
    ]);
    const panel = paint([
      { geo: box(W - 0.3, 0.62, 0.02, 0), color: '#2f7d3a', at: [0, Y + H / 2 - 0.5, D / 2 + 0.01] },
      { geo: box(2.3, 1.45, 0.02, 0), color: '#111613', at: [0, Y - 0.38, D / 2 + 0.01] },
    ]);
    return [posts, panel];
  }, []);
  const z = D / 2 + 0.04;
  return (
    <group position={position}>
      <mesh geometry={frame} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={face} material={flatMaterial} />
      <Label font="bodyBold" size={0.42} color="#ffffff" position={[0, Y + H / 2 - 0.5, z]}>
        GOALS
      </Label>
      <Label font="display" size={1.25} color="#f2c230" position={[0, Y - 0.34, z]}>
        {String(goals)}
      </Label>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, H / 2, D / 2 + 0.05]} position={[0, Y, 0]} />
        <CuboidCollider args={[0.14, (Y - H / 2) / 2, 0.14]} position={[-W / 2 + 0.55, (Y - H / 2) / 2, -0.05]} />
        <CuboidCollider args={[0.14, (Y - H / 2) / 2, 0.14]} position={[W / 2 - 0.55, (Y - H / 2) / 2, -0.05]} />
      </RigidBody>
    </group>
  );
}
