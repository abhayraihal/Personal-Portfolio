import { useMemo } from 'react';
import { CanvasTexture } from 'three';

let shared: CanvasTexture | null = null;
function blobTexture() {
  if (shared) return shared;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  shared = new CanvasTexture(c);
  return shared;
}

// Soft fake shadow under an object, for the low quality tier or floating things.
export function BlobShadow({ size = 2, opacity = 1, position = [0, 0.02, 0] as [number, number, number] }) {
  const map = useMemo(blobTexture, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={map} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}
