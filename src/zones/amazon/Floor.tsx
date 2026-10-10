import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { COLORS } from '../../config/palette.ts';
import { PLAZA_RADIUS, STATIONS } from './layout.ts';

export const FLOOR_Y = 0.03; // above the world's road strips (y 0.02), below pads (lifted to 0.03)

const LOOP_IN = 7;
const LOOP_OUT = 13.6;
const ISLAND = 3.2;

// Paving drawn once into a canvas: concentric pavers, a promenade ring that links the pads, an
// orange rim, and lighter aprons under the exhibit platforms.
function paint(size: number) {
  const R = PLAZA_RADIUS;
  const k = size / (2 * R);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const X = (u: number) => (u + R) * k;
  const Y = (v: number) => (R - v) * k;
  const disc = (r: number, fill: string) => {
    g.beginPath();
    g.arc(X(0), Y(0), r * k, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };

  g.fillStyle = '#efe3cb';
  g.fillRect(0, 0, size, size);
  disc(R, '#f1e6cf');
  disc(LOOP_OUT, '#e4d2b2');
  disc(LOOP_IN, '#f1e6cf');
  disc(ISLAND, '#dcc8a5');
  disc(ISLAND - 0.5, '#e9d9bb');

  // Paver joints: rings every 1.25 m and radial joints about every 1.6 m of arc.
  g.strokeStyle = 'rgba(80, 60, 30, 0.10)';
  g.lineWidth = Math.max(1, k * 0.06);
  for (let r = 1.25; r < R - 0.6; r += 1.25) {
    g.beginPath();
    g.arc(X(0), Y(0), r * k, 0, Math.PI * 2);
    g.stroke();
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / 1.6));
    const off = (r / 1.25) % 2 ? 0.5 : 0; // stagger like laid bricks
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = ((i + off) / n) * Math.PI * 2;
      g.moveTo(X(Math.cos(a) * r), Y(Math.sin(a) * r));
      g.lineTo(X(Math.cos(a) * (r + 1.25)), Y(Math.sin(a) * (r + 1.25)));
    }
    g.stroke();
  }

  // Promenade edges: thin orange lines with a dash pattern.
  g.strokeStyle = 'rgba(255, 153, 0, 0.55)';
  g.lineWidth = k * 0.16;
  g.setLineDash([k * 1.2, k * 0.8]);
  for (const r of [LOOP_IN, LOOP_OUT]) {
    g.beginPath();
    g.arc(X(0), Y(0), r * k, 0, Math.PI * 2);
    g.stroke();
  }
  g.setLineDash([]);

  // Aprons under the exhibit platforms (slightly larger than the platforms).
  g.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (const s of STATIONS) {
    const [w, d] = s.size;
    const m = 0.7;
    const x0 = X(s.center[0] - w / 2 - m);
    const y0 = Y(s.center[1] + d / 2 + m);
    roundRect(g, x0, y0, (w + 2 * m) * k, (d + 2 * m) * k, k * 1.2);
    g.fill();
  }

  // Rim: orange band with a darker outer edge.
  g.beginPath();
  g.arc(X(0), Y(0), (R - 0.45) * k, 0, Math.PI * 2);
  g.strokeStyle = COLORS.amazon;
  g.lineWidth = k * 0.9;
  g.stroke();
  g.beginPath();
  g.arc(X(0), Y(0), (R - 0.04) * k, 0, Math.PI * 2);
  g.strokeStyle = '#c8740a';
  g.lineWidth = k * 0.1;
  g.stroke();
  return c;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function Floor() {
  const gl = useThree((s) => s.gl);
  const map = useMemo(() => {
    const t = new CanvasTexture(paint(1024));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [gl]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
      <circleGeometry args={[PLAZA_RADIUS, 96]} />
      <meshStandardMaterial map={map} roughness={0.95} />
    </mesh>
  );
}
