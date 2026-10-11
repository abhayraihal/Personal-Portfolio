import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Label } from '../../components/Label.tsx';
import { useStore } from '../../state/store.ts';
import type { V3 } from '../career/kit/frame.ts';
import { box, cyl, flatMaterial, paint, paintMaterial } from '../career/kit/paint.ts';
import { formatLap, lap } from './lap.ts';

const W = 8.6;
const H = 2.9;
const Y = 2.75; // board centre
const D = 0.3;
const COL = [-2.85, 0, 2.85]; // panel centres
const PANEL_W = 2.55;

type TextMesh = { text: string; sync: () => void };

// Stadium board above the start line: goals scored on the pitch (the store keeps them in
// localStorage), the running lap time and the best lap.
export function Scoreboard({ position }: { position: V3 }) {
  const goals = useStore((s) => s.goals);
  const lapText = useRef<TextMesh | null>(null);
  const bestText = useRef<TextMesh | null>(null);
  const shown = useRef({ lap: '', best: '', check: 0 });
  const [frame, face] = useMemo(() => {
    const legH = Y - H / 2 + 0.2;
    const posts = paint([
      { geo: cyl(0.12, 0.14, legH, 10), color: '#3a3f4b', at: [-W / 2 + 0.8, legH / 2, -0.05] },
      { geo: cyl(0.12, 0.14, legH, 10), color: '#3a3f4b', at: [W / 2 - 0.8, legH / 2, -0.05] },
      { geo: box(W, H, D, 0.1), color: '#1f2a24', at: [0, Y, 0] },
      { geo: box(W + 0.24, 0.2, D + 0.14, 0.05), color: '#4caf50', at: [0, Y + H / 2 + 0.06, 0] },
      { geo: box(W + 0.24, 0.14, D + 0.1, 0.04), color: '#2f7d3a', at: [0, Y - H / 2 - 0.04, 0] },
    ]);
    const panels = paint(COL.flatMap((x) => [
      { geo: box(PANEL_W, 0.6, 0.02, 0), color: '#2f7d3a', at: [x, Y + H / 2 - 0.5, D / 2 + 0.01] as V3 },
      { geo: box(PANEL_W, 1.55, 0.02, 0), color: '#111613', at: [x, Y - 0.36, D / 2 + 0.01] as V3 },
    ]));
    return [posts, panels];
  }, []);

  // Lap and best change while driving: set the text on the meshes directly, a few times a second,
  // instead of re-rendering.
  useFrame((_, delta) => {
    const s = shown.current;
    s.check += delta;
    if (s.check < 0.1) return;
    s.check = 0;
    const lapStr = lap.running ? formatLap(performance.now() - lap.t0) : lap.last !== null ? formatLap(lap.last) : '--.-';
    const bestStr = lap.best !== null ? formatLap(lap.best) : '--.-';
    if (lapStr !== s.lap && lapText.current) {
      s.lap = lapStr;
      lapText.current.text = lapStr;
      lapText.current.sync();
    }
    if (bestStr !== s.best && bestText.current) {
      s.best = bestStr;
      bestText.current.text = bestStr;
      bestText.current.sync();
    }
  });

  const z = D / 2 + 0.04;
  const head = Y + H / 2 - 0.5;
  const value = Y - 0.34;
  return (
    <group position={position}>
      <mesh geometry={frame} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={face} material={flatMaterial} />
      {(['GOALS', 'LAP', 'BEST LAP'] as const).map((t, i) => (
        <Label key={t} font="bodyBold" size={0.4} color="#ffffff" position={[COL[i], head, z]}>
          {t}
        </Label>
      ))}
      <Label font="display" size={goals > 999 ? 0.85 : 1.2} color="#f2c230" position={[COL[0], value, z]}>
        {String(goals)}
      </Label>
      <Label ref={(m: unknown) => { lapText.current = m as TextMesh | null; }} font="display" size={1.05} color="#ffffff" position={[COL[1], value, z]}>
        --.-
      </Label>
      <Label ref={(m: unknown) => { bestText.current = m as TextMesh | null; }} font="display" size={1.05} color="#7fe08a" position={[COL[2], value, z]}>
        --.-
      </Label>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, H / 2, D / 2 + 0.05]} position={[0, Y, 0]} />
        <CuboidCollider args={[0.16, (Y - H / 2) / 2, 0.16]} position={[-W / 2 + 0.8, (Y - H / 2) / 2, -0.05]} />
        <CuboidCollider args={[0.16, (Y - H / 2) / 2, 0.16]} position={[W / 2 - 0.8, (Y - H / 2) / 2, -0.05]} />
      </RigidBody>
    </group>
  );
}
