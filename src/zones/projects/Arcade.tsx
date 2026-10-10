import { use, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, PlaneGeometry, Quaternion, SphereGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeParts } from './geom.ts';
import type { Part } from './geom.ts';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { earlyProjects } from '../../data/profile.ts';
import { loadCanvasFonts } from './canvas.ts';
import { posterTexture } from './posters.ts';

// Early projects corner: four arcade cabinets under a striped awning, one per early project in
// profile.ts, with its screenshot (or a drawn poster) on the screen. One pad opens the panel.

const CAB_W = 1.62;
const CAB_D = 1.05;
const CAB_H = 2.55;
const GAP = 0.24;
const SIDES = ['#e2557f', '#7c5cff', '#3fa7b5', '#f2c230'];
const SCREEN = { w: 1.2, h: 0.92, y: 1.56, z: 0.47, tilt: -0.2 };
const WALL_H = 4.0;
const VALANCE = 0.42;
const AWNING_FRONT = 1.75; // how far the awning reaches in front of the wall

const years = [...new Set(earlyProjects.map((p) => p.year))].toSorted((a, b) => a - b);
const YEARS = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0]);

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();

function part(g: BufferGeometry, hex: string, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]): BufferGeometry {
  _q.setFromEuler(_e.set(...rot));
  g.applyMatrix4(_m.compose(new Vector3(...pos), _q, new Vector3(1, 1, 1)));
  const c = new Color(hex);
  const out = g.index ? g.toNonIndexed() : g;
  const n = out.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new Float32BufferAttribute(arr, 3));
  out.deleteAttribute('uv');
  return out;
}

// One cabinet as a single vertex-coloured geometry. Origin at the floor, front faces +Z.
function cabinetGeometry(side: string): BufferGeometry {
  const s = side;
  const ink = COLORS.ink;
  const half = CAB_W / 2;
  const parts = [
    part(new BoxGeometry(0.12, CAB_H, CAB_D), s, [-half + 0.06, CAB_H / 2, 0]),
    part(new BoxGeometry(0.12, CAB_H, CAB_D), s, [half - 0.06, CAB_H / 2, 0]),
    part(new BoxGeometry(CAB_W - 0.24, CAB_H - 0.1, CAB_D - 0.1), ink, [0, CAB_H / 2 - 0.05, -0.04]),
    part(new BoxGeometry(CAB_W - 0.24, 0.96, 0.05), s, [0, 0.48, CAB_D / 2 - 0.05]),
    part(new BoxGeometry(0.36, 0.42, 0.03), '#3a3f4b', [0, 0.56, CAB_D / 2 - 0.01]),
    part(new BoxGeometry(0.16, 0.04, 0.02), '#f2c230', [0, 0.66, CAB_D / 2 + 0.01]),
    // control deck with a joystick and two buttons
    part(new BoxGeometry(CAB_W - 0.06, 0.14, 0.5), COLORS.inkSoft, [0, 1.03, CAB_D / 2 + 0.12], [0.22, 0, 0]),
    part(new CylinderGeometry(0.028, 0.028, 0.24, 8), ink, [-0.36, 1.2, CAB_D / 2 + 0.14]),
    part(new SphereGeometry(0.075, 10, 8), COLORS.accent, [-0.36, 1.32, CAB_D / 2 + 0.14]),
    part(new CylinderGeometry(0.065, 0.065, 0.05, 12), '#f2c230', [0.14, 1.11, CAB_D / 2 + 0.17], [0.22, 0, 0]),
    part(new CylinderGeometry(0.065, 0.065, 0.05, 12), '#5ee07a', [0.4, 1.12, CAB_D / 2 + 0.12], [0.22, 0, 0]),
    // screen bezel and marquee
    part(new BoxGeometry(SCREEN.w + 0.16, SCREEN.h + 0.16, 0.05), '#111216', [0, SCREEN.y, SCREEN.z], [SCREEN.tilt, 0, 0]),
    part(new BoxGeometry(CAB_W - 0.14, 0.46, 0.26), '#fff3c9', [0, CAB_H - 0.26, CAB_D / 2 - 0.16]),
    part(new BoxGeometry(CAB_W + 0.04, 0.1, CAB_D + 0.06), s, [0, CAB_H + 0.02, 0]),
  ];
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

function Screen({ map }: { map: Texture }) {
  return (
    <mesh position={[0, SCREEN.y + Math.sin(-SCREEN.tilt) * 0.03, SCREEN.z + 0.03]} rotation={[SCREEN.tilt, 0, 0]}>
      <primitive object={useMemo(() => coverPlane(map), [map])} attach="geometry" />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

function coverPlane(map: Texture): PlaneGeometry {
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img.height ? img.width / img.height : 1.3;
  const frame = SCREEN.w / SCREEN.h;
  const g = new PlaneGeometry(SCREEN.w, SCREEN.h);
  const uv = g.attributes.uv;
  const k = aspect > frame ? frame / aspect : aspect / frame;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (aspect > frame) uv.setX(i, (1 - k) / 2 + u * k);
    else uv.setY(i, (1 - k) / 2 + v * k);
  }
  return g;
}

function ImageScreen({ url }: { url: string }) {
  const tex = useTexture(url);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return <Screen map={tex} />;
}

function PosterScreen({ title, line, year }: { title: string; line: string; year: number }) {
  use(loadCanvasFonts());
  const map = posterTexture(`early-${title}`, { title, tagline: line, chips: [], year, art: 'chart' }, [640, 490]);
  return <Screen map={map} />;
}

function Cabinet({ index, x }: { index: number; x: number }) {
  const p = earlyProjects[index];
  const geometry = useMemo(() => cabinetGeometry(SIDES[index % SIDES.length]), [index]);
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      {p.image ? <ImageScreen url={p.image} /> : <PosterScreen title={p.title} line={p.line} year={p.year} />}
      <Label font="bodyBold" size={0.19} color={COLORS.ink} maxWidth={CAB_W - 0.3} textAlign="center" lineHeight={1.05}
        position={[0, CAB_H - 0.26, CAB_D / 2 - 0.02]}>
        {p.title}
      </Label>
    </group>
  );
}

// Back wall, floor mat, striped awning, valance and posts as one mesh.
function boothGeometry(wallW: number): BufferGeometry {
  const wallZ = -CAB_D / 2 - 0.25;
  const stripes = 10;
  const len = Math.hypot(AWNING_FRONT + 0.3, 0.38);
  const tilt = Math.atan2(0.38, AWNING_FRONT + 0.3);
  const sw = (wallW + 0.4) / stripes;
  const frontZ = wallZ + AWNING_FRONT + 0.3;
  const parts: Part[] = [
    { g: new BoxGeometry(wallW, WALL_H, 0.24), color: '#4b3c8f', at: [0, WALL_H / 2, wallZ] },
    { g: new PlaneGeometry(wallW, CAB_D + 1.6).rotateX(-Math.PI / 2), color: '#3b2f6b', at: [0, 0.026, 0.25] },
    { g: new BoxGeometry(wallW + 0.4, VALANCE, 0.08), color: COLORS.accent, at: [0, WALL_H - 0.38 - VALANCE / 2, frontZ] },
  ];
  for (let i = 0; i < stripes; i++) {
    const g = new BoxGeometry(sw + 0.002, 0.08, len).translate(-wallW / 2 - 0.2 + sw * (i + 0.5), 0, len / 2);
    parts.push({ g, color: i % 2 ? COLORS.paper : COLORS.accent, at: [0, WALL_H + 0.02, wallZ], rot: [tilt, 0, 0] });
  }
  for (const sx of [-1, 1]) parts.push({ g: new CylinderGeometry(0.07, 0.07, WALL_H - 0.38, 8), color: COLORS.ink, at: [sx * (wallW / 2 + 0.1), (WALL_H - 0.38) / 2, frontZ] });
  return mergeParts(parts);
}

export function Arcade({ x, z, padZ }: { x: number; z: number; padZ: number }) {
  const n = earlyProjects.length;
  const span = n * CAB_W + (n - 1) * GAP;
  const wallW = span + 1.0;
  const booth = useMemo(() => boothGeometry(wallW), [wallW]);
  const wallZ = -CAB_D / 2 - 0.25;
  const frontZ = wallZ + AWNING_FRONT + 0.3;
  return (
    <group>
      <group position={[x, 0, z]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[wallW / 2, WALL_H / 2, 0.12]} position={[0, WALL_H / 2, wallZ]} />
          <CuboidCollider args={[span / 2, CAB_H / 2, CAB_D / 2]} position={[0, CAB_H / 2, 0]} />
          {[-1, 1].map((sx) => (
            <CuboidCollider key={sx} args={[0.08, 1.6, 0.08]} position={[sx * (wallW / 2 + 0.1), 1.6, frontZ]} />
          ))}
        </RigidBody>
        <mesh geometry={booth} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
        {earlyProjects.map((_, i) => (
          <Cabinet key={i} index={i} x={-span / 2 + CAB_W / 2 + i * (CAB_W + GAP)} />
        ))}
        <Label font="display" size={0.3} color={COLORS.paper} position={[0, WALL_H - 0.38 - VALANCE / 2 + 0.01, frontZ + 0.05]}>
          {`Early projects · ${YEARS}`}
        </Label>
      </group>
      <Pad id="projects-early" label="Read about the early projects" action={{ kind: 'panel', panel: 'project-early' }} position={[x, 0, padZ]} />
    </group>
  );
}
