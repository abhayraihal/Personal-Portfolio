import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { AdditiveBlending, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Path, Quaternion, Shape, Vector3 } from 'three';
import type { InstancedMesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Label } from '../../../components/Label.tsx';
import { COLORS } from '../../../config/palette.ts';
import { car } from '../../../state/car.ts';
import { playSound } from '../../../state/events.ts';
import { useStore } from '../../../state/store.ts';
import { useBehindFade } from '../fade.ts';
import { carWithin, carX, carZ, ZONE } from '../frame.ts';
import { fixBounds, mergeParts } from '../geom.ts';
import type { Part } from '../geom.ts';
import { Y } from '../Plaza.tsx';
import { cinemaSignal } from './signals.ts';
import { setLabelText } from './text.ts';
import type { TextMesh } from './text.ts';

// LightsOut toy: a little drive-in. A projection booth with two film reels throws a beam onto
// the screen at the back; five signposts carry the site's five genre pages. Driving up the aisle
// over the tiles 1 to 5 lights that many stars on the screen, and stopping on a tile rates it:
// the screen then shows the average of the ratings given here, with whole and half stars the way
// the site draws a film's average. Parked on the LightsOut pad, the projector runs and the screen
// steps through the genres while the matching signpost lights up.

// Lot-local x (the toy group sits at the lot's centre); z values are zone-local.
const SCREEN = { z: -47, w: 6.3, h: 3.5, y0: 1.5 };
const BOOTH = { x: -2.6, z: -32.6, w: 1.7, d: 1.6, h: 2.2 };
const AISLE = { x: 0.15, w: 2.8, z0: -31.2, tile: 2.1, gap: 0.22 };
const POSTS = { x: 2.8, z0: -35.0, step: 2.15, sign: 1.55 };
// The genre pages linked from the site's Movies menu, in its order.
const GENRES = ['Horror', 'Comedy', 'Sci-fi', 'Action', 'Romance'];
const GENRE_COLORS = ['#8c2333', '#d99a14', '#23847f', '#cf5a26', '#c2457c'].map((c) => new Color(c));
const STAR = { r: 0.5, y: SCREEN.y0 + 1.68, gap: 1.14 };
const TILE_ON = new Color('#ffd23f');
const TILE_OFF = new Color('#4b3c8f');
const STAR_ON = new Color('#ffc21a');
const STAR_OFF = new Color('#9aa0b1');
const SIGN_DIM = 0.55;
const RANGE = 45;
const RATE_HOLD = 0.6; // seconds stopped on a tile to rate it
const GENRE_S = 1.6;
// From the project's SQL script and its admin page, on a board under the screen.
const MARQUEE = { text: '31 films · Add Movie page for admins', y: 0.86, w: 5.2 };

const tileZ = (k: number) => AISLE.z0 - AISLE.tile / 2 - k * (AISLE.tile + AISLE.gap);

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const _zAxis = new Vector3(0, 0, 1);
// The two film reels on the booth roof (centres).
const REELS: [number, number, number][] = [
  [BOOTH.x - 0.38, BOOTH.h + 0.78, BOOTH.z + 0.06],
  [BOOTH.x + 0.42, BOOTH.h + 0.92, BOOTH.z - 0.06],
];

// The left half of a five-point star (top point up). Right halves are the same mesh mirrored, so
// half stars can be lit.
function halfStar(): ExtrudeGeometry {
  const s = new Shape();
  const pts: [number, number][] = [];
  for (let j = 0; j <= 5; j++) {
    const idx = j;
    const a = Math.PI / 2 + (idx / 10) * Math.PI * 2;
    const r = idx % 2 ? STAR.r * 0.42 : STAR.r;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  s.moveTo(...pts[0]);
  for (let j = 1; j < pts.length; j++) s.lineTo(...pts[j]);
  s.closePath();
  return new ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
}

function reelShape(r: number): Shape {
  const s = new Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const h = new Path();
    h.absarc(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, r * 0.22, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const hub = new Path();
  hub.absarc(0, 0, r * 0.1, 0, Math.PI * 2, true);
  s.holes.push(hub);
  return s;
}

// Screen, booth, posts and their frames as one mesh.
function lotGeometry() {
  const sw = SCREEN.w;
  const top = SCREEN.y0 + SCREEN.h;
  const parts: Part[] = [
    // screen: dark frame, two legs, a back brace
    { g: new BoxGeometry(sw + 0.3, SCREEN.h + 0.3, 0.2), color: COLORS.ink, at: [0, SCREEN.y0 + SCREEN.h / 2, SCREEN.z - 0.04] },
    { g: new BoxGeometry(0.28, top, 0.28), color: COLORS.inkSoft, at: [-sw / 2 + 0.5, top / 2, SCREEN.z - 0.3] },
    { g: new BoxGeometry(0.28, top, 0.28), color: COLORS.inkSoft, at: [sw / 2 - 0.5, top / 2, SCREEN.z - 0.3] },
    { g: new RoundedBoxGeometry(MARQUEE.w, 0.5, 0.12, 2, 0.05), color: COLORS.ink, at: [0, MARQUEE.y, SCREEN.z - 0.06] },
    { g: new BoxGeometry(sw + 0.5, 0.18, 0.4), color: ZONE.color, at: [0, top + 0.24, SCREEN.z - 0.04] },
    // booth: walls, roof, a door, the lens on the back and a bracket for the reels
    { g: new BoxGeometry(BOOTH.w, BOOTH.h, BOOTH.d), color: '#f1e4cf', at: [BOOTH.x, BOOTH.h / 2, BOOTH.z] },
    { g: new BoxGeometry(BOOTH.w + 0.3, 0.16, BOOTH.d + 0.3), color: ZONE.color, at: [BOOTH.x, BOOTH.h + 0.08, BOOTH.z] },
    { g: new BoxGeometry(0.62, 1.35, 0.04), color: '#6b4a32', at: [BOOTH.x - 0.35, 0.68, BOOTH.z + BOOTH.d / 2 + 0.02] },
    { g: new BoxGeometry(0.5, 0.36, 0.04), color: '#2c3140', at: [BOOTH.x + 0.42, 1.55, BOOTH.z + BOOTH.d / 2 + 0.02] },
    { g: new CylinderGeometry(0.16, 0.2, 0.36, 14), color: COLORS.ink, at: [BOOTH.x + 0.35, 1.8, BOOTH.z - BOOTH.d / 2 - 0.12], rot: [Math.PI / 2, 0, 0] },
    { g: new BoxGeometry(0.1, 0.62, 0.1), color: COLORS.ink, at: [BOOTH.x - 0.38, BOOTH.h + 0.45, BOOTH.z] },
    { g: new BoxGeometry(0.1, 0.78, 0.1), color: COLORS.ink, at: [BOOTH.x + 0.42, BOOTH.h + 0.53, BOOTH.z - 0.12] },
  ];
  // genre signposts
  for (let i = 0; i < GENRES.length; i++) parts.push({ g: new CylinderGeometry(0.07, 0.08, 1.3, 8), color: COLORS.inkSoft, at: [POSTS.x, 0.65, POSTS.z0 - i * POSTS.step] });
  return mergeParts(parts);
}

// Light cone from the lens to the screen (four open sides).
function beamGeometry(): BufferGeometry {
  const a = [BOOTH.x + 0.35, 1.8, BOOTH.z - BOOTH.d / 2 - 0.3];
  const hw = SCREEN.w / 2 - 0.08;
  const z = SCREEN.z + 0.12;
  const c = [[-hw, SCREEN.y0 + 0.08], [hw, SCREEN.y0 + 0.08], [hw, SCREEN.y0 + SCREEN.h - 0.08], [-hw, SCREEN.y0 + SCREEN.h - 0.08]];
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = c[i];
    const q = c[(i + 1) % 4];
    pos.push(...a, p[0], p[1], z, q[0], q[1], z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return g;
}

export function DriveInToy({ position }: { position: [number, number, number] }) {
  const stars = useRef<InstancedMesh>(null);
  const tiles = useRef<InstancedMesh>(null);
  const signs = useRef<InstancedMesh>(null);
  const reels = useRef<InstancedMesh>(null);
  const beam = useRef<MeshBasicMaterial>(null);
  const screen = useRef<MeshStandardMaterial>(null);
  const status = useRef<TextMesh>(null);
  const headline = useRef<TextMesh>(null);
  const statusText = useRef('Stop on a tile to rate, 1 to 5');
  const headText = useRef('LightsOut');
  const geo = useMemo(
    () => ({
      lot: lotGeometry(),
      beam: beamGeometry(),
      star: halfStar(),
      reel: new ExtrudeGeometry(reelShape(0.46), { depth: 0.08, bevelEnabled: false, curveSegments: 18 }).translate(0, 0, -0.04),
      sign: new RoundedBoxGeometry(POSTS.sign, 0.52, 0.1, 2, 0.05),
    }),
    [],
  );
  const st = useMemo(
    () => ({
      sum: 0, count: 0, tile: -1, held: 0, rated: -1, flash: 0,
      lit: -1, half: false, // stars shown: lit whole stars and a half star
      genre: -1, genreT: 0, reel: 0, glow: -1,
    }),
    [],
  );

  // Whole stars plus an optional half star; each star is two instances (left and right half).
  const showStars = (whole: number, half: boolean) => {
    if (whole === st.lit && half === st.half) return;
    st.lit = whole;
    st.half = half;
    const m = stars.current;
    if (!m) return;
    for (let i = 0; i < 5; i++) {
      const left = i < whole || (i === whole && half);
      const right = i < whole;
      m.setColorAt(i * 2, left ? STAR_ON : STAR_OFF);
      m.setColorAt(i * 2 + 1, right ? STAR_ON : STAR_OFF);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };

  const showAverage = () => {
    if (!st.count) {
      showStars(0, false);
      setLabelText(status.current, statusText, 'Stop on a tile to rate, 1 to 5');
      return;
    }
    // rounded to one decimal, like the site's average rating
    const avg = Math.round((st.sum / st.count) * 10) / 10;
    const whole = Math.floor(avg);
    showStars(whole, avg - whole > 0);
    setLabelText(status.current, statusText, `Average ${avg.toFixed(1)} from ${st.count} rating${st.count === 1 ? '' : 's'}`);
  };

  useLayoutEffect(() => {
    const sm = stars.current;
    const tm = tiles.current;
    const gm = signs.current;
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * STAR.gap;
      for (let h = 0; h < 2; h++) {
        sm?.setMatrixAt(i * 2 + h, _m.compose(_p.set(x, STAR.y, SCREEN.z + 0.1), _q.identity(), _s.set(h ? -1 : 1, 1, 1)));
        sm?.setColorAt(i * 2 + h, STAR_OFF);
      }
      tm?.setMatrixAt(i, _m.compose(_p.set(AISLE.x, Y.paint + 0.004, tileZ(i)), _q.identity(), _s.setScalar(1)));
      tm?.setColorAt(i, TILE_OFF);
      gm?.setMatrixAt(i, _m.compose(_p.set(POSTS.x, 1.42, POSTS.z0 - i * POSTS.step), _q.identity(), _s.setScalar(1)));
      gm?.setColorAt(i, _c.copy(GENRE_COLORS[i]).multiplyScalar(SIGN_DIM));
    }
    REELS.forEach(([x, y, z], i) => reels.current?.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.identity(), _s.setScalar(1))));
    for (const m of [sm, tm, gm, reels.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    fixBounds(sm, [0, STAR.y, SCREEN.z], 3.2);
    fixBounds(tm, [AISLE.x, 0, tileZ(2)], 6.4);
    fixBounds(gm, [POSTS.x, 1.4, POSTS.z0 - 2 * POSTS.step], 5.2);
    fixBounds(reels.current, [BOOTH.x, BOOTH.h + 0.85, BOOTH.z], 1.2);
    st.lit = 0;
    st.half = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const store = useStore.getState();
    const near = carWithin(position[0], -38, RANGE);
    const running = cinemaSignal.parked;
    const night = store.night;
    const glow = (night ? 2 : 0) + (running ? 1 : 0);
    if (glow !== st.glow) {
      st.glow = glow;
      if (screen.current) screen.current.emissiveIntensity = night ? (running ? 0.85 : 0.55) : running ? 0.18 : 0.08;
    }
    if (!near) return;
    const dt = Math.min(delta, 0.05);
    const reduced = store.reducedMotion;

    // the beam: faint by day, brighter at night and while the projector runs
    if (beam.current) {
      const base = (night ? 0.2 : 0.07) + (running ? 0.07 : 0);
      beam.current.opacity = base * (running && !reduced ? 0.9 + Math.sin(performance.now() * 0.031) * 0.1 : 1);
    }
    if (!reduced && reels.current) {
      st.reel += dt * (running ? 3.2 : 0.6);
      for (let i = 0; i < REELS.length; i++) {
        _q.setFromAxisAngle(_zAxis, -st.reel * (1 + i * 0.15));
        reels.current.setMatrixAt(i, _m.compose(_p.fromArray(REELS[i]), _q, _s.setScalar(1)));
      }
      reels.current.instanceMatrix.needsUpdate = true;
    }

    // which rating tile the car is on
    const cx = carX() - position[0];
    const cz = carZ();
    let tile = -1;
    if (car.ready && Math.abs(cx - AISLE.x) < AISLE.w / 2 + 0.3) {
      for (let k = 0; k < 5; k++) if (Math.abs(cz - tileZ(k)) < AISLE.tile / 2 + AISLE.gap / 2) tile = k;
    }
    if (tile !== st.tile) {
      const m = tiles.current;
      if (m) {
        for (let k = 0; k < 5; k++) m.setColorAt(k, k <= tile ? TILE_ON : TILE_OFF);
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
      st.tile = tile;
      st.held = 0;
      if (tile !== st.rated) st.rated = -1;
    }
    if (tile >= 0) {
      if (st.rated !== tile) {
        showStars(tile + 1, false);
        setLabelText(status.current, statusText, `${tile + 1} out of 5`);
        st.held = Math.abs(car.speed) < 1.2 ? st.held + dt : 0;
        if (st.held > RATE_HOLD) {
          st.rated = tile;
          st.sum += tile + 1;
          st.count++;
          st.flash = 1;
          playSound('coin', 0.6);
          showAverage();
        }
      }
    } else if (st.lit >= 0) {
      showAverage();
    }
    // a little pop on the stars when a rating lands
    if (st.flash > 0 && stars.current) {
      st.flash = Math.max(0, st.flash - dt * 2.5);
      const k = 1 + Math.sin(st.flash * Math.PI) * 0.25;
      for (let i = 0; i < 5; i++) {
        for (let h = 0; h < 2; h++) stars.current.setMatrixAt(i * 2 + h, _m.compose(_p.set((i - 2) * STAR.gap, STAR.y, SCREEN.z + 0.1), _q.identity(), _s.set(h ? -k : k, k, k)));
      }
      stars.current.instanceMatrix.needsUpdate = true;
    }

    // the projector steps through the genre pages while the car is parked on the pad
    let genre = -1;
    if (running) {
      st.genreT += dt;
      genre = Math.floor(st.genreT / GENRE_S) % GENRES.length;
    } else st.genreT = 0;
    if (genre !== st.genre) {
      st.genre = genre;
      setLabelText(headline.current, headText, genre >= 0 ? GENRES[genre] : 'LightsOut');
      const m = signs.current;
      if (m) {
        for (let i = 0; i < 5; i++) m.setColorAt(i, _c.copy(GENRE_COLORS[i]).multiplyScalar(i === genre ? 1.25 : SIGN_DIM));
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
  });

  const fade = useBehindFade(position[0], SCREEN.z - 0.45, SCREEN.w / 2 + 0.25, SCREEN.y0 + SCREEN.h + 0.7, 2);
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[BOOTH.w / 2, BOOTH.h / 2, BOOTH.d / 2]} position={[BOOTH.x, BOOTH.h / 2, BOOTH.z]} />
        <CuboidCollider args={[SCREEN.w / 2 + 0.15, (SCREEN.y0 + SCREEN.h) / 2, 0.3]} position={[0, (SCREEN.y0 + SCREEN.h) / 2, SCREEN.z - 0.15]} />
        {GENRES.map((g, i) => (
          <CylinderCollider key={g} args={[0.8, 0.12]} position={[POSTS.x, 0.8, POSTS.z0 - i * POSTS.step]} />
        ))}
      </RigidBody>
      <mesh geometry={geo.lot} castShadow receiveShadow>
        <meshStandardMaterial ref={fade[0]} vertexColors roughness={0.75} transparent />
      </mesh>
      <mesh position={[0, SCREEN.y0 + SCREEN.h / 2, SCREEN.z + 0.065]} receiveShadow>
        <planeGeometry args={[SCREEN.w, SCREEN.h]} />
        <meshStandardMaterial ref={(m) => { screen.current = m; fade[1](m); }} color="#fbf8f1" emissive="#fff6e0" emissiveIntensity={0.08} roughness={0.95} transparent />
      </mesh>
      <mesh geometry={geo.beam} renderOrder={2}>
        <meshBasicMaterial ref={beam} color="#fff1c2" transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <instancedMesh ref={reels} args={[geo.reel, undefined, REELS.length]}>
        <meshStandardMaterial color="#c9ccd6" roughness={0.4} metalness={0.4} />
      </instancedMesh>
      {/* even instances are left halves, odd ones the mirrored right halves (hence DoubleSide) */}
      <instancedMesh ref={stars} args={[geo.star, undefined, 10]}>
        <meshBasicMaterial side={DoubleSide} toneMapped={false} />
      </instancedMesh>
      <Label ref={headline} font="display" size={0.66} color={COLORS.ink} position={[0, SCREEN.y0 + SCREEN.h - 0.6, SCREEN.z + 0.08]}>
        {headText.current}
      </Label>
      <Label ref={status} font="bodyBold" size={0.34} color={COLORS.inkSoft} position={[0, SCREEN.y0 + 0.55, SCREEN.z + 0.08]}>
        {statusText.current}
      </Label>
      <Label font="bodyBold" size={0.25} color={COLORS.paper} position={[0, MARQUEE.y, SCREEN.z + 0.05]}>
        {MARQUEE.text}
      </Label>
      <instancedMesh ref={tiles} args={[undefined, undefined, 5]} receiveShadow>
        <boxGeometry args={[AISLE.w, 0.012, AISLE.tile]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      {/* one flat label for the five tile numbers: its lines are one tile apart, 5 at the top */}
      <Label flat font="display" size={1.05} color={COLORS.paper} lineHeight={(AISLE.tile + AISLE.gap) / 1.05} position={[AISLE.x, Y.paint + 0.016, tileZ(2)]} fillOpacity={0.95}>
        {'5\n4\n3\n2\n1'}
      </Label>
      <instancedMesh ref={signs} args={[geo.sign, undefined, 5]}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      {GENRES.map((g, i) => (
        <Label key={g} font="bodyBold" size={0.32} color={COLORS.paper} position={[POSTS.x, 1.43, POSTS.z0 - i * POSTS.step + 0.06]}>
          {g}
        </Label>
      ))}
    </group>
  );
}
