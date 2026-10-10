import { use, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { ConvexHullCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { BoxGeometry, ExtrudeGeometry, PlaneGeometry, Shape, SRGBColorSpace } from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { useStore } from '../../state/store.ts';
import { loadCanvasFonts, textWidth } from './canvas.ts';
import { IMAGE_H, IMAGE_W, ROWS } from './layout.ts';
import type { Bay as BayDef } from './layout.ts';
import { coverTexture } from './posters.ts';
import { carNearZone, carX, carZ, ZONE } from './frame.ts';
import { mergeParts } from './geom.ts';

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

const BOARD_W = IMAGE_W + FRAME * 2;
const BOARD_H = IMAGE_H + FRAME * 2;
const BOARD_CY = LIFT + BOARD_H / 2;
const POST_X = BOARD_W / 2 - 0.8;
const POST_H = LIFT + BOARD_H - 0.3;

// Frame, posts and the zone-colour top strip: one geometry shared by all six billboards.
let frameGeometry: BufferGeometry | null = null;
const billboardFrame = () =>
  (frameGeometry ??= mergeParts([
    { g: new BoxGeometry(0.32, POST_H, 0.32), color: COLORS.inkSoft, at: [-POST_X, POST_H / 2, -BOARD_DEPTH - 0.1] },
    { g: new BoxGeometry(0.32, POST_H, 0.32), color: COLORS.inkSoft, at: [POST_X, POST_H / 2, -BOARD_DEPTH - 0.1] },
    { g: new RoundedBoxGeometry(BOARD_W, BOARD_H, BOARD_DEPTH, 2, 0.12), color: COLORS.ink, at: [0, BOARD_CY, -BOARD_DEPTH / 2] },
    { g: new RoundedBoxGeometry(BOARD_W - 0.1, 0.24, BOARD_DEPTH + 0.06, 1, 0.08), color: ZONE.color, at: [0, LIFT + BOARD_H + 0.06, -BOARD_DEPTH / 2] },
  ]));

// From the fixed 45-degree camera a billboard hides the ground behind it for about its own height.
// While the car is in that strip the board fades, so the car never disappears behind it. The
// materials stay transparent at full opacity otherwise, so fading never recompiles a shader.
const HIDES = LIFT + BOARD_H + 0.3;
const FADED = 0.22;

function useBehindFade(x: number, z: number) {
  const mats = useRef<(Material | null)[]>([]);
  const k = useRef(1);
  useFrame((_, delta) => {
    const near = carNearZone();
    const cz = carZ();
    const behind = near && Math.abs(carX() - x) < BOARD_W / 2 + 1.6 && cz < z - BOARD_DEPTH && cz > z - HIDES - 1;
    const goal = behind ? FADED : 1;
    if (k.current === goal) return;
    // fade while the car is around; snap back once it has left (a teleport out, say)
    const next = near ? k.current + (goal - k.current) * Math.min(1, delta * 8) : goal;
    k.current = Math.abs(goal - next) < 0.01 ? goal : next;
    for (const m of mats.current) {
      if (!m) continue;
      m.opacity = k.current;
      m.depthWrite = k.current === 1;
    }
  });
  return useMemo(() => [0, 1, 2].map((i) => (m: Material | null) => void (mats.current[i] = m)), []);
}

function Billboard({ map, fit, z, x }: { map: Texture; fit: 'cover' | 'contain'; x: number; z: number }) {
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img.height ? img.width / img.height : IMAGE_W / IMAGE_H;
  const geometry = useMemo(() => imageGeometry(aspect, fit), [aspect, fit]);
  const frame = useMemo(billboardFrame, []);
  const fadeRefs = useBehindFade(x, z);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[BOARD_W / 2, BOARD_H / 2, BOARD_DEPTH / 2]} position={[0, BOARD_CY, -BOARD_DEPTH / 2]} />
        <CuboidCollider args={[0.18, POST_H / 2, 0.18]} position={[-POST_X, POST_H / 2, -BOARD_DEPTH - 0.1]} />
        <CuboidCollider args={[0.18, POST_H / 2, 0.18]} position={[POST_X, POST_H / 2, -BOARD_DEPTH - 0.1]} />
      </RigidBody>
      <mesh geometry={frame} castShadow receiveShadow>
        <meshStandardMaterial ref={fadeRefs[0]} vertexColors roughness={0.85} transparent />
      </mesh>
      {fit === 'contain' && (
        <mesh position={[0, BOARD_CY, 0.006]}>
          <planeGeometry args={[IMAGE_W, IMAGE_H]} />
          <meshBasicMaterial ref={fadeRefs[1]} color="#ffffff" toneMapped={false} transparent />
        </mesh>
      )}
      <mesh geometry={geometry} position={[0, BOARD_CY, 0.012]}>
        <meshBasicMaterial ref={fadeRefs[2]} map={map} toneMapped={false} transparent />
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
  const map = coverTexture(p.panel, p.title, bay.art ?? 'map');
  return <Billboard map={map} {...rest} />;
}

// Lectern: a paper wedge whose top is tilted back 45 degrees, so it faces the camera head-on.
const LECTERN_W = 7.4;
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
const CHIP = 0.3;
const CHIP_H = 0.52;
const CHIP_PAD = 0.2;
const CHIP_GAP = 0.13;

// Wrap width for a tagline: the full room if it fits on one line, otherwise the narrowest width
// that still gives two lines, so the second line is never one or two stray words.
function taglineWidth(text: string, room: number): number {
  if (textWidth(text, 'body', TAG) <= room) return room;
  const words = text.split(' ');
  let best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = textWidth(words.slice(0, i).join(' '), 'body', TAG);
    const b = textWidth(words.slice(i).join(' '), 'body', TAG);
    best = Math.min(best, Math.max(a, b));
  }
  return best <= room ? best + 0.12 : room;
}

function Lectern({ bay, z }: { bay: BayDef; z: number }) {
  use(loadCanvasFonts());
  const p = bay.project;
  const wedge = useMemo(() => (sharedWedge ??= wedgeGeometry()), []);
  // At night the paper glows a little, like the lit billboards, so the ink text stays readable.
  const night = useStore((s) => s.night);
  const x0 = -LECTERN_W / 2 + 0.42;
  const top = SLANT / 2;
  const titleY = top - 0.62;
  const titleW = textWidth(p.title, 'display', TITLE);
  const year = String(p.year);
  const yearW = textWidth(year, 'bodyBold', 0.32) + 0.44;
  const tagW = useMemo(() => taglineWidth(p.tagline, LECTERN_W - 0.84), [p.tagline]);

  // Chips run left to right along the bottom edge, scaled down if the stack is too long to fit.
  const { chips, k } = useMemo(() => {
    const room = LECTERN_W - 0.84;
    const full = p.stack.reduce((sum, l) => sum + textWidth(l, 'bodyBold', CHIP) + CHIP_PAD * 2, 0) + CHIP_GAP * (p.stack.length - 1);
    const scale = Math.min(1, room / full);
    let cx = x0;
    const list = p.stack.map((label) => {
      const w = (textWidth(label, 'bodyBold', CHIP) + CHIP_PAD * 2) * scale;
      const c = { label, x: cx + w / 2, w };
      cx += w + CHIP_GAP * scale;
      return c;
    });
    return { chips: list, k: scale };
  }, [p.stack, x0]);
  const chipY = -top + 0.5;
  const chipGeometry = useMemo(() => {
    const parts = chips.map((c) => {
      const g = new ExtrudeGeometry(pillShape(c.w, CHIP_H * k), { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
      g.translate(c.x, chipY, 0);
      return g;
    });
    const yearPill = new ExtrudeGeometry(pillShape(yearW, 0.5), { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
    yearPill.translate(x0 + titleW + 0.3 + yearW / 2, titleY - 0.02, 0);
    parts.push(yearPill);
    return mergeGeometries(parts);
  }, [chips, chipY, k, titleW, titleY, x0, yearW]);

  const faceZ = BEVEL + 0.012;
  return (
    <group position={[bay.x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <ConvexHullCollider args={[wedgeHull]} />
      </RigidBody>
      <mesh geometry={wedge} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.paper} roughness={0.9} emissive={COLORS.paper} emissiveIntensity={night ? 0.42 : 0} />
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
        <Label size={TAG} color={COLORS.inkSoft} anchorX="left" anchorY="top" maxWidth={tagW} lineHeight={1.22}
          position={[x0, top - 1.12, faceZ + 0.01]}>
          {p.tagline}
        </Label>
        {chips.map((c) => (
          <Label key={c.label} font="bodyBold" size={CHIP * k} color={COLORS.paper} anchorX="center" anchorY="middle"
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
