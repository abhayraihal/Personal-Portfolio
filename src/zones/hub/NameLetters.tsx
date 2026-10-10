import { useMemo } from 'react';
import { useFont } from '@react-three/drei';
import { MeshStandardMaterial } from 'three';
import type { BufferGeometry } from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { COLORS, FONTS } from '../../config/palette.ts';
import { profile } from '../../data/profile.ts';
import { HubBody } from './HubBody.tsx';
import type { HomeGroup } from './homes.ts';
import { hubAt, SPOT } from './layout.ts';

type RowStyle = {
  size: number; // Text3D size; Lilita One capitals come out about this tall
  depth: number;
  bevel: number;
  gap: number; // between letter boxes
  wordGap: number;
  mass: number; // kg per letter
  material: MeshStandardMaterial;
};

const KICK = { up: 0.25, spin: 0.85 };

type Glyph = { key: string; geometry: BufferGeometry; half: [number, number, number]; x: number };

// A little emissive keeps the camera-facing sides from going dull: the sun sits behind the letters.
const pink = new MeshStandardMaterial({ color: COLORS.accent, emissive: COLORS.accent, emissiveIntensity: 0.22, roughness: 0.5 });
const ink = new MeshStandardMaterial({ color: '#2c3039', roughness: 0.55 });

const FIRST: RowStyle = { size: 2.2, depth: 0.62, bevel: 0.07, gap: 0.3, wordGap: 0, mass: 28, material: pink };
const LAST: RowStyle = { size: 1.25, depth: 0.42, bevel: 0.05, gap: 0.16, wordGap: 0.95, mass: 12, material: ink };

// Each letter is its own extruded TextGeometry (what drei's <Text3D> builds), centred on its bounding
// box so the cuboid collider matches the glyph.
function buildRow(font: Font, text: string, s: RowStyle): Glyph[] {
  const glyphs: Glyph[] = [];
  let x = 0;
  let pendingGap = 0;
  [...text].forEach((ch, i) => {
    if (ch === ' ') {
      pendingGap = s.wordGap;
      return;
    }
    const g = new TextGeometry(ch, {
      font,
      size: s.size,
      depth: s.depth,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: s.bevel,
      bevelSize: s.bevel * 0.8,
      bevelSegments: 2,
    });
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
    g.computeBoundingSphere();
    const w = bb.max.x - bb.min.x;
    const h = bb.max.y - bb.min.y;
    const d = bb.max.z - bb.min.z;
    if (glyphs.length) x += pendingGap || s.gap;
    pendingGap = 0;
    glyphs.push({ key: `${ch}${i}`, geometry: g, half: [w / 2, h / 2, d / 2], x: x + w / 2 });
    x += w;
  });
  const shift = x / 2;
  for (const g of glyphs) g.x -= shift;
  return glyphs;
}

function Row({ glyphs, v, style, group }: { glyphs: Glyph[]; v: number; style: RowStyle; group: HomeGroup }) {
  const [, , z] = hubAt(0, v);
  return (
    <>
      {glyphs.map((g) => (
        // A slightly low centre of mass keeps letters steady when standing; the kick makes a hit
        // tip them away from the car instead of pinning them to the bumper.
        <HubBody
          key={g.key}
          group={group}
          half={g.half}
          mass={style.mass}
          comDrop={0.25}
          kick={KICK}
          restitution={0.3}
          friction={0.9}
          angularDamping={0.12}
          linearDamping={0.1}
          position={[g.x, g.half[1] + 0.001, z]}
        >
          <mesh geometry={g.geometry} material={style.material} castShadow receiveShadow />
        </HubBody>
      ))}
    </>
  );
}

// 'ABHAY' in big pink letters across the spine, 'SINGH RAIHAL' in smaller ink letters in front of it.
export function NameLetters({ group }: { group: HomeGroup }) {
  const font = useFont(FONTS.display3d) as unknown as Font;
  const [first, ...rest] = profile.name.toUpperCase().split(' ');
  const last = rest.join(' ');
  const rows = useMemo(() => ({ first: buildRow(font, first, FIRST), last: buildRow(font, last, LAST) }), [font, first, last]);
  return (
    <>
      <Row glyphs={rows.first} v={SPOT.abhayV} style={FIRST} group={group} />
      <Row glyphs={rows.last} v={SPOT.surnameV} style={LAST} group={group} />
    </>
  );
}
