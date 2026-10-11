import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { AdditiveBlending, CircleGeometry, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { Label } from '../../components/Label.tsx';
import { Pad } from '../../components/Pad.tsx';
import { COLORS } from '../../config/palette.ts';
import { gaming } from '../../data/profile.ts';
import { env } from '../../world/env.ts';
import { NOISE } from '../../world/glsl.ts';
import { box, cyl, flatMaterial, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { Sign } from '../career/kit/sign.tsx';
import { placeParts, tube } from './bike.ts';
import { GAME_BOARD, GAMING_PAD, GAME_SHELF, DEN } from './plan.ts';

// The gaming den: a raised booth with a big screen running a little first-person scene, a desk with
// a console and a controller, a gaming chair, LED trim, and beside it a shelf with the seven games
// from profile.ts. The board in front gives the PlayStation and Steam names. No logos anywhere:
// the covers are colour fields and simple shapes with the title in text.

const PURPLE = '#7c5cff';
const W = 7.6; // platform width
const D = 5.2; // depth
const FLOOR = 0.45;
const WALL_H = 3.7;
const SCREEN = { w: 4.9, h: 2.75, y: FLOOR + 0.75 };
const DESK = { z: -0.25, w: 3.6, d: 1.05, h: 0.86 };

const SCREEN_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
${NOISE}
float box1(vec2 p, vec2 a, vec2 b) { vec2 s = step(a, p) * step(p, b); return s.x * s.y; }
void main() {
  vec2 uv = vUv;
  float t = uTime;
  // Dusk sky over a skyline, a floor in perspective, a crosshair and targets that pop up.
  vec3 col = mix(vec3(0.95, 0.55, 0.35), vec3(0.12, 0.16, 0.38), smoothstep(0.35, 1.0, uv.y));
  float sun = smoothstep(0.09, 0.07, length((uv - vec2(0.72, 0.5)) * vec2(1.78, 1.0)));
  col = mix(col, vec3(1.0, 0.86, 0.55), sun);
  float bx = floor((uv.x + t * 0.01) * 14.0);
  float bh = 0.36 + vw_hash12(vec2(bx, 3.0)) * 0.26;
  float building = step(uv.y, bh) * step(0.33, uv.y);
  vec2 win = fract(vec2((uv.x + t * 0.01) * 14.0 * 3.0, uv.y * 40.0));
  float lit = step(0.6, vw_hash12(floor(vec2((uv.x + t * 0.01) * 42.0, uv.y * 40.0)))) * step(0.3, win.x) * step(0.3, win.y);
  col = mix(col, mix(vec3(0.12, 0.13, 0.22), vec3(1.0, 0.82, 0.45), lit * 0.9), building);
  // Floor: a grid running towards the horizon.
  if (uv.y < 0.33) {
    float d = 0.33 - uv.y;
    vec2 g = vec2((uv.x - 0.5) / (d + 0.02), 1.0 / (d + 0.02) + t * 2.0);
    vec2 f = abs(fract(g * vec2(0.5, 0.25)) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.06, min(f.x, f.y));
    col = mix(vec3(0.16, 0.12, 0.26), vec3(0.48, 0.36, 1.0), line * 0.8);
  }
  // A target every 1.4 s somewhere around the middle; it flashes when the shot lands.
  float k = floor(t / 1.4);
  float ph = fract(t / 1.4);
  vec2 tp = vec2(0.3 + vw_hash12(vec2(k, 1.0)) * 0.4, 0.38 + vw_hash12(vec2(k, 2.0)) * 0.28);
  vec2 dp = (uv - tp) * vec2(1.78, 1.0);
  float r = length(dp);
  float target = (1.0 - smoothstep(0.035, 0.04, r)) * step(ph, 0.75);
  float ringT = smoothstep(0.004, 0.0, abs(r - 0.055)) * step(ph, 0.75);
  col = mix(col, vec3(0.95, 0.2, 0.25), target);
  col = mix(col, vec3(1.0), ringT);
  float hit = smoothstep(0.75, 0.78, ph) * (1.0 - smoothstep(0.8, 1.0, ph));
  col += vec3(1.0, 0.9, 0.6) * hit * (1.0 - smoothstep(0.0, 0.18, r)) * 1.2;
  // Crosshair, drifting towards the target before each shot.
  vec2 aim = mix(vec2(0.5, 0.5), tp, smoothstep(0.1, 0.7, ph));
  vec2 a = abs((uv - aim) * vec2(1.78, 1.0));
  float cross = (step(a.y, 0.004) * step(0.012, a.x) * step(a.x, 0.045)) + (step(a.x, 0.004) * step(0.012, a.y) * step(a.y, 0.045));
  col = mix(col, vec3(0.4, 1.0, 0.55), clamp(cross, 0.0, 1.0));
  // Health and ammo bars along the bottom.
  col = mix(col, vec3(0.3, 0.95, 0.5), box1(uv, vec2(0.04, 0.05), vec2(0.04 + 0.22 * (0.7 + 0.3 * sin(t * 0.3)), 0.075)));
  col = mix(col, vec3(1.0, 0.85, 0.3), box1(uv, vec2(0.76, 0.05), vec2(0.96 - 0.05 * fract(t / 1.4), 0.075)));
  col *= 0.88 + 0.12 * step(0.5, fract(uv.y * 110.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function denGeometry(): BufferGeometry {
  const wall = '#2b2550';
  const parts: Part[] = [
    { geo: box(W, FLOOR, D, 0.06), color: '#3a3352', at: [0, FLOOR / 2, 0] },
    { geo: box(W - 0.4, 0.02, D - 0.4, 0), color: '#4b4370', at: [0, FLOOR + 0.01, 0] },
    // Back wall and short side walls.
    { geo: box(W, WALL_H, 0.3, 0.05), color: wall, at: [0, FLOOR + WALL_H / 2, -D / 2 + 0.15] },
    { geo: box(0.3, WALL_H, 2.4, 0.05), color: wall, at: [-W / 2 + 0.15, FLOOR + WALL_H / 2, -D / 2 + 1.2] },
    { geo: box(0.3, WALL_H, 2.4, 0.05), color: wall, at: [W / 2 - 0.15, FLOOR + WALL_H / 2, -D / 2 + 1.2] },
    // Screen bezel and stand.
    { geo: box(SCREEN.w + 0.24, SCREEN.h + 0.24, 0.14, 0.05), color: '#121318', at: [0, SCREEN.y + SCREEN.h / 2, -D / 2 + 0.38] },
    // Desk.
    { geo: box(DESK.w, 0.09, DESK.d, 0.03), color: '#3d4150', at: [0, FLOOR + DESK.h, DESK.z] },
    { geo: box(0.1, DESK.h, DESK.d - 0.1, 0.02), color: '#23262d', at: [-DESK.w / 2 + 0.15, FLOOR + DESK.h / 2, DESK.z] },
    { geo: box(0.1, DESK.h, DESK.d - 0.1, 0.02), color: '#23262d', at: [DESK.w / 2 - 0.15, FLOOR + DESK.h / 2, DESK.z] },
    // Speakers either side of the screen.
    { geo: box(0.36, 0.62, 0.32, 0.05), color: '#1b1d24', at: [-DESK.w / 2 + 0.35, FLOOR + DESK.h + 0.36, DESK.z - 0.25] },
    { geo: box(0.36, 0.62, 0.32, 0.05), color: '#1b1d24', at: [DESK.w / 2 - 0.35, FLOOR + DESK.h + 0.36, DESK.z - 0.25] },
    // Console: white shell with a dark band.
    { geo: box(0.95, 0.16, 0.62, 0.05), color: '#f1f1f4', at: [0.95, FLOOR + DESK.h + 0.13, DESK.z - 0.1], rot: [0, -0.25, 0] },
    { geo: box(0.97, 0.05, 0.64, 0.02), color: '#23262d', at: [0.95, FLOOR + DESK.h + 0.13, DESK.z - 0.1], rot: [0, -0.25, 0] },
    // Rug.
    { geo: new CircleGeometry(1.7, 32), color: '#5b3fb0', at: [0.2, FLOOR + 0.025, 1.0], rot: [-Math.PI / 2, 0, 0] },
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: box(0.32, WALL_H + 0.5, 0.32, 0.05), color: '#3b3463', at: [s * (W / 2 - 0.16), FLOOR + (WALL_H + 0.5) / 2, D / 2 - 0.3] });
  }
  parts.push({ geo: box(W, 0.8, 0.32, 0.08), color: '#3b3463', at: [0, FLOOR + WALL_H + 0.1, D / 2 - 0.3] });
  // Controller on the desk, held towards the camera: body, grips, sticks, pad and four buttons.
  const cx = -0.35;
  const cy = FLOOR + DESK.h + 0.13;
  const cz = DESK.z + 0.2;
  parts.push({ geo: box(0.66, 0.12, 0.3, 0.06), color: '#2c2f38', at: [cx, cy, cz] });
  for (const s of [-1, 1]) {
    parts.push({ geo: new SphereGeometry(0.13, 12, 8), color: '#2c2f38', at: [cx + s * 0.3, cy - 0.01, cz + 0.13], scale: [1, 0.75, 1.4] });
    parts.push({ geo: cyl(0.055, 0.055, 0.05, 12), color: '#16181d', at: [cx + s * 0.12, cy + 0.07, cz + 0.06] });
    parts.push({ geo: cyl(0.045, 0.045, 0.02, 12), color: '#5b616b', at: [cx + s * 0.12, cy + 0.1, cz + 0.06] });
  }
  parts.push({ geo: box(0.12, 0.03, 0.04, 0.01), color: '#5b616b', at: [cx - 0.22, cy + 0.07, cz - 0.05] });
  parts.push({ geo: box(0.04, 0.03, 0.12, 0.01), color: '#5b616b', at: [cx - 0.22, cy + 0.07, cz - 0.05] });
  const buttons = ['#5fbf7f', '#e36b6b', '#6f8fe8', '#e8c35f'];
  [[0, -0.05], [0.05, 0], [-0.05, 0], [0, 0.05]].forEach(([dx, dz], i) => {
    parts.push({ geo: cyl(0.022, 0.022, 0.03, 10), color: buttons[i], at: [cx + 0.22 + dx, cy + 0.07, cz - 0.05 + dz] });
  });
  // Gaming chair, turned a little as if just pushed back.
  const chair: Part[] = [];
  const red = '#d6313a';
  const black = '#1d1f26';
  chair.push({ geo: box(0.72, 0.16, 0.7, 0.06), color: black, at: [0, 0.62, 0] });
  chair.push({ geo: box(0.7, 1.15, 0.16, 0.08), color: black, at: [0, 1.25, 0.32], rot: [0.12, 0, 0] });
  chair.push({ geo: box(0.32, 0.95, 0.17, 0.04), color: red, at: [0, 1.2, 0.34], rot: [0.12, 0, 0] });
  chair.push({ geo: box(0.36, 0.2, 0.18, 0.06), color: red, at: [0, 1.88, 0.42], rot: [0.12, 0, 0] });
  for (const s of [-1, 1]) {
    chair.push({ geo: box(0.08, 0.06, 0.45, 0.02), color: black, at: [s * 0.38, 0.88, 0.02] });
    chair.push({ geo: box(0.05, 0.24, 0.05, 0.01), color: black, at: [s * 0.38, 0.75, 0.0] });
  }
  chair.push({ geo: cyl(0.05, 0.05, 0.45, 10), color: '#8d939c', at: [0, 0.32, 0] });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    chair.push(tube([0, 0.1, 0], [Math.cos(a) * 0.38, 0.06, Math.sin(a) * 0.38], 0.035, black));
    chair.push({ geo: new SphereGeometry(0.06, 8, 6), color: '#3a3f4b', at: [Math.cos(a) * 0.38, 0.05, Math.sin(a) * 0.38] });
  }
  return paint([...parts, ...placeParts(chair, [0.85, FLOOR, 1.0], -0.45)]);
}

// LED strips: along the top of the back wall, the side walls and the platform edge.
function ledGeometry(): BufferGeometry {
  return paint([
    { geo: box(W - 0.7, 0.07, 0.06, 0), color: '#4de1ff', at: [0, FLOOR + WALL_H - 0.12, -D / 2 + 0.33] },
    { geo: box(0.06, WALL_H - 0.5, 0.06, 0), color: '#ff4fd8', at: [-W / 2 + 0.33, FLOOR + WALL_H / 2, -D / 2 + 0.33] },
    { geo: box(0.06, WALL_H - 0.5, 0.06, 0), color: '#ff4fd8', at: [W / 2 - 0.33, FLOOR + WALL_H / 2, -D / 2 + 0.33] },
    { geo: box(W - 0.2, 0.06, 0.04, 0), color: '#4de1ff', at: [0, FLOOR - 0.08, D / 2 + 0.01] },
    { geo: box(0.08, 0.04, 0.08, 0), color: '#4de1ff', at: [0.95 + 0.4, FLOOR + DESK.h + 0.2, DESK.z + 0.1] },
  ]);
}

// Seven game cases standing on a shelf, cover art from plain shapes.
type Cover = { bg: string; band: string; ink: string; art: Part[] };
const CASE = { w: 1.5, h: 2.05, d: 0.18, gap: 0.16, lift: 0.5 };

const disc = (r: number) => new CircleGeometry(r, 24);
const tri = () => new CircleGeometry(0.42, 3);

function coverArt(i: number, x: number, y: number, z: number): Cover {
  const top = y + CASE.h * 0.73;
  const flat = (geo: BufferGeometry, color: string, dx: number, dy: number, s: [number, number, number] = [1, 1, 1], rot = 0): Part => ({ geo, color, at: [x + dx, top + dy, z], scale: s, rot: [0, 0, rot] });
  switch (i) {
    case 0: // CS:GO: a crosshair on orange
      return { bg: '#e8892e', band: '#23262d', ink: '#ffffff', art: [
        flat(disc(0.3), '#23262d', 0, 0), flat(disc(0.22), '#e8892e', 0, 0, [1, 1, 1]),
        flat(new PlaneGeometry(0.06, 0.62), '#23262d', 0, 0), flat(new PlaneGeometry(0.62, 0.06), '#23262d', 0, 0),
      ] };
    case 1: // Valorant: red with a white slash
      return { bg: '#e2444f', band: '#1b1d24', ink: '#ffffff', art: [flat(new PlaneGeometry(0.14, 0.8), '#f6f4ee', 0, 0, [1, 1, 1], 0.6), flat(new PlaneGeometry(0.08, 0.5), '#1b1d24', 0.22, -0.1, [1, 1, 1], 0.6)] };
    case 2: // Elden Ring: a gold circle on dark
      return { bg: '#2a2733', band: '#121116', ink: '#f2d27a', art: [flat(disc(0.34), '#e8c35f', 0, 0), flat(disc(0.29), '#2a2733', 0, 0), flat(new PlaneGeometry(0.04, 0.7), '#e8c35f', 0, 0)] };
    case 3: // Sekiro: white moon over red
      return { bg: '#b8262e', band: '#16181d', ink: '#ffffff', art: [flat(disc(0.26), '#f6f4ee', 0.15, 0.08), flat(tri(), '#16181d', -0.1, -0.25, [1.3, 0.55, 1], Math.PI / 2)] };
    case 4: // Black Myth: Wukong: golden peaks
      return { bg: '#c9963f', band: '#2b1d14', ink: '#fff6e0', art: [flat(tri(), '#5a3b22', -0.18, -0.12, [1, 1, 1], Math.PI / 2), flat(tri(), '#3d2a1a', 0.2, -0.18, [0.8, 0.8, 1], Math.PI / 2), flat(disc(0.1), '#fff1c4', 0.25, 0.25)] };
    case 5: // The Last of Us: sunset over green
      return { bg: '#3f7d5c', band: '#1d2b22', ink: '#ffffff', art: [flat(disc(0.24), '#f2a35c', 0, 0.05), flat(new PlaneGeometry(1.2, 0.24), '#2a5a40', 0, -0.2)] };
    default: // Red Dead Redemption 2: red desert sun and a mesa
      return { bg: '#d94b2b', band: '#2b1712', ink: '#fff0dc', art: [flat(disc(0.26), '#f8c96a', 0.1, 0.12), flat(new PlaneGeometry(0.7, 0.22), '#5a2316', -0.12, -0.18), flat(new PlaneGeometry(0.45, 0.12), '#5a2316', -0.12, -0.02)] };
  }
}

function shelfGeometry() {
  const n = gaming.games.length;
  const width = n * CASE.w + (n - 1) * CASE.gap;
  const frame: Part[] = [
    { geo: box(width + 0.7, CASE.lift, 0.8, 0.06), color: '#3a3352', at: [0, CASE.lift / 2, 0] },
    { geo: box(width + 0.7, CASE.h + 0.5, 0.16, 0.05), color: '#2b2550', at: [0, CASE.lift + (CASE.h + 0.5) / 2 - 0.1, -0.36] },
  ];
  const face: Part[] = [];
  const titles: { x: number; y: number; ink: string }[] = [];
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + CASE.w / 2 + i * (CASE.w + CASE.gap);
    const y = CASE.lift;
    const zf = CASE.d / 2 + 0.006;
    const c = coverArt(i, x, y, zf + 0.004);
    frame.push({ geo: box(CASE.w, CASE.h, CASE.d, 0.03), color: '#1a1b20', at: [x, y + CASE.h / 2, 0] });
    face.push({ geo: new PlaneGeometry(CASE.w - 0.1, CASE.h - 0.1), color: c.bg, at: [x, y + CASE.h / 2, zf] });
    face.push({ geo: new PlaneGeometry(CASE.w - 0.1, CASE.h * 0.42), color: c.band, at: [x, y + CASE.h * 0.24, zf + 0.002] });
    face.push(...c.art);
    titles.push({ x, y: y + CASE.h * 0.24, ink: c.ink });
  }
  return { frame: paint(frame), face: paint(face), titles, width };
}

export function Gaming() {
  const den = useMemo(denGeometry, []);
  const led = useMemo(ledGeometry, []);
  const shelf = useMemo(shelfGeometry, []);
  const ledMat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const screen = useMemo(() => ({
    geo: new PlaneGeometry(SCREEN.w, SCREEN.h),
    mat: new ShaderMaterial({ vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, uniforms: { uTime: env.time }, toneMapped: false }),
    halo: new MeshBasicMaterial({ color: '#7c8cff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  }), []);
  useEffect(() => () => {
    ledMat.dispose();
    screen.mat.dispose();
    screen.halo.dispose();
  }, [ledMat, screen]);
  // The screen washes the back wall at night.
  useFrame(() => {
    screen.halo.opacity = env.night.value * 0.35;
  });

  return (
    <group>
      <group position={[DEN.x, 0, DEN.z]}>
        <mesh geometry={den} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={led} material={ledMat} />
        <mesh geometry={screen.geo} material={screen.mat} position={[0, SCREEN.y + SCREEN.h / 2, -D / 2 + 0.46]} />
        <mesh position={[0, SCREEN.y + SCREEN.h / 2, -D / 2 + 0.31]} material={screen.halo}>
          <planeGeometry args={[SCREEN.w + 2.6, SCREEN.h + 1.6]} />
        </mesh>
        <Label font="display" size={0.62} color={COLORS.paper} position={[0, FLOOR + WALL_H + 0.1, D / 2 - 0.13]}>
          Gaming den
        </Label>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[W / 2, (FLOOR + 0.35) / 2, D / 2]} position={[0, (FLOOR + 0.35) / 2, 0]} />
          <CuboidCollider args={[W / 2, (FLOOR + WALL_H) / 2, 0.2]} position={[0, (FLOOR + WALL_H) / 2, -D / 2 + 0.15]} />
          {[-1, 1].map((s) => (
            <CuboidCollider key={s} args={[0.2, (FLOOR + WALL_H) / 2, 1.3]} position={[s * (W / 2 - 0.15), (FLOOR + WALL_H) / 2, -D / 2 + 1.2]} />
          ))}
          {[-1, 1].map((s) => (
            <CuboidCollider key={`p${s}`} args={[0.2, (FLOOR + WALL_H + 0.5) / 2, 0.2]} position={[s * (W / 2 - 0.16), (FLOOR + WALL_H + 0.5) / 2, D / 2 - 0.3]} />
          ))}
        </RigidBody>
      </group>
      <group position={[GAME_SHELF.x, 0, GAME_SHELF.z]}>
        <mesh geometry={shelf.frame} material={paintMaterial} castShadow receiveShadow />
        <mesh geometry={shelf.face} material={flatMaterial} />
        {shelf.titles.map((t, i) => (
          <Label key={gaming.games[i]} font="display" size={0.3} lineHeight={1.05} color={t.ink} maxWidth={CASE.w - 0.24} textAlign="center"
            position={[t.x, t.y, CASE.d / 2 + 0.02]}>
            {gaming.games[i]}
          </Label>
        ))}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[shelf.width / 2 + 0.35, (CASE.lift + CASE.h) / 2, 0.42]} position={[0, (CASE.lift + CASE.h) / 2, -0.1]} />
        </RigidBody>
      </group>
      <Sign title="Gaming" lines={[`PlayStation: ${gaming.playstation}`, `Steam: ${gaming.steam}`, 'Plays a lot of CS:GO']} width={5.6} titleSize={0.6} lineSize={0.34}
        accent={PURPLE} lift={0.8} position={[GAME_BOARD.x, 0, GAME_BOARD.z]} />
      <Pad id="sports-gaming" label="Read about gaming" icon="Gaming" action={{ kind: 'panel', panel: 'gaming' }} position={[GAMING_PAD.x, 0, GAMING_PAD.z]} radius={2.4} color={PURPLE} />
    </group>
  );
}

