// Posters drawn on a canvas for projects that have no screenshot: paper background, ink text,
// accent pink, plus a small drawn illustration. Text comes from profile.ts.
import type { CanvasTexture } from 'three';
import { COLORS } from '../../config/palette.ts';
import { canvasTexture, cssFont, makeCanvas, roundRect, wrap } from './canvas.ts';

export type PosterArt = 'map' | 'weather' | 'chart';

export type PosterSpec = {
  title: string;
  tagline: string;
  chips: string[];
  year: number;
  art: PosterArt;
};

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

function drawChart(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // An icon of a line chart with a dashed continuation. Decoration, not data.
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y + h);
  g.lineTo(x + w, y + h);
  g.stroke();
  const pts = [0.05, 0.75, 0.2, 0.6, 0.32, 0.68, 0.45, 0.35, 0.58, 0.48, 0.7, 0.3];
  g.strokeStyle = COLORS.accent;
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const px = x + pts[i] * w;
    const py = y + pts[i + 1] * h;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  g.setLineDash([14, 12]);
  g.beginPath();
  g.moveTo(x + 0.7 * w, y + 0.3 * h);
  g.lineTo(x + 0.84 * w, y + 0.38 * h);
  g.lineTo(x + 0.96 * w, y + 0.22 * h);
  g.stroke();
  g.setLineDash([]);
}

const ART: Record<PosterArt, typeof drawMap> = { map: drawMap, weather: drawWeather, chart: drawChart };

// 1024 x 600 poster, matching the billboard image area (6.0 x 3.5 m). Call after loadCanvasFonts().
export function posterTexture(key: string, spec: PosterSpec, size: [number, number] = [1024, 600]): CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const [W, H] = size;
  const [c, g] = makeCanvas(W, H);
  const s = W / 1024;
  g.fillStyle = COLORS.paper;
  g.fillRect(0, 0, W, H);
  // Pink band down the left edge.
  g.fillStyle = COLORS.accent;
  g.fillRect(0, 0, 26 * s, H);

  const left = 70 * s;
  const colW = W * 0.6 - left;
  const bottom = H - 40 * s;

  // Chip rows first, so they can sit on the bottom edge whatever the text above does.
  const chipH = 52 * s;
  const chipGap = 12 * s;
  g.font = cssFont('bodyBold', 32 * s);
  const rows: { text: string; w: number; x: number }[][] = [];
  let row: { text: string; w: number; x: number }[] = [];
  let cx = left;
  for (const chip of spec.chips) {
    const w = g.measureText(chip).width + 44 * s;
    if (row.length && cx + w > left + colW) {
      rows.push(row);
      row = [];
      cx = left;
    }
    row.push({ text: chip, w, x: cx });
    cx += w + 14 * s;
  }
  if (row.length) rows.push(row);
  const chipsTop = rows.length ? bottom - rows.length * chipH - (rows.length - 1) * chipGap : bottom;

  g.fillStyle = COLORS.ink;
  g.textBaseline = 'alphabetic';
  let titlePx = 104 * s;
  g.font = cssFont('display', titlePx);
  if (wrap(g, spec.title, colW).length > 2) {
    titlePx *= 0.8;
    g.font = cssFont('display', titlePx);
  }
  let y = 60 * s;
  for (const line of wrap(g, spec.title, colW)) {
    y += titlePx * 0.98;
    g.fillText(line, left, y);
  }

  // Tagline, shrunk if it would run into the chips.
  let tagPx = 40 * s;
  let lines: string[] = [];
  for (;;) {
    g.font = cssFont('body', tagPx);
    lines = wrap(g, spec.tagline, colW);
    if (y + 24 * s + lines.length * tagPx * 1.25 < chipsTop - 18 * s || tagPx < 26 * s) break;
    tagPx -= 2 * s;
  }
  y += 24 * s;
  g.fillStyle = COLORS.inkSoft;
  for (const line of lines) {
    y += tagPx * 1.25;
    g.fillText(line, left, y);
  }

  g.font = cssFont('bodyBold', 32 * s);
  rows.forEach((r, i) => {
    const top = chipsTop + i * (chipH + chipGap);
    for (const chip of r) {
      g.fillStyle = COLORS.accent;
      roundRect(g, chip.x, top, chip.w, chipH, chipH / 2);
      g.fill();
      g.fillStyle = COLORS.paper;
      g.fillText(chip.text, chip.x + 22 * s, top + chipH * 0.71);
    }
  });

  // Year, top right.
  g.font = cssFont('bodyBold', 36 * s);
  const yw = g.measureText(String(spec.year)).width + 40 * s;
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 4 * s;
  roundRect(g, W - yw - 40 * s, 40 * s, yw, 56 * s, 28 * s);
  g.stroke();
  g.fillStyle = COLORS.ink;
  g.fillText(String(spec.year), W - yw - 20 * s, 81 * s);

  ART[spec.art](g, W * 0.64, H * 0.26, W * 0.31, H * 0.54);

  const tex = canvasTexture(c, 8);
  cache.set(key, tex);
  return tex;
}
