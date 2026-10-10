import { RoundedBox, useTexture } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { SRGBColorSpace } from 'three';
import { COLORS } from '../config/palette.ts';
import { Label } from './Label.tsx';

export type BoardProps = {
  title?: string;
  lines?: string[];
  width?: number; // metres
  titleSize?: number;
  lineSize?: number;
  color?: string; // board face
  textColor?: string;
  accent?: string; // strip along the top edge
  image?: string; // URL; drawn above the text
  imageHeight?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  lift?: number; // gap between the ground and the board's bottom edge, filled by two posts
  collider?: boolean; // fixed collider so the car bumps into it (default true)
  align?: 'left' | 'center';
};

const DEPTH = 0.22;

function BoardImage({ url, width, height, y }: { url: string; width: number; height: number; y: number }) {
  const tex = useTexture(url);
  tex.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[0, y, DEPTH / 2 + 0.012]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// Upright sign on two posts, facing +Z (the camera, inside a ZoneFrame). Height grows with content.
export function Board({
  title, lines = [], width = 6, titleSize = 0.7, lineSize = 0.38, color = COLORS.paper, textColor = COLORS.ink,
  accent = COLORS.accent, image, imageHeight = 0, position = [0, 0, 0], rotation, lift = 1.2, collider = true,
  align = 'left',
}: BoardProps) {
  const pad = 0.4;
  const lineGap = lineSize * 1.45;
  const titleH = title ? titleSize * 1.3 : 0;
  const imgH = image ? imageHeight || width * 0.56 : 0;
  const textH = titleH + lines.length * lineGap;
  const height = pad * 2 + imgH + (imgH && textH ? 0.3 : 0) + textH;
  const cy = lift + height / 2;
  const top = height / 2 - pad;
  const x0 = align === 'left' ? -width / 2 + pad : 0;
  const anchorX = align === 'left' ? 'left' : 'center';
  return (
    <group position={position} rotation={rotation}>
      {collider && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[width / 2, height / 2, DEPTH / 2 + 0.05]} position={[0, cy, 0]} />
          <CuboidCollider args={[0.12, lift / 2, 0.12]} position={[-width / 2 + 0.45, lift / 2, 0]} />
          <CuboidCollider args={[0.12, lift / 2, 0.12]} position={[width / 2 - 0.45, lift / 2, 0]} />
        </RigidBody>
      )}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.45), lift / 2, -0.02]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, lift, 10]} />
          <meshStandardMaterial color={COLORS.inkSoft} roughness={0.8} />
        </mesh>
      ))}
      <group position={[0, cy, 0]}>
        <RoundedBox args={[width, height, DEPTH]} radius={0.08} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color={color} roughness={0.9} />
        </RoundedBox>
        <mesh position={[0, height / 2 - 0.06, DEPTH / 2 + 0.006]}>
          <planeGeometry args={[width - 0.16, 0.12]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        {image && <BoardImage url={image} width={width - pad * 2} height={imgH} y={top - imgH / 2} />}
        {title && (
          <Label font="display" size={titleSize} color={textColor} anchorX={anchorX} anchorY="top" maxWidth={width - pad * 2}
            position={[x0, top - imgH - (imgH ? 0.3 : 0), DEPTH / 2 + 0.01]}>
            {title}
          </Label>
        )}
        {lines.map((line, i) => (
          <Label key={i} size={lineSize} color={textColor} anchorX={anchorX} anchorY="top" maxWidth={width - pad * 2}
            position={[x0, top - imgH - (imgH ? 0.3 : 0) - titleH - i * lineGap, DEPTH / 2 + 0.01]}>
            {line}
          </Label>
        ))}
      </group>
    </group>
  );
}
