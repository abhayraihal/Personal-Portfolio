// Posters drawn on a canvas for projects that have no screenshot: paper background, ink text,
// accent pink, plus a drawing. Text comes from profile.ts, the COVID chart from covid.ts.
import type { CanvasTexture } from 'three';
import { COLORS } from '../../config/palette.ts';
import { covid } from '../../data/covid.ts';
import { canvasTexture, cssFont, makeCanvas, roundRect, wrap } from './canvas.ts';

export type PosterArt = 'map' | 'weather' | 'covid';

const cache = new Map<string, CanvasTexture>();

function drawMap(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // A folded paper map (three panels with alternating fold heights) and a dashed route.
  const panels = 3;
  const pw = w / panels;
  for (let i = 0; i < panels; i++) {
    const up = i % 2 ? 14 : 0;
    const down = i % 2 ? 0 : 14;
    g.fillStyle = i % 2 ? '#e8dcc5' : '#f3e9d6';
    g.beginPath();
    g.moveTo(x + i * pw, y + up);
    g.lineTo(x + (i + 1) * pw, y + down);
    g.lineTo(x + (i + 1) * pw, y + h + down);
    g.lineTo(x + i * pw, y + h + up);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 6;
  g.strokeRect(x, y, w, h + 14);
  // Green blobs and a river.
  g.fillStyle = '#a9c47f';
  g.beginPath();
  g.ellipse(x + w * 0.25, y + h * 0.7, w * 0.16, h * 0.14, 0.3, 0, Math.PI * 2);
  g.ellipse(x + w * 0.78, y + h * 0.3, w * 0.13, h * 0.12, -0.4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.water;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(x + w * 0.05, y + h * 0.18);
  g.bezierCurveTo(x + w * 0.35, y + h * 0.3, x + w * 0.45, y + h * 0.05, x + w * 0.95, y + h * 0.2);
  g.stroke();
  // Route
  const pts: [number, number][] = [
    [x + w * 0.18, y + h * 0.82],
    [x + w * 0.5, y + h * 0.5],
    [x + w * 0.82, y + h * 0.62],
  ];
  g.setLineDash([16, 12]);
  g.strokeStyle = COLORS.accent;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(...pts[0]);
  g.quadraticCurveTo(x + w * 0.22, y + h * 0.45, pts[1][0], pts[1][1]);
  g.quadraticCurveTo(x + w * 0.7, y + h * 0.42, pts[2][0], pts[2][1]);
  g.stroke();
  g.setLineDash([]);
  for (const [px, py] of pts) {
    g.fillStyle = COLORS.accent;
    g.beginPath();
    g.arc(px, py - 34, 22, Math.PI * 0.85, Math.PI * 2.15);
    g.lineTo(px, py);
    g.closePath();
    g.fill();
    g.fillStyle = COLORS.paper;
    g.beginPath();
    g.arc(px, py - 36, 9, 0, Math.PI * 2);
    g.fill();
  }
}

function drawWeather(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Sun behind a cloud, and a thermometer.
  const cx = x + w * 0.42;
  const cy = y + h * 0.4;
  g.fillStyle = '#f2c230';
  g.strokeStyle = '#f2c230';
  g.lineWidth = 10;
  g.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80);
    g.lineTo(cx + Math.cos(a) * 108, cy + Math.sin(a) * 108);
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cy, 62, 0, Math.PI * 2);
  g.fill();
  // Cloud
  g.fillStyle = '#ffffff';
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 6;
  const bx = x + w * 0.5;
  const by = y + h * 0.66;
  g.beginPath();
  g.arc(bx - 70, by, 46, Math.PI * 0.5, Math.PI * 1.5);
  g.arc(bx - 20, by - 46, 56, Math.PI, Math.PI * 1.9);
  g.arc(bx + 50, by - 22, 44, Math.PI * 1.3, Math.PI * 0.1);
  g.arc(bx + 76, by + 8, 38, Math.PI * 1.6, Math.PI * 0.5);
  g.closePath();
  g.fill();
  g.stroke();
  // Thermometer
  const tx = x + w * 0.9;
  const ty = y + h * 0.12;
  g.fillStyle = '#ffffff';
  roundRect(g, tx - 18, ty, 36, h * 0.62, 18);
  g.fill();
  g.stroke();
  g.fillStyle = COLORS.accent;
  roundRect(g, tx - 8, ty + h * 0.25, 16, h * 0.4, 8);
  g.fill();
  g.beginPath();
  g.arc(tx, ty + h * 0.68, 32, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(tx, ty + h * 0.68, 20, 0, Math.PI * 2);
  g.fillStyle = COLORS.accent;
  g.fill();
}

function drawCovid(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // The real series from covid.ts as an area chart: training days teal, test days pink, split
  // where the project splits them (the first 65% of days).
  const d = covid.daily;
  const n = d.length;
  const split = n - Math.ceil(n * (1 - covid.trainShare));
  const max = Math.max(...d);
  const px = (i: number) => x + (i / (n - 1)) * w;
  const py = (v: number) => y + h - (v / max) * h * 0.92;
  const area = (i0: number, i1: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(px(i0), y + h);
    for (let i = i0; i <= i1; i++) g.lineTo(px(i), py(d[i]));
    g.lineTo(px(i1), y + h);
    g.closePath();
    g.fill();
  };
  area(0, split - 1, COLORS.water);
  area(split, n - 1, COLORS.accent);
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 4;
  g.setLineDash([12, 10]);
  g.beginPath();
  g.moveTo(px(split - 0.5), y);
  g.lineTo(px(split - 0.5), y + h);
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y + h);
  g.lineTo(x + w, y + h);
  g.stroke();
}

const ART: Record<PosterArt, typeof drawMap> = { map: drawMap, weather: drawWeather, covid: drawCovid };

// Billboard cover for a bay with no screenshot: the title and a large drawing, nothing else. The
// lectern in front already shows the tagline, year and stack at a readable size. 1024 x 600, the
// billboard image aspect. Call after loadCanvasFonts().
export function coverTexture(key: string, title: string, art: PosterArt): CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const [W, H] = [1024, 600];
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = COLORS.paper;
  g.fillRect(0, 0, W, H);
  g.fillStyle = COLORS.accent;
  g.fillRect(0, 0, 26, H);

  // Title in the left column, centred vertically, shrunk until every line fits.
  const left = 70;
  const colW = 410;
  let px = 116;
  let lines: string[] = [];
  for (;;) {
    g.font = cssFont('display', px);
    lines = wrap(g, title, colW);
    if ((lines.length <= 2 && lines.every((l) => g.measureText(l).width <= colW)) || px <= 70) break;
    px -= 4;
  }
  g.fillStyle = COLORS.ink;
  g.textBaseline = 'alphabetic';
  const lineH = px * 1.02;
  let y = H / 2 - (lines.length * lineH) / 2 + px * 0.8;
  for (const line of lines) {
    g.fillText(line, left, y);
    y += lineH;
  }

  // The drawing, scaled up from the slide layout's art box so line widths grow with it.
  const box = { x: 520, y: 56, w: 460, h: 470 };
  const k = Math.min(box.w / (1024 * 0.31), box.h / (600 * 0.54));
  g.save();
  g.translate(box.x, box.y);
  g.scale(k, k);
  ART[art](g, 0, 0, box.w / k, box.h / k);
  g.restore();

  const tex = canvasTexture(c, 8);
  cache.set(key, tex);
  return tex;
}
