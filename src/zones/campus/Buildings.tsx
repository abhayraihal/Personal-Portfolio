import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Label } from '../../components/Label.tsx';
import { Model, modelScale } from '../../components/Model.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { MODELS } from '../../config/models.ts';
import { panels } from '../../data/profile.ts';
import { mergeParts, roundedBox } from './boxes.ts';
import { Y } from './Ground.tsx';
import { BUILDINGS, EDU_PAD, MONUMENT } from './layout.ts';

// Wall footprints (native units) measured from the GLBs; the upper floors sit inside them.
const FOOTPRINT = {
  'building-campus-main': { x0: -0.84, x1: 0.88, z0: -0.68, z1: 0.6 },
  'building-campus-hostel': { x0: -0.63, x1: 0.63, z0: -0.7, z1: 0.69 },
} as const;

function Building({ name, x, z, scale }: { name: keyof typeof FOOTPRINT; x: number; z: number; scale: number }) {
  const f = FOOTPRINT[name];
  const s = modelScale(name) * scale;
  const h = MODELS[name].max[1] * s;
  return (
    <group position={[x, 0, z]}>
      <Model name={name} scale={scale} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[((f.x1 - f.x0) * s) / 2, h / 2, ((f.z1 - f.z0) * s) / 2]}
          position={[((f.x0 + f.x1) * s) / 2, h / 2, ((f.z0 + f.z1) * s) / 2]}
        />
      </RigidBody>
    </group>
  );
}

const edu = panels.education;
const DEGREE = edu.kicker ?? '';
const YEARS_AND_GRADE = (edu.meta ?? []).slice(0, 2).join(' · '); // '2020 – 2024 · CGPA 8.13'

// Entrance monument: a white wall with a green cap, the institute name and the degree.
function Monument() {
  const { x, z, width } = MONUMENT;
  const h = 3.1;
  const base = 0.32;
  const geo = useMemo(() => mergeParts([
    { geo: roundedBox(width + 0.5, base, 1.5, 0.08), color: '#cfc8ba', position: [0, base / 2, 0] },
    { geo: roundedBox(width, h, 0.6, 0.1), color: '#f7f3ea', position: [0, base + h / 2, 0] },
    { geo: roundedBox(width + 0.16, 0.28, 0.72, 0.06), color: COLORS.iit, position: [0, base + h + 0.08, 0] },
  ]), [width]);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2 + 0.2, (h + base) / 2, 0.7]} position={[0, (h + base) / 2, 0]} />
      </RigidBody>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      <group position={[0, base, 0.31]}>
        <Label font="display" size={1.25} color={COLORS.iit} position={[0, 2.25, 0]}>
          IIT Mandi
        </Label>
        <Label size={0.4} position={[0, 1.18, 0]}>
          {DEGREE}
        </Label>
        <Label font="bodyBold" size={0.4} color={COLORS.inkSoft} position={[0, 0.58, 0]}>
          {YEARS_AND_GRADE}
        </Label>
      </group>
    </group>
  );
}

export function Buildings() {
  return (
    <group name="campus-buildings">
      <Building name="building-campus-main" {...BUILDINGS.main} />
      <Building name="building-campus-hostel" {...BUILDINGS.hostel} />
      <Monument />
      <Pad
        id="campus-education"
        label="Read about IIT Mandi"
        action={{ kind: 'panel', panel: 'education' }}
        position={[EDU_PAD[0], Y.pad, EDU_PAD[1]]}
        radius={2.4}
        icon="IIT Mandi"
      />
    </group>
  );
}
