import { use, useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry, SRGBColorSpace } from 'three';
import type { BufferGeometry, Texture } from 'three';
import { mergeParts } from './geom.ts';
import type { Part } from './geom.ts';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { earlyProjects } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { loadCanvasFonts } from './canvas.ts';
import { worldX, worldZ } from './frame.ts';
import { posterTexture } from './posters.ts';

// Early projects corner: four arcade cabinets under a striped awning, one per early project in
// profile.ts, with its screenshot (or a drawn poster) on the screen. One pad opens the panel;
// parking on it brings the camera closer so the screens and cabinet names can be read.

const CAB_W = 1.62;
const CAB_D = 1.05;
const CAB_H = 2.55;
const GAP = 0.24;
const SIDES = ['#e2557f', '#7c5cff', '#3fa7b5', '#f2c230'];
const SCREEN = { w: 1.2, h: 0.92, y: 1.56, z: 0.47, tilt: -0.2 };
const WALL_H = 4.0;
const VALANCE = 0.42;
const AWNING_FRONT = 1.75; // how far the awning reaches in front of the wall
const CAMERA_ID = 'projects-arcade';
const CLOSE_UP = 19; // camera distance while parked on the pad

const years = [...new Set(earlyProjects.map((p) => p.year))].toSorted((a, b) => a - b);
const YEARS = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0]);

// One cabinet as a single vertex-coloured geometry. Origin at the floor, front faces +Z.
function cabinetGeometry(side: string): BufferGeometry {
  const ink = COLORS.ink;
  const half = CAB_W / 2;
  const front = CAB_D / 2;
  return mergeParts([
    { g: new BoxGeometry(0.12, CAB_H, CAB_D), color: side, at: [-half + 0.06, CAB_H / 2, 0] },
    { g: new BoxGeometry(0.12, CAB_H, CAB_D), color: side, at: [half - 0.06, CAB_H / 2, 0] },
    { g: new BoxGeometry(CAB_W - 0.24, CAB_H - 0.1, CAB_D - 0.1), color: ink, at: [0, CAB_H / 2 - 0.05, -0.04] },
    { g: new BoxGeometry(CAB_W - 0.24, 0.96, 0.05), color: side, at: [0, 0.48, front - 0.05] },
    { g: new BoxGeometry(0.36, 0.42, 0.03), color: '#3a3f4b', at: [0, 0.56, front - 0.01] },
    { g: new BoxGeometry(0.16, 0.04, 0.02), color: '#f2c230', at: [0, 0.66, front + 0.01] },
    // control deck with a joystick and two buttons
    { g: new BoxGeometry(CAB_W - 0.06, 0.14, 0.5), color: COLORS.inkSoft, at: [0, 1.03, front + 0.12], rot: [0.22, 0, 0] },
    { g: new CylinderGeometry(0.028, 0.028, 0.24, 8), color: ink, at: [-0.36, 1.2, front + 0.14] },
    { g: new SphereGeometry(0.075, 10, 8), color: COLORS.accent, at: [-0.36, 1.32, front + 0.14] },
    { g: new CylinderGeometry(0.065, 0.065, 0.05, 12), color: '#f2c230', at: [0.14, 1.11, front + 0.17], rot: [0.22, 0, 0] },
    { g: new CylinderGeometry(0.065, 0.065, 0.05, 12), color: '#5ee07a', at: [0.4, 1.12, front + 0.12], rot: [0.22, 0, 0] },
    // screen bezel and marquee
    { g: new BoxGeometry(SCREEN.w + 0.16, SCREEN.h + 0.16, 0.05), color: '#111216', at: [0, SCREEN.y, SCREEN.z], rot: [SCREEN.tilt, 0, 0] },
    { g: new BoxGeometry(CAB_W - 0.14, 0.46, 0.26), color: '#fff3c9', at: [0, CAB_H - 0.26, front - 0.16] },
    { g: new BoxGeometry(CAB_W + 0.04, 0.1, CAB_D + 0.06), color: side, at: [0, CAB_H + 0.02, 0] },
  ]);
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
  useEffect(() => () => useStore.getState().clearCameraOverride(CAMERA_ID), []);
  const closeUp = (on: boolean) => {
    const store = useStore.getState();
    if (!on) return store.clearCameraOverride(CAMERA_ID);
    // Look between the car and the cabinets; on narrow screens keep the car centred, clear of the
    // interact button below it. With reduced motion the rig cuts to this instead of gliding.
    const narrow = window.innerWidth < window.innerHeight;
    const tz = narrow ? padZ : padZ - 1.3;
    store.setCameraOverride({ id: CAMERA_ID, target: [worldX(x, tz), 1, worldZ(x, tz)], distance: CLOSE_UP, blend: 1.2 });
  };
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
        <Label font="display" size={0.36} color={COLORS.paper} position={[0, WALL_H - 0.38 - VALANCE / 2 + 0.01, frontZ + 0.05]}>
          {`Early projects · ${YEARS}`}
        </Label>
      </group>
      <Pad id="projects-early" label="Read about the early projects" action={{ kind: 'panel', panel: 'project-early' }} position={[x, 0, padZ]}
        onEnter={() => closeUp(true)} onLeave={() => closeUp(false)} />
    </group>
  );
}
