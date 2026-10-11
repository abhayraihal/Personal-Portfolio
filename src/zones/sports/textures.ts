// Small repeating textures drawn once: net mesh and chain-link fence. White on transparent, used
// with alphaTest so they need no sorting.
import { CanvasTexture, DoubleSide, MeshStandardMaterial, RepeatWrapping } from 'three';

function canvas(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  draw(g, size);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Square mesh: one cell per texture repeat.
export function netTexture(): CanvasTexture {
  return canvas(32, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, 3);
    g.fillRect(0, 0, 3, s);
  });
}

// Diamond chain link: one diamond per texture repeat.
export function chainTexture(): CanvasTexture {
  return canvas(64, (g, s) => {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, s / 2);
    g.lineTo(s / 2, 0);
    g.lineTo(s, s / 2);
    g.lineTo(s / 2, s);
    g.closePath();
    g.stroke();
  });
}

// Mesh material tinted by `color`; uv repeats are baked into each geometry's uv attribute.
export function meshMaterial(map: CanvasTexture, color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ map, color, alphaTest: 0.5, side: DoubleSide, roughness: 0.9 });
}
