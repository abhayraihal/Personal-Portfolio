import { useMemo, useState } from 'react';
import type { Ref } from 'react';
import type { Group, Material } from 'three';
import { Board } from '../../components/Board.tsx';
import { Label } from '../../components/Label.tsx';
import { COLORS } from '../../config/palette.ts';
import type { FontName } from '../../config/palette.ts';
import { BOARDS } from './copy.ts';
import { useBoxes } from './geo.ts';
import type { BoxSpec } from './geo.ts';
import type { StationId } from './layout.ts';
import { M } from './materials.ts';

type V3 = [number, number, number];

// Station board: the panel title and up to four short lines, standing at the back of the platform.
export function StationBoard({ id, position, width = 7.2, titleSize = 0.62, lift = 0.8 }: { id: StationId; position: V3; width?: number; titleSize?: number; lift?: number }) {
  const b = BOARDS[id];
  return (
    <Board
      title={b.title}
      lines={b.lines}
      width={width}
      titleSize={titleSize}
      lineSize={0.4}
      lift={lift}
      accent={COLORS.amazon}
      position={position}
    />
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
          if (bb) setW(Math.round((bb[2] - bb[0]) * 100) / 100);
        }}
      >
        {text}
      </Label>
    </group>
  );
}
