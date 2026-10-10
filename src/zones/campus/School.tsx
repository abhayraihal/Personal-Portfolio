import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Matrix4 } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { panels } from '../../data/profile.ts';
import { mergeParts, roundedBox } from './boxes.ts';
import type { Part } from './boxes.ts';
import { rod } from './Easel.tsx';
import { Y } from './Ground.tsx';
import { SCHOOL } from './layout.ts';
import { NightWash } from './Night.tsx';

const school = panels.school;
const CITY = (school.kicker ?? '').split('·').pop()?.trim() ?? ''; // 'Delhi'
const NAME = `${school.title}, ${CITY}`; // 'Kendriya Vidyalaya Pitampura, Delhi'
// 'Class 12: 95.20% · Class 10: 89.40%' from the CBSE stats.
const MARKS = (school.stats ?? []).map((s) => `${s.label.replace(/^CBSE (Class \d+).*$/, '$1')}: ${s.value}`).join(' · ');

const PILLAR = { w: 1.0, h: 5.1, x: 3.9 };
const SIGN = { w: 9.2, h: 1.62, y: 3.32 };
const WALL = 2.6; // low boundary wall either side of the gate
const BRICK = '#b65a46';
const CREAM = '#f6eedd';
const MAROON = '#8a2d3b';

// One gate leaf: bars between two rails, hinge at x = 0, extending along -x.
function leaf(width: number, height: number): BufferGeometry {
  const parts: BufferGeometry[] = [rod([0, 0.15, 0], [-width, 0.15, 0], 0.04), rod([0, height, 0], [-width, height, 0], 0.04)];
  const bars = Math.round(width / 0.3);
  for (let i = 0; i <= bars; i++) {
    const x = -(i * width) / bars;
    parts.push(rod([x, 0.05, 0], [x, height + 0.12, 0], 0.025, 5));
  }
  return mergeGeometries(parts);
}

// Both gate leaves, swung open towards the loop and hinged on the pillars.
function leavesGeometry(inner: number): BufferGeometry {
  const right = leaf(3.2, 1.7).applyMatrix4(new Matrix4().makeRotationY(-1.48).setPosition(inner, 0, 0));
  const left = leaf(3.2, 1.7).applyMatrix4(new Matrix4().makeRotationY(Math.PI + 1.48).setPosition(-inner, 0, 0));
  return mergeGeometries([right, left]);
}

export function School() {
  const inner = PILLAR.x - PILLAR.w / 2;
  const geo = useMemo(() => {
    const parts: Part[] = [];
    for (const s of [-1, 1]) {
      const px = s * PILLAR.x;
      const wx = s * (PILLAR.x + PILLAR.w / 2 + WALL / 2);
      parts.push(
        { geo: roundedBox(PILLAR.w, PILLAR.h, PILLAR.w, 0.06), color: BRICK, position: [px, PILLAR.h / 2, 0] },
        { geo: roundedBox(PILLAR.w + 0.24, 0.26, PILLAR.w + 0.24, 0.05), color: CREAM, position: [px, PILLAR.h + 0.13, 0] },
        { geo: roundedBox(WALL, 1.0, 0.4, 0.05), color: BRICK, position: [wx, 0.5, 0] },
        { geo: roundedBox(WALL + 0.1, 0.14, 0.52, 0.04), color: CREAM, position: [wx, 1.05, 0] },
      );
    }
    const sz = PILLAR.w / 2 + 0.12;
    parts.push(
      { geo: roundedBox(SIGN.w, SIGN.h, 0.2, 0.06), color: CREAM, position: [0, SIGN.y + SIGN.h / 2, sz] },
      { geo: roundedBox(SIGN.w - 0.14, 0.14, 0.03, 0.01), color: MAROON, position: [0, SIGN.y + SIGN.h - 0.09, sz + 0.1] },
    );
    return { gate: mergeParts(parts), leaves: leavesGeometry(inner) };
  }, [inner]);

  return (
    <group name="campus-school" position={[SCHOOL.x, 0, SCHOOL.z]}>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[PILLAR.w / 2, PILLAR.h / 2, PILLAR.w / 2]} position={[s * PILLAR.x, PILLAR.h / 2, 0]} />
        ))}
        {[-1, 1].map((s) => (
          <CuboidCollider key={`w${s}`} args={[WALL / 2, 0.5, 0.2]} position={[s * (PILLAR.x + PILLAR.w / 2 + WALL / 2), 0.5, 0]} />
        ))}
      </RigidBody>
      <mesh geometry={geo.gate} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      <mesh geometry={geo.leaves} castShadow>
        <meshStandardMaterial color="#3b3f4a" roughness={0.6} metalness={0.3} />
      </mesh>
      <NightWash width={SIGN.w - 0.16} height={SIGN.h - 0.32} position={[0, SIGN.y + 0.08 + (SIGN.h - 0.32) / 2, PILLAR.w / 2 + 0.222]} />
      {/* name board across the pillars, high enough to drive under */}
      <group position={[0, SIGN.y + SIGN.h / 2, PILLAR.w / 2 + 0.23]}>
        <Label font="bodyBold" size={0.44} color={COLORS.ink} position={[0, 0.2, 0]}>
          {NAME}
        </Label>
        <Label size={0.42} color={COLORS.ink} position={[0, -0.42, 0]}>
          {MARKS}
        </Label>
      </group>
      <Pad
        id="campus-school"
        label="Read about school in Delhi"
        action={{ kind: 'panel', panel: 'school' }}
        position={[SCHOOL.pad[0] - SCHOOL.x, Y.pad, SCHOOL.pad[1] - SCHOOL.z]}
        radius={2.3}
        icon="School"
      />
    </group>
  );
}
