import { useLayoutEffect, useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { COLORS } from '../../config/palette.ts';
import { contests, rankFor } from '../../data/codeforces.ts';
import { useStore } from '../../state/store.ts';
import { MILESTONES, N, S_END, S_SUMMIT, deckY, hwAt, sContest } from './profile.ts';
import { END_WALL_H, END_WALL_T, END_WALL_FACE, railSides } from './shape.ts';
import type { OutlinePoint } from './shape.ts';
import { RAIL_POST, cornerCutBox, shadeFor } from './geometry.ts';
import { selfLitMaterial } from './materials.ts';

// Point on a rail line at a distance s along the road (the line is sorted by s, either way round).
export function railPointAt(line: OutlinePoint[], s: number): OutlinePoint {
  const asc = line[0].s < line[line.length - 1].s;
  let lo = 0;
  let hi = line.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (line[mid].s < s === asc) lo = mid;
    else hi = mid;
  }
  const a = line[lo];
  const b = line[hi];
  const t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
  return { s, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: deckY(s), n: a.n };
}

// Points every `gap` metres of path length along a polyline, between two distances along the road.
function spaced(line: OutlinePoint[], gap: number, sMin: number, sMax: number): OutlinePoint[] {
  const out: OutlinePoint[] = [];
  let acc = gap;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let t = 0;
    while (acc <= len - t + 1e-9) {
      t += acc;
      acc = gap;
      const f = t / len;
      const p = { s: a.s + (b.s - a.s) * f, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, y: 0, n: a.n };
      p.y = deckY(p.s);
      if (p.s >= sMin && p.s <= sMax) out.push(p);
    }
    acc -= len - t;
  }
  return out;
}

const GATE_INDEX = new Set(MILESTONES.map((m) => m.index));

// Guard rail posts. On the camera side there is one post per contest, painted in the rank that
// contest ended on, so the rail reads as a colour-coded timeline.
export function RailPosts() {
  const ref = useRef<InstancedMesh>(null);
  const low = useStore((s) => s.quality === 'low');
  const geometry = useMemo(() => cornerCutBox(RAIL_POST.w, RAIL_POST.h, RAIL_POST.w, 0.05), []);
  // the rank colours glow a little at night, like road reflectors
  const material = useMemo(() => selfLitMaterial({ roughness: 0.85 }, 0.26, 0.75), []);
  const posts = useMemo(() => {
    const { front, back } = railSides(0.5);
    const neutral = '#7a5a3d';
    const list: { p: OutlinePoint; color: string }[] = [];
    for (let i = 0; i < N; i++) {
      if (GATE_INDEX.has(i)) continue;
      const rank = rankFor(contests[i].newRating);
      list.push({ p: railPointAt(front, sContest(i)), color: shadeFor(rank.name, rank.color) });
    }
    for (const p of spaced(front, 1.5, 0, sContest(0) - 0.9)) list.push({ p, color: neutral });
    for (const p of spaced(front, 1.6, S_SUMMIT + 1.2, S_END)) list.push({ p, color: neutral });
    for (const p of spaced(back, 1.6, 0, S_END)) list.push({ p, color: neutral });
    list.push({ p: front[0], color: neutral }, { p: back[back.length - 1], color: neutral });
    return list;
  }, []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new Matrix4();
    const q = new Quaternion();
    const c = new Color();
    const one = new Vector3(1, 1, 1);
    const up = new Vector3(0, 1, 0);
    const pos = new Vector3();
    posts.forEach(({ p, color }, i) => {
      // sunk 6 cm so the foot stays buried where the deck slopes
      q.setFromAxisAngle(up, Math.atan2(p.n.x, p.n.z));
      m.setMatrixAt(i, mat.compose(pos.set(p.x, p.y + RAIL_POST.h / 2 - 0.06, p.z), q, one));
      m.setColorAt(i, c.set(color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [posts]);

  return <instancedMesh ref={ref} args={[geometry, material, posts.length]} castShadow={!low} receiveShadow />;
}

// The wall across the far end of the summit plaza: three courses of dry stone and a snow cap. The
// blocks fill the collider box from shape.ts.
const STONE_SHADES = ['#8c8fa3', '#9a9cad', '#80839a', '#a3a5b3'];

export function EndWall() {
  const ref = useRef<InstancedMesh>(null);
  const y0 = deckY(S_END) - 0.3;
  const h = END_WALL_H + 0.3;
  const len = 2 * (hwAt(S_END) + 0.2);
  const x = END_WALL_FACE - END_WALL_T / 2;
  const blocks = useMemo(() => {
    const out: { y: number; z: number; l: number; hgt: number; c: string }[] = [];
    const courses = 3;
    const ch = h / courses;
    let k = 0;
    for (let c = 0; c < courses; c++) {
      const cuts = c % 2 === 0 ? [0, 0.26, 0.5, 0.76, 1] : [0, 0.13, 0.38, 0.62, 0.87, 1];
      for (let i = 0; i < cuts.length - 1; i++) {
        const z0 = -len / 2 + cuts[i] * len;
        const z1 = -len / 2 + cuts[i + 1] * len;
        out.push({ y: c * ch + ch / 2, z: (z0 + z1) / 2, l: z1 - z0 - 0.05, hgt: ch - 0.05, c: STONE_SHADES[k++ % STONE_SHADES.length] });
      }
    }
    return out;
  }, [h, len]);
  const geometry = useMemo(() => cornerCutBox(1, 1, 1, 0.1), []);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 1 }), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const sc = new Vector3();
    const c = new Color();
    blocks.forEach((b, i) => {
      m.setMatrixAt(i, mat.compose(p.set(0, b.y, b.z), q, sc.set(END_WALL_T - 0.04, b.hgt, b.l)));
      m.setColorAt(i, c.set(b.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [blocks]);
  return (
    <group position={[x, y0, 0]}>
      <instancedMesh ref={ref} args={[geometry, material, blocks.length]} castShadow receiveShadow />
      <RoundedBox args={[END_WALL_T + 0.25, 0.42, len + 0.3]} radius={0.16} smoothness={2} position={[0, h + 0.12, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.snow} roughness={1} />
      </RoundedBox>
    </group>
  );
}
