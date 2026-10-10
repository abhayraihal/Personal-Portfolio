// Canvas helpers: the site fonts loaded as FontFaces (local woff files, no network), text
// measuring for chip backgrounds, and CanvasTexture setup.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { FONTS } from '../../config/palette.ts';
import type { FontName } from '../../config/palette.ts';

export const FAMILY: Record<FontName, string> = {
  display: 'pf-lilita-one',
  body: 'pf-rubik',
  bodyBold: 'pf-rubik-bold',
};

let fontsReady: Promise<void> | null = null;

// Resolves once the three fonts can be used in canvas 2D. Never rejects: a failed font only
// means the canvas falls back to a system face.
export function loadCanvasFonts(): Promise<void> {
  if (!fontsReady) {
    const faces = (Object.keys(FAMILY) as FontName[]).map((k) => new FontFace(FAMILY[k], `url("${FONTS[k]}")`));
    fontsReady = Promise.all(
      faces.map((f) =>
        f.load().then(
          (loaded) => {
            document.fonts.add(loaded);
          },
          () => undefined,
        ),
      ),
    ).then(() => undefined);
  }
  return fontsReady;
}

export const cssFont = (font: FontName, px: number) => `${px}px "${FAMILY[font]}"`;

let measureCtx: CanvasRenderingContext2D | null = null;

// Advance width of a single-line string in metres for a given font size in metres.
export function textWidth(text: string, font: FontName, size: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * size * 0.55;
  measureCtx.font = cssFont(font, 100);
  return (measureCtx.measureText(text).width / 100) * size;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function canvasTexture(c: HTMLCanvasElement, anisotropy = 4): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// Greedy word wrap for canvas text. Returns the lines.
export function wrap(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
