// Vertex-coloured balls for the park (paintMaterial): football, volleyball, tennis ball and bowling
// ball. Each colours whole triangles, so the panels and seams stay crisp at any size.
import { BufferAttribute, Color, IcosahedronGeometry, Vector3 } from 'three';
import type { BufferGeometry } from 'three';

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();

// Colour every triangle of an icosphere by its centre direction.
function colourFaces(r: number, detail: number, pick: (n: Vector3) => Color): BufferGeometry {
  const geo = new IcosahedronGeometry(r, detail);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let t = 0; t < pos.count; t += 3) {
    _a.fromBufferAttribute(pos, t);
    _b.fromBufferAttribute(pos, t + 1);
    _c.fromBufferAttribute(pos, t + 2);
    const col = pick(_a.add(_b).add(_c).normalize());
    for (let k = 0; k < 3; k++) col.toArray(colors, (t + k) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.deleteAttribute('uv');
  return geo;
}

// Twice-subdivided icosahedron whose triangles around the 12 original vertices are black: the 12
// pentagons of a real ball.
export function footballGeometry(r: number): BufferGeometry {
  const base = new IcosahedronGeometry(1, 0);
  const dirs: Vector3[] = [];
  for (let i = 0; i < base.attributes.position.count; i++) {
    const v = new Vector3().fromBufferAttribute(base.attributes.position, i).normalize();
    if (!dirs.some((d) => d.distanceTo(v) < 1e-3)) dirs.push(v);
  }
  base.dispose();
  const white = new Color('#f7f7f3');
  const black = new Color('#25282f');
  return colourFaces(r, 2, (n) => {
    let best = -1;
    for (const d of dirs) best = Math.max(best, d.dot(n));
    return best > 0.95 ? black : white;
  });
}

// Six sections of three strips, like a cube: the strip colour follows the second-largest axis.
export function volleyballGeometry(r: number): BufferGeometry {
  const cols = ['#f6f4ee', '#2f6fd6', '#f2c230'].map((c) => new Color(c));
  return colourFaces(r, 3, (n) => {
    const ax = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const major = ax.indexOf(Math.max(...ax));
    // Each face's strips run across the next axis, so neighbouring sections meet crosswise.
    const across = [n.x, n.y, n.z][(major + 1) % 3] / Math.max(ax[major], 1e-6);
    const band = across < -0.33 ? 0 : across < 0.33 ? 1 : 2;
    return cols[(band + major) % 3];
  });
}

// Fuzzy yellow-green ball with the white seam curve.
export function tennisBallGeometry(r: number, detail = 3): BufferGeometry {
  const seam: Vector3[] = [];
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * Math.PI * 2;
    seam.push(new Vector3(Math.cos(t) + 0.32 * Math.cos(3 * t), Math.sin(t) - 0.32 * Math.sin(3 * t), 0.86 * Math.sin(2 * t)).normalize());
  }
  const felt = new Color('#d7e64a');
  const white = new Color('#f5f7ee');
  return colourFaces(r, detail, (n) => {
    let best = -1;
    for (const s of seam) best = Math.max(best, s.dot(n));
    return best > 0.985 ? white : felt;
  });
}

// Dark purple bowling ball with three finger holes.
export function bowlingBallGeometry(r: number): BufferGeometry {
  const holes = [new Vector3(0, 0.25, 1), new Vector3(-0.22, 0.52, 0.83), new Vector3(0.22, 0.52, 0.83)].map((v) => v.normalize());
  const shell = new Color('#4a2f8a');
  const swirl = new Color('#6a4bb5');
  const hole = new Color('#15121c');
  return colourFaces(r, 3, (n) => {
    for (const h of holes) if (h.dot(n) > 0.975) return hole;
    return Math.sin(n.x * 7 + n.y * 4) * Math.cos(n.z * 5) > 0.45 ? swirl : shell;
  });
}
