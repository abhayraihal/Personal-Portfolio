import { useEffect, useMemo, useState } from 'react';
import type { Ref } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { Group, Material, MeshStandardMaterial } from 'three';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import type { FontName } from '../../config/palette.ts';
import { useStore } from '../../state/store.ts';
import { BOARDS } from './copy.ts';
import { useBoxes } from './geo.ts';
import type { BoxSpec } from './geo.ts';
import type { StationId } from './layout.ts';
import { M } from './materials.ts';
import { Static, staticChanged } from './merge.tsx';

type V3 = [number, number, number];

// Night: paper faces glow a little, like lit signs, so the dark text on them stays readable. The
// glow is warm, like the valley's lamps, so the boards do not turn grey under the blue night sky.
const NIGHT_GLOW = 0.5;
const NIGHT_TINT = '#ffe3b5';

function glow(m: MeshStandardMaterial, on: boolean) {
  m.emissive.set(on ? NIGHT_TINT : '#000000');
  m.emissiveIntensity = NIGHT_GLOW;
}

// The plaza's shared paper material (boards, plaques, the office band, the trophy plaque).
export function NightPaper() {
  const night = useStore((s) => s.night);
  useEffect(() => glow(M.paper, night), [night]);
  return null;
}

const PAD = 0.4;
const DEPTH = 0.22;
const LINE_GAP = 1.45; // line pitch as a multiple of the line size

// Station board: the panel title, up to four short lines and an optional bold result line, on two
// posts at the back of the platform. Same layout as the shared Board, but the panel, posts and
// accent strip are static trim (merged with the rest of the plaza) and the lines are one label.
export function StationBoard({ id, position, width = 7.2, titleSize = 0.62, lift = 0.8 }: { id: StationId; position: V3; width?: number; titleSize?: number; lift?: number }) {
  const b = BOARDS[id];
  const lineSize = 0.4;
  const gap = lineSize * LINE_GAP;
  const titleH = titleSize * 1.3;
  const rows = b.lines.length + (b.result ? 1 : 0);
  const height = PAD * 2 + titleH + rows * gap;
  const cy = lift + height / 2;
  const top = cy + height / 2 - PAD;
  const x0 = -width / 2 + PAD;
  const postX = width / 2 - 0.45;
  // Lines are spaced by lineHeight; the first one sits a little lower than a single label would.
  const lead = ((LINE_GAP - 1.2) / 2) * lineSize;
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2, height / 2, DEPTH / 2 + 0.05]} position={[0, cy, 0]} />
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.12, lift / 2, 0.12]} position={[s * postX, lift / 2, 0]} />
        ))}
      </RigidBody>
      <Static>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * postX, lift / 2, -0.02]} material={M.slate} castShadow>
            <cylinderGeometry args={[0.09, 0.11, lift, 10]} />
          </mesh>
        ))}
        <RoundedBox args={[width, height, DEPTH]} radius={0.08} smoothness={3} position={[0, cy, 0]} material={M.paper} castShadow receiveShadow />
        <mesh position={[0, cy + height / 2 - 0.06, DEPTH / 2 + 0.006]} material={M.accent}>
          <planeGeometry args={[width - 0.16, 0.12]} />
        </mesh>
      </Static>
      <Label font="display" size={titleSize} color={COLORS.ink} anchorX="left" anchorY="top" maxWidth={width - PAD * 2} position={[x0, top, DEPTH / 2 + 0.01]}>
        {b.title}
      </Label>
      <Label size={lineSize} color={COLORS.ink} anchorX="left" anchorY="top" lineHeight={LINE_GAP} maxWidth={width - PAD * 2} position={[x0, top - titleH + lead, DEPTH / 2 + 0.01]}>
        {b.lines.join('\n')}
      </Label>
      {b.result && (
        <Label font="bodyBold" size={lineSize} color={COLORS.ink} anchorX="left" anchorY="top" maxWidth={width - PAD * 2} position={[x0, top - titleH - b.lines.length * gap, DEPTH / 2 + 0.01]}>
          {b.result}
        </Label>
      )}
    </group>
  );
}

type PlaqueProps = {
  text: string;
  size?: number;
  font?: FontName;
  color?: string;
  material?: Material;
  position?: V3;
  rotation?: V3;
  pad?: number;
  depth?: number;
  legs?: number; // height of two legs under the plate, 0 = mounted on something
  groupRef?: Ref<Group>;
};

// A plate with one line of text that sizes itself to the text once troika has laid it out. The plate
// and its legs are one mesh.
export function Plaque({ text, size = 0.3, font = 'bodyBold', color = COLORS.ink, material = M.paper, position, rotation, pad = 0.14, depth = 0.08, legs = 0, groupRef }: PlaqueProps) {
  const [w, setW] = useState(() => text.length * size * 0.56);
  const h = size * 1.35 + pad;
  const specs = useMemo<BoxSpec[]>(() => {
    const list: BoxSpec[] = [[w + pad * 2, h, depth, 0, 0, -depth / 2]];
    if (legs > 0) {
      const lx = Math.max(0.2, w / 2 - 0.1);
      for (const s of [-1, 1]) list.push([0.08, legs, 0.08, s * lx, -h / 2 - legs / 2, -depth / 2]);
    }
    return list;
  }, [w, h, pad, depth, legs]);
  const geo = useBoxes(specs);
  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <mesh geometry={geo} material={material} />
      <Label
        font={font}
        size={size}
        color={color}
        position={[0, 0, 0.006]}
        onSync={(m: { textRenderInfo?: { blockBounds: number[] } | null }) => {
          const bb = m.textRenderInfo?.blockBounds;
          const next = bb ? Math.round((bb[2] - bb[0]) * 100) / 100 : w;
          if (next === w) return;
          setW(next);
          // A plaque under <Static> is baked into the plaza mesh, so a new width needs a fresh merge.
          staticChanged();
        }}
      >
        {text}
      </Label>
    </group>
  );
}
