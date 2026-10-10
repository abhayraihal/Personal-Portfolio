import { useLayoutEffect, useRef } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { Color, CylinderGeometry, ExtrudeGeometry, Matrix4, MeshStandardMaterial, Quaternion, RingGeometry, Shape, SphereGeometry, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { Label } from '../../components/Label.tsx';
import { modelScale, useMerged } from '../../components/Model.tsx';
import type { ModelName } from '../../config/models.ts';
import { ROUNDABOUT, ZONE_BY_ID } from '../../config/layout.ts';
import type { ZoneId } from '../../config/layout.ts';
import { COLORS } from '../../config/palette.ts';
import { DEG } from '../../config/world.ts';
import { hubAt } from './layout.ts';
import { mergeParts } from './merge.ts';
import { wood } from './PhotoBoard.tsx';
import { textWidth } from './textWidth.ts';

// The island in the middle of the roundabout: a raised stone planter (the car goes around it, not
// over it), flowers, and a signpost naming the exits in each zone's colour.

const R = ROUNDABOUT.r - ROUNDABOUT.width / 2 - 0.3; // planter radius, clear of the ring road
const H = 0.7; // planter height; tall enough to stop the chassis (its underside is 0.4 m up)
const POST_H = 5.6;
const SIGN_H = 0.72;
const SIGN_D = 0.1;
const TEXT = 0.42;
const TIP = 0.42;

const stone = new MeshStandardMaterial({ color: COLORS.rock, roughness: 0.95 });
const at = (y: number, rx = 0) => new Matrix4().compose(new Vector3(0, y, 0), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx), new Vector3(1, 1, 1));
const STONE = mergeParts([
  { geometry: new CylinderGeometry(R, R + 0.14, H - 0.12, 48, 1, true), matrix: at((H - 0.12) / 2) },
  { geometry: new CylinderGeometry(0.42, 0.5, 0.4, 12), matrix: at(H + 0.2) },
]);
const RIM = mergeParts([
  { geometry: new CylinderGeometry(R + 0.08, R + 0.08, 0.12, 48, 1, true), matrix: at(H - 0.06) },
  { geometry: new RingGeometry(R - 0.22, R + 0.08, 48), matrix: at(H, -Math.PI / 2) },
  { geometry: new SphereGeometry(0.2, 12, 8), matrix: at(H + POST_H + 0.12) },
]);
const rim = new MeshStandardMaterial({ color: '#b7b9c7', roughness: 0.9 });
const soil = new MeshStandardMaterial({ color: '#7a9a55', roughness: 1 });

type Dir = 'up' | 'left' | 'right';
type Sign = { zone: ZoneId; dir: Dir; y: number; tilt?: number; cap?: boolean };

// Straight up the career road to Amazon, Projects right, the ridge left, and back down past the
// spawn to the campus and sports dirt roads.
const SIGNS: Sign[] = [
  { zone: 'amazon', dir: 'up', y: 4.42, cap: true },
  { zone: 'career', dir: 'up', y: 3.7 },
  { zone: 'ridge', dir: 'left', y: 2.86 },
  { zone: 'projects', dir: 'right', y: 2.86 },
  { zone: 'campus', dir: 'left', y: 1.98, tilt: 20 * DEG },
  { zone: 'sports', dir: 'right', y: 1.98, tilt: -20 * DEG },
];

function luminance(hex: string) {
  const c = new Color(hex); // linear
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

// Arrow board outline in its own plane, text area starting at x = 0.
function arrowShape(len: number, dir: Dir, cap: boolean) {
  const s = new Shape();
  const h = SIGN_H / 2;
  if (dir === 'up') {
    const w = len / 2;
    s.moveTo(-w, -h);
    s.lineTo(w, -h);
    s.lineTo(w, h);
    if (cap) {
      s.lineTo(0, h + TIP);
    }
    s.lineTo(-w, h);
  } else {
    const k = dir === 'right' ? 1 : -1;
    s.moveTo(0, -h);
    s.lineTo(k * (len - TIP), -h);
    s.lineTo(k * len, 0);
    s.lineTo(k * (len - TIP), h);
    s.lineTo(0, h);
  }
  s.closePath();
  return s;
}

type Placed = Sign & { len: number; textX: number; textColor: string; matrix: Matrix4 };

// Board sizes and transforms in the post's frame (origin on the planter top).
const PLACED: Placed[] = SIGNS.map((sign) => {
  const zone = ZONE_BY_ID[sign.zone];
  const textW = textWidth(zone.title, 'display', TEXT);
  const len = sign.dir === 'up' ? Math.max(textW + 0.6, 2.7) : textW + 0.55 + TIP;
  const k = sign.dir === 'right' ? 1 : sign.dir === 'left' ? -1 : 0;
  // Side boards start just off the post; tilted ones pivot on the post.
  const matrix = new Matrix4().compose(new Vector3(k * 0.12, sign.y, 0.16), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), sign.tilt ?? 0), new Vector3(1, 1, 1));
  return { ...sign, len, textX: k * (len - TIP) * 0.5, textColor: luminance(zone.color) > 0.28 ? COLORS.ink : COLORS.paper, matrix };
});

// All boards in one mesh, coloured per vertex (slightly brightened: they face away from the sun).
const BOARDS = mergeParts(
  PLACED.map((p) => ({
    geometry: new ExtrudeGeometry(arrowShape(p.len, p.dir, !!p.cap), {
      depth: SIGN_D, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 1,
    }),
    matrix: p.matrix,
    color: `#${new Color(ZONE_BY_ID[p.zone].color).multiplyScalar(1.12).getHexString()}`,
  })),
);
const boardMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });

function SignLabel({ sign }: { sign: Placed }) {
  const pos = new Vector3(sign.textX, 0.01, SIGN_D + 0.045).applyMatrix4(sign.matrix);
  return (
    <Label font="display" size={TEXT} color={sign.textColor} position={[pos.x, pos.y, pos.z]} rotation={[0, 0, sign.tilt ?? 0]}>
      {ZONE_BY_ID[sign.zone].title}
    </Label>
  );
}

// Flowers on the planter top, one InstancedMesh per Kenney model.
function FlowerRing({ name, count, radius, scale, phase }: { name: ModelName; count: number; radius: number; scale: number; phase: number }) {
  const { geometry, material } = useMerged(name);
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const mat = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const up = new Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2;
      const k = modelScale(name) * scale * (0.9 + ((i * 37) % 7) / 30);
      p.set(Math.cos(a) * radius, H - 0.04, Math.sin(a) * radius);
      q.setFromAxisAngle(up, a * 2.3 + i);
      s.setScalar(k);
      m.setMatrixAt(i, mat.compose(p, q, s));
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [count, radius, scale, phase, name]);
  return <instancedMesh ref={mesh} args={[geometry, material, count]} castShadow receiveShadow />;
}

export function Roundabout() {
  const centre = hubAt(ROUNDABOUT.u, ROUNDABOUT.v);
  return (
    <group position={centre}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[H / 2, R]} position={[0, H / 2, 0]} />
        <CylinderCollider args={[POST_H / 2, 0.3]} position={[0, H + POST_H / 2, 0]} />
      </RigidBody>
      {/* Stone wall and post base, a capping ring and finial, and the soil bed set 4 cm in. */}
      <mesh geometry={STONE} material={stone} castShadow receiveShadow />
      <mesh geometry={RIM} material={rim} castShadow receiveShadow />
      <mesh material={soil} position={[0, H - 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[R - 0.2, 48]} />
      </mesh>
      <FlowerRing name="flowers-blue-poppy" count={7} radius={R - 1.2} scale={0.62} phase={0.3} />
      <FlowerRing name="flowers-tall" count={5} radius={R - 2.35} scale={0.85} phase={1.1} />
      <group position={[0, H, 0]}>
        <mesh material={wood} position={[0, POST_H / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.13, 0.15, POST_H, 10]} />
        </mesh>
        <mesh geometry={BOARDS} material={boardMaterial} castShadow receiveShadow />
        {PLACED.map((s) => (
          <SignLabel key={s.zone} sign={s} />
        ))}
      </group>
    </group>
  );
}
