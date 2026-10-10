import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, CylinderGeometry, MeshStandardMaterial } from 'three';
import type { Group } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { panels, skillBricks } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { HubBody } from './HubBody.tsx';
import type { HomeGroup } from './homes.ts';
import { hubAt, SPOT } from './layout.ts';
import { glowAtNight } from './nightGlow.ts';
import { textWidth } from './textWidth.ts';

// The 23 skill bricks as a toy-brick wall the car can smash through. Brick length follows its
// label; colour follows the skill's group in panels.skills (languages, platforms, AI, tools).

const ROWS = 4;
const H = 0.8;
const D = 0.92;
const LABEL = 0.4;
const MIN_LEN = 1.5;
const STUD_R = 0.16;
const STUD_H = 0.12;
const KG_PER_M = 6;
const KICK = { up: 0.12, spin: 0.25 };

type SkillGroup = { label: string; color: string; text: string };

// Colours are prayer-flag hues, matched to the groups in profile order.
const GROUP_COLORS: Record<string, { color: string; text: string }> = {
  Languages: { color: '#2f6fd6', text: COLORS.paper },
  'Frameworks and platforms': { color: '#f2c230', text: COLORS.ink },
  AI: { color: COLORS.accent, text: COLORS.paper },
  Tools: { color: '#3fa65a', text: COLORS.paper },
};
const FALLBACK = { color: COLORS.paperShade, text: COLORS.ink };

function skillGroups(): SkillGroup[] {
  const groups = panels.skills.groups ?? [];
  return groups
    .filter((g) => skillBricks.some((s) => g.items.includes(s)))
    .map((g) => ({ label: g.label, ...(GROUP_COLORS[g.label] ?? FALLBACK) }));
}

function groupOf(skill: string): { color: string; text: string } {
  const g = panels.skills.groups?.find((x) => x.items.includes(skill));
  return (g && GROUP_COLORS[g.label]) || FALLBACK;
}

type Brick = { skill: string; len: number; x: number; y: number; color: string; text: string };

// Split the bricks, in resume order, into ROWS consecutive runs with the shortest longest run,
// then stretch every run to the same length so the wall ends flush. Top row first.
function layoutBricks(): { bricks: Brick[]; length: number } {
  const lens = skillBricks.map((s) => Math.max(MIN_LEN, textWidth(s, 'display', LABEL) + 0.7));
  const n = lens.length;
  let best: number[] = [];
  let bestMax = Infinity;
  // Few enough bricks to try every split point.
  const cuts = (start: number, rowsLeft: number, acc: number[]) => {
    if (rowsLeft === 1) {
      const all = [...acc, n];
      let prev = 0;
      let max = 0;
      for (const c of all) {
        let sum = 0;
        for (let i = prev; i < c; i++) sum += lens[i];
        max = Math.max(max, sum);
        prev = c;
      }
      if (max < bestMax) {
        bestMax = max;
        best = all;
      }
      return;
    }
    for (let c = start + 1; c <= n - rowsLeft + 1; c++) cuts(c, rowsLeft - 1, [...acc, c]);
  };
  cuts(0, ROWS, []);
  const bricks: Brick[] = [];
  let prev = 0;
  best.forEach((end, row) => {
    let sum = 0;
    for (let i = prev; i < end; i++) sum += lens[i];
    const k = bestMax / sum;
    let x = -bestMax / 2;
    for (let i = prev; i < end; i++) {
      const len = lens[i] * k;
      bricks.push({ skill: skillBricks[i], len, x: x + len / 2, y: (ROWS - 1 - row) * H + H / 2, ...groupOf(skillBricks[i]) });
      x += len;
    }
    prev = end;
  });
  return { bricks, length: bestMax };
}

const geometryCache = new Map<string, BufferGeometry>();
function brickGeometry(len: number): BufferGeometry {
  const key = len.toFixed(3);
  let g = geometryCache.get(key);
  if (g) return g;
  const box = new RoundedBoxGeometry(len - 0.02, H - 0.02, D, 2, 0.06);
  const parts: BufferGeometry[] = [box.index ? box.toNonIndexed() : box];
  const studs = Math.max(2, Math.round(len / 0.55));
  for (let i = 0; i < studs; i++) {
    for (const z of [-D / 4, D / 4]) {
      const s = new CylinderGeometry(STUD_R, STUD_R, STUD_H, 12).toNonIndexed();
      s.translate(-len / 2 + (len / studs) * (i + 0.5), H / 2 + STUD_H / 2 - 0.01, z);
      parts.push(s);
    }
  }
  for (const p of parts) for (const a of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(a)) p.deleteAttribute(a);
  g = mergeGeometries(parts, false) ?? box;
  g.computeBoundingSphere();
  geometryCache.set(key, g);
  return g;
}

const materials = new Map<string, MeshStandardMaterial>();
function brickMaterial(color: string) {
  let m = materials.get(color);
  if (!m) {
    m = glowAtNight(new MeshStandardMaterial({ color, roughness: 0.55, emissive: color, emissiveIntensity: 0.08 }), 0.14);
    materials.set(color, m);
  }
  return m;
}
const labelMaterial = glowAtNight(new MeshStandardMaterial({ roughness: 0.8 }), 0.35);

const WALL = layoutBricks();

const LEGEND_TEXT = 0.42;
const SWATCH = 0.48;
const LEGEND_ROWS = 2; // one row would be wider than the wall
const LEGEND_PITCH = 0.74; // row to row

// The colour key painted on the grass in front of the wall, one entry per skill group, in profile
// order across then down, in columns so the swatches line up.
function WallLegend() {
  const night = useStore((s) => s.night);
  const groups = skillGroups();
  const gapIn = 0.16;
  const gapOut = 0.62;
  const cols = Math.ceil(groups.length / LEGEND_ROWS);
  const widths = groups.map((g) => SWATCH + gapIn + textWidth(g.label, 'display', LEGEND_TEXT));
  const colW = Array.from({ length: cols }, (_, c) => Math.max(...widths.filter((_w, i) => i % cols === c)));
  const total = colW.reduce((a, w) => a + w, 0) + gapOut * (cols - 1);
  const rows = Math.ceil(groups.length / cols);
  const items = groups.map((g, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = -total / 2 + colW.slice(0, c).reduce((a, w) => a + w + gapOut, 0);
    const z = (r - (rows - 1) / 2) * LEGEND_PITCH; // first row furthest from the camera
    return { ...g, x, z };
  });
  const [wu] = SPOT.wall;
  return (
    <group position={hubAt(wu, SPOT.wallLegendV)}>
      {items.map((g) => (
        <group key={g.label} position={[g.x, 0, g.z]}>
          <mesh material={brickMaterial(g.color)} position={[SWATCH / 2, 0.025, 0]} receiveShadow>
            <boxGeometry args={[SWATCH, 0.05, SWATCH]} />
          </mesh>
          <Label flat font="display" size={LEGEND_TEXT} color={night ? COLORS.paper : COLORS.ink} material={labelMaterial} anchorX="left" position={[SWATCH + gapIn, 0.05, 0.02]}>
            {g.label}
          </Label>
        </group>
      ))}
    </group>
  );
}

export function SkillWall({ group }: { group: HomeGroup }) {
  const [wu, wv] = SPOT.wall;
  const [pu, pv] = SPOT.wallPad;
  const [x0, , z0] = hubAt(wu, wv);
  const bricks = useMemo(
    () =>
      WALL.bricks.map((b) => ({
        ...b,
        geometry: brickGeometry(b.len),
        material: brickMaterial(b.color),
        half: [b.len / 2 - 0.01, H / 2, D / 2] as [number, number, number],
      })),
    [],
  );
  // Back-face labels only matter once bricks are knocked about; while the wall stands they face away
  // from the camera, so they are hidden to save 23 draw calls.
  const backs = useRef<(Group | null)[]>([]);
  useEffect(() => {
    const show = (d: boolean) => backs.current.forEach((g) => g && (g.visible = d));
    show(false);
    group.listeners.add(show);
    return () => {
      group.listeners.delete(show);
    };
  }, [group]);
  return (
    <>
      {bricks.map((b, i) => (
        <HubBody
          key={b.skill}
          group={group}
          half={b.half}
          mass={b.len * KG_PER_M}
          kick={KICK}
          position={[x0 + b.x, b.y + 0.001, z0]}
        >
          <mesh geometry={b.geometry} material={b.material} castShadow receiveShadow />
          <Label font="display" size={LABEL} color={b.text} material={labelMaterial} position={[0, 0, D / 2 + 0.012]}>
            {b.skill}
          </Label>
          <group
            ref={(el) => {
              backs.current[i] = el;
            }}
            visible={false}
          >
            <Label font="display" size={LABEL} color={b.text} material={labelMaterial} position={[0, 0, -D / 2 - 0.012]} rotation={[0, Math.PI, 0]}>
              {b.skill}
            </Label>
          </group>
        </HubBody>
      ))}
      <WallLegend />
      <Pad id="hub-skills" label="See skills by group" icon="Skills" action={{ kind: 'panel', panel: 'skills' }} position={hubAt(pu, pv)} />
    </>
  );
}
