import { use, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { ConvexHullCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { ExtrudeGeometry, PlaneGeometry, Shape, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { loadCanvasFonts, textWidth } from './canvas.ts';
import { IMAGE_H, IMAGE_W, ROWS } from './layout.ts';
import type { Bay as BayDef } from './layout.ts';
import { posterTexture } from './posters.ts';
import { ZONE } from './frame.ts';

const FRAME = 0.28; // border around the image
const BOARD_DEPTH = 0.3;
const LIFT = 0.75; // ground to the bottom of the frame

// Plane whose UVs crop the texture to fill the frame ('cover'), or a smaller plane that shows the
// whole image ('contain').
function imageGeometry(aspect: number, fit: 'cover' | 'contain'): PlaneGeometry {
  const frameAspect = IMAGE_W / IMAGE_H;
  if (fit === 'contain') {
    const w = aspect >= frameAspect ? IMAGE_W : IMAGE_H * aspect;
    const h = aspect >= frameAspect ? IMAGE_W / aspect : IMAGE_H;
    return new PlaneGeometry(w, h);
  }
  const g = new PlaneGeometry(IMAGE_W, IMAGE_H);
  const uv = g.attributes.uv;
  let u0 = 0, u1 = 1, v0 = 0, v1 = 1;
  if (aspect > frameAspect) {
    const k = frameAspect / aspect;
    u0 = (1 - k) / 2;
    u1 = 1 - u0;
  } else {
    const k = aspect / frameAspect;
    v0 = (1 - k) / 2;
    v1 = 1 - v0;
  }
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  }
  uv.needsUpdate = true;
  return g;
}

function Billboard({ map, fit, z, x }: { map: Texture; fit: 'cover' | 'contain'; x: number; z: number }) {
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img.height ? img.width / img.height : IMAGE_W / IMAGE_H;
  const geometry = useMemo(() => imageGeometry(aspect, fit), [aspect, fit]);
  const W = IMAGE_W + FRAME * 2;
  const H = IMAGE_H + FRAME * 2;
  const cy = LIFT + H / 2;
  const postX = W / 2 - 0.8;
  const postH = LIFT + H - 0.3;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, H / 2, BOARD_DEPTH / 2]} position={[0, cy, -BOARD_DEPTH / 2]} />
        <CuboidCollider args={[0.18, postH / 2, 0.18]} position={[-postX, postH / 2, -BOARD_DEPTH - 0.1]} />
        <CuboidCollider args={[0.18, postH / 2, 0.18]} position={[postX, postH / 2, -BOARD_DEPTH - 0.1]} />
      </RigidBody>
      {[-postX, postX].map((px) => (
        <mesh key={px} position={[px, postH / 2, -BOARD_DEPTH - 0.1]} castShadow>
          <boxGeometry args={[0.32, postH, 0.32]} />
          <meshStandardMaterial color={COLORS.inkSoft} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, cy, -BOARD_DEPTH / 2]} castShadow receiveShadow>
        <boxGeometry args={[W, H, BOARD_DEPTH]} />
        <meshStandardMaterial color={COLORS.ink} roughness={0.85} />
      </mesh>
      {/* zone-colour strip along the top edge */}
      <mesh position={[0, LIFT + H + 0.09, -BOARD_DEPTH / 2]} castShadow>
        <boxGeometry args={[W, 0.18, BOARD_DEPTH + 0.04]} />
        <meshStandardMaterial color={ZONE.color} roughness={0.7} />
      </mesh>
      {fit === 'contain' && (
        <mesh position={[0, cy, 0.006]}>
          <planeGeometry args={[IMAGE_W, IMAGE_H]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      )}
      <mesh geometry={geometry} position={[0, cy, 0.012]}>
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ImageBillboard({ url, ...rest }: { url: string; fit: 'cover' | 'contain'; x: number; z: number }) {
  const tex = useTexture(url);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return <Billboard map={tex} {...rest} />;
}

function PosterBillboard({ bay, ...rest }: { bay: BayDef; fit: 'cover' | 'contain'; x: number; z: number }) {
  use(loadCanvasFonts());
  const p = bay.project;
  const map = posterTexture(p.panel, { title: p.title, tagline: p.tagline, chips: p.stack, year: p.year, art: bay.art ?? 'map' });
  return <Billboard map={map} {...rest} />;
}

// Lectern: a paper wedge whose top is tilted back 45 degrees, so it faces the camera head-on.
const LECTERN_W = 7.2;
const SLANT = 3.0;
const FRONT_H = 0.3;
const C45 = Math.SQRT1_2;
const DEPTH = SLANT * C45;
const RISE = SLANT * C45;
const BEVEL = 0.05;

function wedgeGeometry(): ExtrudeGeometry {
  const s = new Shape();
  // (x = depth towards the camera, y = height), extruded along the width.
  s.moveTo(DEPTH / 2, 0);
  s.lineTo(DEPTH / 2, FRONT_H);
  s.lineTo(-DEPTH / 2, FRONT_H + RISE);
  s.lineTo(-DEPTH / 2, 0);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: LECTERN_W, bevelEnabled: true, bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 2, curveSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(LECTERN_W / 2, 0, 0);
  return g;
}

let sharedWedge: ExtrudeGeometry | null = null;
const wedgeHull = new Float32Array(
  [
    [DEPTH / 2, 0], [DEPTH / 2, FRONT_H], [-DEPTH / 2, FRONT_H + RISE], [-DEPTH / 2, 0],
  ].flatMap(([d, h]) => [[-LECTERN_W / 2, h, d], [LECTERN_W / 2, h, d]]).flat(),
);

// Rounded-rectangle outline, centred, for chips and the year pill.
function pillShape(w: number, h: number): Shape {
  const r = h / 2;
  const s = new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, h / 2);
  s.absarc(-w / 2 + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return s;
}

const TITLE = 0.74;
const TAG = 0.37;
const CHIP = 0.31;
const CHIP_H = 0.54;
const CHIP_PAD = 0.24;
const CHIP_GAP = 0.16;

function Lectern({ bay, z }: { bay: BayDef; z: number }) {
  use(loadCanvasFonts());
  const p = bay.project;
  const wedge = useMemo(() => (sharedWedge ??= wedgeGeometry()), []);
  const x0 = -LECTERN_W / 2 + 0.42;
  const top = SLANT / 2;
  const titleY = top - 0.62;
  const titleW = textWidth(p.title, 'display', TITLE);
  const year = String(p.year);
  const yearW = textWidth(year, 'bodyBold', 0.32) + 0.44;

  // Chips flow left to right along the bottom edge.
  const chips = useMemo(() => {
    let cx = x0;
    return p.stack.map((label) => {
      const w = textWidth(label, 'bodyBold', CHIP) + CHIP_PAD * 2;
      const c = { label, x: cx + w / 2, w };
      cx += w + CHIP_GAP;
      return c;
    });
  }, [p.stack, x0]);
  const chipY = -top + 0.5;
  const chipGeometry = useMemo(() => {
    const parts = chips.map((c) => {
      const g = new ExtrudeGeometry(pillShape(c.w, CHIP_H), { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
      g.translate(c.x, chipY, 0);
      return g;
    });
    const yearPill = new ExtrudeGeometry(pillShape(yearW, 0.5), { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
    yearPill.translate(x0 + titleW + 0.3 + yearW / 2, titleY - 0.02, 0);
    parts.push(yearPill);
    return mergeGeometries(parts);
  }, [chips, chipY, titleW, titleY, x0, yearW]);

  const faceZ = BEVEL + 0.012;
  return (
    <group position={[bay.x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <ConvexHullCollider args={[wedgeHull]} />
      </RigidBody>
      <mesh geometry={wedge} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.paper} roughness={0.9} />
      </mesh>
      <group position={[0, FRONT_H + RISE / 2, 0]} rotation={[-Math.PI / 4, 0, 0]}>
        <mesh geometry={chipGeometry} position={[0, 0, faceZ]}>
          <meshBasicMaterial color={COLORS.accent} toneMapped={false} />
        </mesh>
        <Label font="display" size={TITLE} color={COLORS.ink} anchorX="left" anchorY="middle" position={[x0, titleY, faceZ + 0.01]}>
          {p.title}
        </Label>
        <Label font="bodyBold" size={0.32} color={COLORS.paper} anchorX="center" anchorY="middle"
          position={[x0 + titleW + 0.3 + yearW / 2, titleY - 0.02, faceZ + 0.03]}>
          {year}
        </Label>
        <Label size={TAG} color={COLORS.inkSoft} anchorX="left" anchorY="top" maxWidth={LECTERN_W - 0.84} lineHeight={1.22}
          position={[x0, top - 1.12, faceZ + 0.01]}>
          {p.tagline}
        </Label>
        {chips.map((c) => (
          <Label key={c.label} font="bodyBold" size={CHIP} color={COLORS.paper} anchorX="center" anchorY="middle"
            position={[c.x, chipY, faceZ + 0.03]}>
            {c.label}
          </Label>
        ))}
      </group>
    </group>
  );
}

export function Bay({ bay, onParked }: { bay: BayDef; onParked?: (parked: boolean) => void }) {
  const row = ROWS[bay.row];
  const p = bay.project;
  return (
    <group>
      {p.image ? (
        <ImageBillboard url={p.image} fit={bay.fit} x={bay.x} z={row.board} />
      ) : (
        <PosterBillboard bay={bay} fit={bay.fit} x={bay.x} z={row.board} />
      )}
      <Lectern bay={bay} z={row.lectern} />
      <Pad
        id={`projects-${p.panel}`}
        label={`Read about ${p.title}`}
        action={{ kind: 'panel', panel: p.panel }}
        position={[bay.x, 0, row.pad]}
        onEnter={onParked ? () => onParked(true) : undefined}
        onLeave={onParked ? () => onParked(false) : undefined}
      />
    </group>
  );
}
