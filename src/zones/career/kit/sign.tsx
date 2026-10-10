import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { PlaneGeometry } from 'three';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import type { V3 } from './frame.ts';
import { box, cyl, flatMaterial, paint, paintMaterial, shade } from './paint.ts';

type SignProps = {
  title?: string;
  lines?: string[];
  width?: number;
  titleSize?: number;
  lineSize?: number;
  color?: string; // face
  textColor?: string;
  accent?: string; // strip along the top edge
  position?: V3;
  lift?: number; // gap between the ground and the bottom edge
};

const DEPTH = 0.22;
const PAD = 0.4;
const RIM = 0.07; // lit edge left around the face

// <Board> with the same layout and props, but an unlit face: lit, a paper face (#fff6e8) renders
// as a grey #c0bcae in this world's light. Two draw calls plus the text.
export function Sign({
  title, lines = [], width = 6, titleSize = 0.7, lineSize = 0.38, color = COLORS.paper, textColor = COLORS.ink,
  accent = COLORS.accent, position = [0, 0, 0], lift = 1.2,
}: SignProps) {
  const lineGap = lineSize * 1.45;
  const titleH = title ? titleSize * 1.3 : 0;
  const height = PAD * 2 + titleH + lines.length * lineGap;
  const cy = lift + height / 2;
  const postX = width / 2 - 0.45;
  const [frame, face] = useMemo(() => {
    const posts = [-1, 1].map((s) => ({ geo: cyl(0.09, 0.11, lift, 10), color: COLORS.inkSoft, at: [s * postX, lift / 2, -0.02] as V3 }));
    return [
      paint([...posts, { geo: box(width, height, DEPTH, 0.08, 2), color: shade(color, -0.08), at: [0, cy, 0] }]),
      paint([
        { geo: new PlaneGeometry(width - RIM * 2, height - RIM * 2), color, at: [0, cy, DEPTH / 2 + 0.004] },
        { geo: new PlaneGeometry(width - RIM * 2, 0.12), color: accent, at: [0, cy + height / 2 - RIM - 0.06, DEPTH / 2 + 0.008] },
      ]),
    ];
  }, [width, height, lift, cy, postX, color, accent]);

  const top = cy + height / 2 - PAD;
  const x0 = -width / 2 + PAD;
  const z = DEPTH / 2 + 0.012;
  return (
    <group position={position}>
      <mesh geometry={frame} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={face} material={flatMaterial} />
      {title && (
        <Label font="display" size={titleSize} color={textColor} anchorX="left" anchorY="top" maxWidth={width - PAD * 2} position={[x0, top, z]}>
          {title}
        </Label>
      )}
      {lines.map((line, i) => (
        <Label key={i} size={lineSize} color={textColor} anchorX="left" anchorY="top" maxWidth={width - PAD * 2}
          position={[x0, top - titleH - i * lineGap, z]}>
          {line}
        </Label>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2, height / 2, DEPTH / 2 + 0.05]} position={[0, cy, 0]} />
        <CuboidCollider args={[0.12, lift / 2, 0.12]} position={[-postX, lift / 2, 0]} />
        <CuboidCollider args={[0.12, lift / 2, 0.12]} position={[postX, lift / 2, 0]} />
      </RigidBody>
    </group>
  );
}
