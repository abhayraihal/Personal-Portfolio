import { BufferAttribute, BufferGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

// Zone-frame helpers. Points are [x, z] in the campus frame (see <ZoneFrame>): +x screen right,
// +z towards the camera.
export type P2 = [number, number];

// Closed rounded rectangle centred on (cx, cz), as a dense polyline (counter-clockwise on screen,
// starting at the top-right corner).
export function roundedRect(cx: number, cz: number, hx: number, hz: number, r: number, perCorner = 10): P2[] {
  const pts: P2[] = [];
  const corners: [number, number, number][] = [
    [cx + hx - r, cz - hz + r, -Math.PI / 2], // top right: sweep from 0 to -90 deg
    [cx - hx + r, cz - hz + r, -Math.PI], // top left
    [cx - hx + r, cz + hz - r, -1.5 * Math.PI], // bottom left
    [cx + hx - r, cz + hz - r, -2 * Math.PI], // bottom right
  ];
  let start = 0;
  for (const [ox, oz, end] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = start + ((end - start) * i) / perCorner;
      pts.push([ox + Math.cos(a) * r, oz + Math.sin(a) * r]);
    }
    start = end;
  }
  return pts;
}

// Resample a polyline at a fixed spacing (keeps the end points).
export function resample(pts: P2[], step: number, closed = false): P2[] {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: P2[] = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [ax, az] = src[i - 1];
    const [bx, bz] = src[i];
    const len = Math.hypot(bx - ax, bz - az);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([ax + (bx - ax) * t, az + (bz - az) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  if (!closed) out.push(src[src.length - 1]);
  else out.pop();
  return out;
}

// Catmull-Rom through control points, sampled every `step` metres.
export function smoothPath(ctrl: P2[], step = 0.5, closed = false): P2[] {
  const n = ctrl.length;
  const get = (i: number) => (closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))]);
  const dense: P2[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < 16; k++) {
      const t = k / 16, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) dense.push(ctrl[n - 1]);
  return resample(dense, step, closed);
}

// Point and unit tangent at arc length `s` along an open polyline.
export function sampleAt(pts: P2[], s: number): { p: P2; t: P2 } {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (acc + len >= s || i === pts.length - 1) {
      const f = len ? Math.min(1, Math.max(0, (s - acc) / len)) : 0;
      return { p: [ax + (bx - ax) * f, az + (bz - az) * f], t: [(bx - ax) / (len || 1), (bz - az) / (len || 1)] };
    }
    acc += len;
  }
  return { p: pts[0], t: [1, 0] };
}

export function pathLength(pts: P2[]): number {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return acc;
}

// Unit normal (pointing left of the direction of travel, in the x/z plane) at each point.
export function normals(pts: P2[], closed = false): P2[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [dz / l, -dx / l];
  });
}

// Offset a polyline sideways by `d` metres (positive = left of travel).
export function offsetPath(pts: P2[], d: number, closed = false): P2[] {
  const ns = normals(pts, closed);
  return pts.map((p, i) => [p[0] + ns[i][0] * d, p[1] + ns[i][1] * d]);
}

// Flat ribbon (y up) along a polyline. Several ribbons can share one geometry via `strips`.
export function ribbonGeometry(strips: { pts: P2[]; width: number; closed?: boolean; y?: number }[]): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const { pts, width, closed = false, y = 0 } of strips) {
    const ns = normals(pts, closed);
    const base = pos.length / 3;
    let along = 0;
    pts.forEach((p, i) => {
      if (i > 0) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const [nx, nz] = ns[i];
      const h = width / 2;
      pos.push(p[0] + nx * h, y, p[1] + nz * h, p[0] - nx * h, y, p[1] - nz * h);
      uv.push(0, along, 1, along);
    });
    const count = pts.length;
    const segs = closed ? count : count - 1;
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      const b = base + ((i + 1) % count) * 2;
      // Winding chosen so the face points up (+y) for left-normal ribbons.
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  g.setIndex(idx);
  fixWindingUp(g);
  g.computeBoundingSphere();
  return g;
}

// Flip any triangle whose face normal points down, so every ribbon renders from above.
function fixWindingUp(g: BufferGeometry) {
  const p = g.getAttribute('position');
  const index = g.getIndex();
  if (!index) return;
  const a = index.array as Uint16Array | Uint32Array;
  for (let i = 0; i < a.length; i += 3) {
    const i0 = a[i], i1 = a[i + 1], i2 = a[i + 2];
    const ux = p.getX(i1) - p.getX(i0), uz = p.getZ(i1) - p.getZ(i0);
    const vx = p.getX(i2) - p.getX(i0), vz = p.getZ(i2) - p.getZ(i0);
    // y component of (u x v)
    const ny = uz * vx - ux * vz;
    if (ny < 0) {
      a[i + 1] = i2;
      a[i + 2] = i1;
    }
  }
}

// Filled polygon (fan from the centroid; fine for convex-ish shapes like a rounded lawn).
export function polygonGeometry(pts: P2[], y = 0): BufferGeometry {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const pos: number[] = [cx, y, cz];
  const uv: number[] = [cx, cz];
  for (const p of pts) {
    pos.push(p[0], y, p[1]);
    uv.push(p[0], p[1]);
  }
  const idx: number[] = [];
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length));
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  g.setIndex(idx);
  fixWindingUp(g);
  g.computeBoundingSphere();
  return g;
}

// Soft round glow (white centre fading out), shared by light pools and halos.
let glow: CanvasTexture | null = null;
export function glowTexture(): CanvasTexture {
  if (glow) return glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glow = new CanvasTexture(c);
  glow.colorSpace = SRGBColorSpace;
  return glow;
}

// Mown-lawn stripes, tiled along u.
let lawn: CanvasTexture | null = null;
export function lawnTexture(light: string, dark: string): CanvasTexture {
  if (lawn) return lawn;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d')!;
  g.fillStyle = light;
  g.fillRect(0, 0, 32, 8);
  g.fillStyle = dark;
  g.fillRect(32, 0, 32, 8);
  lawn = new CanvasTexture(c);
  lawn.colorSpace = SRGBColorSpace;
  lawn.wrapS = lawn.wrapT = RepeatWrapping;
  return lawn;
}

// Greedy word wrap, for board lines (Board does not wrap by itself).
export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
}
