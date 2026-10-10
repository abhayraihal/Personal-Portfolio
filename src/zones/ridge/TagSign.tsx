import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import { codeforces } from '../../data/codeforces.ts';
import { useStore } from '../../state/store.ts';

const TAGS = codeforces.topTags.slice(0, 6);
const TIP = 0.5;
const PLANK_H = 0.62;
const GAP = 0.12;
const BASE = 1.25; // height of the lowest plank's underside
const ROW = PLANK_H + GAP;
const POST_H = BASE + (TAGS.length + 1) * ROW + 0.25; // a header row, then one plank per tag
const TEXT = 0.34;
const HEAD = 'Most-solved tags';
const HEAD_TEXT = 0.36;
const HEAD_W = HEAD.length * HEAD_TEXT * 0.5 + 0.8; // Lilita One averages about half an em per character
// Rubik Bold averages a little over half an em per character; each plank is cut to its label.
const plankLength = (text: string) => Math.max(3, text.length * TEXT * 0.56 + TIP + 0.6);

function plankGeometry(len: number) {
  const s = new Shape();
  s.moveTo(0, -PLANK_H / 2);
  s.lineTo(len - TIP, -PLANK_H / 2);
  s.lineTo(len, 0);
  s.lineTo(len - TIP, PLANK_H / 2);
  s.lineTo(0, PLANK_H / 2);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1 });
  g.translate(0, 0, -0.06);
  return g;
}

// A trail signpost: a header board, then one arrow per most-solved tag, pointing alternately left
// and right.
export function TagSign({ position }: { position: [number, number, number] }) {
  // Text is unlit, so ink that reads on the wood by day is lost on it at night.
  const ink = useStore((st) => (st.night ? COLORS.paper : COLORS.ink));
  const parts = useMemo(
    () => ({
      planks: TAGS.map(([tag, count]) => {
        const text = `${tag} · ${count}`;
        const len = plankLength(text);
        return { tag, text, len, geometry: plankGeometry(len) };
      }),
      wood: new MeshStandardMaterial({ color: '#d9a066', roughness: 0.9 }),
      post: new MeshStandardMaterial({ color: '#9b6a3c', roughness: 1 }),
    }),
    [],
  );
  return (
    <group position={position}>
      <mesh position={[0, POST_H / 2, 0]} material={parts.post} castShadow receiveShadow>
        <boxGeometry args={[0.26, POST_H, 0.26]} />
      </mesh>
      <mesh position={[0, POST_H + 0.05, 0]} material={parts.post} castShadow>
        <coneGeometry args={[0.24, 0.3, 4]} />
      </mesh>
      <group position={[0, POST_H - 0.25 - PLANK_H / 2, 0.2]}>
        <mesh material={parts.post} castShadow receiveShadow>
          <boxGeometry args={[HEAD_W, PLANK_H, 0.14]} />
        </mesh>
        <Label font="display" size={HEAD_TEXT} color={COLORS.paper} position={[0, 0, 0.08]}>
          {HEAD}
        </Label>
      </group>
      {parts.planks.map(({ tag, text, len, geometry }, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        const y = POST_H - 0.25 - PLANK_H / 2 - (i + 1) * ROW;
        return (
          <group key={tag} position={[dir * 0.06, y, 0.2]}>
            <mesh geometry={geometry} material={parts.wood} scale={[dir, 1, 1]} castShadow receiveShadow />
            <Label font="bodyBold" size={TEXT} color={ink} position={[dir * (len - TIP) * 0.5, 0, 0.1]}>
              {text}
            </Label>
          </group>
        );
      })}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.16, POST_H / 2, 0.16]} position={[0, POST_H / 2, 0]} />
      </RigidBody>
    </group>
  );
}
