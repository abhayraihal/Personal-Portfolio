import { BufferGeometry, CanvasTexture, Color, Vector3 } from 'three';
import type { BufferAttribute, Texture } from 'three';

// The Kenney car-kit colours come from UVs into a 512x512 palette (Textures/colormap.png). Each
// palette cell is 64 x 128 px: a flat half and a gradient half. These are the cells the jeep body
// samples, found by reading the body mesh UVs (u, v in pixels, v from the top as glTF uses).
export type Cell = { x0: number; x1: number; y0: number; y1: number; ref: number };

export const CELLS = {
  // Green body panels: doors, hood, wings. Sampled at u = 240, v = 140..212.
  panels: { x0: 224, x1: 256, y0: 128, y1: 256, ref: 176 },
  // Grey-violet shell: roof, pillars, tailgate, underside. Sampled at u = 240, v = 268..371.
  shell: { x0: 224, x1: 256, y0: 256, y1: 384, ref: 300 },
  // Red tail lights at the back (model z = -1.15).
  tail: { x0: 160, x1: 192, y0: 384, y1: 512, ref: 440 },
  // Yellow round headlights at the front (model z = 1.25).
  head: { x0: 96, x1: 128, y0: 384, y1: 512, ref: 440 },
  // Not used by the jeep (an orange gradient). The hardtop is moved here so it can take its own
  // colour without repainting the bumpers, wheel-arch flares and grille that share the shell cell.
  hardtop: { x0: 352, x1: 384, y0: 128, y1: 256, ref: 172 },
} satisfies Record<string, Cell>;

// Shell triangles that form the hardtop (rear quarters, tailgate, roof), in body-mesh units: above
// the beltline and behind the grille.
const HARDTOP = { minY: 0.58, maxZ: 0.9 };

const PALETTE = 512;

export function inCell(u: number, v: number, c: Cell): boolean {
  const x = u * PALETTE;
  const y = v * PALETTE;
  return x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Repaints one cell with `hex`, keeping the cell's own light-to-dark shading: every pixel gets
// the target colour scaled by its luminance relative to the reference row, so the row the model
// samples most comes out as exactly `hex`.
function recolorCell(ctx: CanvasRenderingContext2D, cell: Cell, hex: string, scale: number) {
  const x0 = Math.round(cell.x0 * scale);
  const y0 = Math.round(cell.y0 * scale);
  const w = Math.max(1, Math.round((cell.x1 - cell.x0) * scale));
  const h = Math.max(1, Math.round((cell.y1 - cell.y0) * scale));
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  const refRow = Math.min(h - 1, Math.max(0, Math.round((cell.ref - cell.y0) * scale)));
  const refIdx = (refRow * w + (w >> 1)) * 4;
  const refLum = Math.max(1e-4, luminance(toLinear(d[refIdx] / 255), toLinear(d[refIdx + 1] / 255), toLinear(d[refIdx + 2] / 255)));
  const target = new Color(hex); // Color stores linear components
  for (let i = 0; i < d.length; i += 4) {
    const k = luminance(toLinear(d[i] / 255), toLinear(d[i + 1] / 255), toLinear(d[i + 2] / 255)) / refLum;
    d[i] = Math.round(toSrgb(Math.min(1, target.r * k)) * 255);
    d[i + 1] = Math.round(toSrgb(Math.min(1, target.g * k)) * 255);
    d[i + 2] = Math.round(toSrgb(Math.min(1, target.b * k)) * 255);
  }
  ctx.putImageData(img, x0, y0);
}

export type PaintSpec = { panels: string; hardtop?: string };

// A copy of the palette with the jeep's paint cells repainted. The source texture is left
// untouched, so other car-kit models (traffic cones) keep their colours.
export function repaintPalette(map: Texture, paint: PaintSpec): CanvasTexture {
  const image = map.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(image, 0, 0);
  const scale = image.width / PALETTE;
  recolorCell(ctx, CELLS.panels, paint.panels, scale);
  if (paint.hardtop) {
    // Start from the shell's own gradient so the hardtop keeps its shading, then recolour it.
    const sh = CELLS.shell;
    const ht = CELLS.hardtop;
    const w = (sh.x1 - sh.x0) * scale;
    const h = (sh.y1 - sh.y0) * scale;
    ctx.drawImage(canvas, sh.x0 * scale, sh.y0 * scale, w, h, ht.x0 * scale, ht.y0 * scale, w, h);
    recolorCell(ctx, ht, paint.hardtop, scale);
  }
  const tex = new CanvasTexture(canvas);
  tex.flipY = map.flipY;
  tex.colorSpace = map.colorSpace;
  tex.wrapS = map.wrapS;
  tex.wrapT = map.wrapT;
  tex.magFilter = map.magFilter;
  tex.minFilter = map.minFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export type BodySplit = {
  rest: BufferGeometry;
  tail: BufferGeometry;
  head: BufferGeometry;
  tailCenters: Vector3[]; // one per side, in the body mesh's local space
  headCenters: Vector3[];
};

function subset(src: BufferGeometry, indices: number[]): BufferGeometry {
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) g.setAttribute(name, attr);
  g.setIndex(indices);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// Centre of the triangles on each side of x = 0 (left and right lamp).
function lampCenters(pos: BufferAttribute, indices: number[]): Vector3[] {
  const sides = [new Vector3(), new Vector3()];
  const counts = [0, 0];
  for (const i of indices) {
    const s = pos.getX(i) < 0 ? 0 : 1;
    sides[s].x += pos.getX(i);
    sides[s].y += pos.getY(i);
    sides[s].z += pos.getZ(i);
    counts[s]++;
  }
  const out: Vector3[] = [];
  for (let s = 0; s < 2; s++) if (counts[s] > 0) out.push(sides[s].divideScalar(counts[s]));
  return out;
}

// Points the hardtop triangles at CELLS.hardtop. Works on a copy: the GLTF cache keeps the original.
function remapHardtop(geo: BufferGeometry): BufferGeometry {
  const g = geo.clone();
  const uv = g.getAttribute('uv') as BufferAttribute;
  const pos = g.getAttribute('position') as BufferAttribute;
  const index = g.index;
  if (!index) return g;
  const du = (CELLS.hardtop.x0 - CELLS.shell.x0) / PALETTE;
  const dv = (CELLS.hardtop.y0 - CELLS.shell.y0) / PALETTE;
  const moved = new Set<number>();
  const kept = new Set<number>();
  const tris: number[][] = [];
  for (let t = 0; t < index.count; t += 3) {
    const ids = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    const u = (uv.getX(ids[0]) + uv.getX(ids[1]) + uv.getX(ids[2])) / 3;
    const v = (uv.getY(ids[0]) + uv.getY(ids[1]) + uv.getY(ids[2])) / 3;
    const isTop = inCell(u, v, CELLS.shell)
      && Math.min(pos.getY(ids[0]), pos.getY(ids[1]), pos.getY(ids[2])) >= HARDTOP.minY
      && Math.max(pos.getZ(ids[0]), pos.getZ(ids[1]), pos.getZ(ids[2])) <= HARDTOP.maxZ;
    tris.push(ids);
    for (const i of ids) (isTop ? moved : kept).add(i);
  }
  // A vertex shared with a triangle that keeps the shell colour would drag it along; there are
  // none in this model, but fail loudly rather than smear the bumper.
  for (const i of moved) if (kept.has(i)) throw new Error('hardtop shares a vertex with the shell');
  for (const i of moved) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
  uv.needsUpdate = true;
  return g;
}

// Splits the body into the tail-light triangles, the headlight triangles and the rest (with the
// hardtop remapped if asked). The geometries share one set of vertex buffers; only the index differs.
export function splitBody(body: BufferGeometry, hardtop: boolean): BodySplit {
  const src = hardtop ? remapHardtop(body) : body;
  const uv = src.getAttribute('uv') as BufferAttribute;
  const pos = src.getAttribute('position') as BufferAttribute;
  const count = src.index ? src.index.count : pos.count;
  const at = (k: number) => (src.index ? src.index.getX(k) : k);
  const rest: number[] = [];
  const tail: number[] = [];
  const head: number[] = [];
  for (let t = 0; t < count; t += 3) {
    const a = at(t);
    const b = at(t + 1);
    const c = at(t + 2);
    // Use the triangle's UV centroid: every vertex of a lamp triangle sits in the same cell.
    const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
    const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
    const bucket = inCell(u, v, CELLS.tail) ? tail : inCell(u, v, CELLS.head) ? head : rest;
    bucket.push(a, b, c);
  }
  return {
    rest: subset(src, rest),
    tail: subset(src, tail),
    head: subset(src, head),
    tailCenters: lampCenters(pos, tail),
    headCenters: lampCenters(pos, head),
  };
}
