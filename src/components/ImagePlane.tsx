import { useTexture } from '@react-three/drei';
import type { ComponentProps } from 'react';
import { SRGBColorSpace } from 'three';

type Props = Omit<ComponentProps<'mesh'>, 'children'> & { url: string; width: number; height?: number; lit?: boolean };

// Picture on a plane, sized by width; height follows the image's aspect ratio unless given.
export function ImagePlane({ url, width, height, lit = false, ...rest }: Props) {
  const tex = useTexture(url);
  tex.colorSpace = SRGBColorSpace;
  const img = tex.image as { width?: number; height?: number } | undefined;
  const h = height ?? (img?.width && img.height ? (width * img.height) / img.width : width * 0.6);
  return (
    <mesh {...rest}>
      <planeGeometry args={[width, h]} />
      {lit ? <meshStandardMaterial map={tex} roughness={0.9} /> : <meshBasicMaterial map={tex} toneMapped={false} />}
    </mesh>
  );
}
