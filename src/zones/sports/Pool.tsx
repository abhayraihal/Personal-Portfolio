import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { AdditiveBlending, Color, ConeGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, RingGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { BufferGeometry, Group, InstancedMesh } from 'three';
import { car } from '../../state/car.ts';
import { useStore } from '../../state/store.ts';
import { env } from '../../world/env.ts';
import { NOISE } from '../../world/glsl.ts';
import type { V3 } from '../career/kit/frame.ts';
import { box, cyl, paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { rect } from './geom.ts';
import { PEG, SKIN, pegArm, pegBody } from './people.ts';

// A four-lane pool on a paved deck behind a rail fence (the car stays outside). The water is one
// shader: floor tiles and lane stripes seen through a slow wobble, moving caustics, and a glow at
// night as if the underwater lights were on. A swimmer does front-crawl lengths in lane two, a
// diver walks out on the springboard, bounces and dives, and both leave ripples.

export const DECK = { w: 19.5, d: 10.5 };
export const WATER = { w: 14, d: 6, y: 0.2 };
const COPING = 0.45;
const LANE = WATER.d / 4;
const FENCE_H = 1.1;
const BOARD = { x0: 9.0, x1: 6.0, y: 0.95, z: 1.5 }; // springboard: back end, tip, height

const WATER_PARS = /* glsl */ `
uniform float uTime;
uniform float uNight;
varying vec2 vPool;
${NOISE}
`;

const WATER_COLOR = /* glsl */ `
vec2 p = vPool;
float t = uTime;
vec2 wob = vec2(vw_noise(p * 0.8 + vec2(t * 0.33, 0.0)), vw_noise(p * 0.8 + vec2(3.7, t * 0.29))) - 0.5;
vec2 q = p + wob * 0.22;
// Floor: white tiles, darker grout, lane stripes with a T before each wall.
vec2 tile = abs(fract(q / 0.5) - 0.5);
float grout = smoothstep(0.43, 0.48, max(tile.x, tile.y));
float laneD = abs(fract((q.y + ${(WATER.d / 2).toFixed(2)}) / ${LANE.toFixed(2)}) - 0.5) * ${LANE.toFixed(2)};
float inLanes = step(abs(q.x), ${(WATER.w / 2 - 1.1).toFixed(2)});
float stripe = (1.0 - smoothstep(0.1, 0.14, laneD)) * inLanes;
float tee = (1.0 - smoothstep(0.1, 0.14, abs(abs(q.x) - ${(WATER.w / 2 - 1.1).toFixed(2)}))) * step(laneD, 0.42);
vec3 floorCol = mix(vec3(0.93, 0.97, 0.98), vec3(0.62, 0.78, 0.84), grout);
floorCol = mix(floorCol, vec3(0.1, 0.22, 0.55), max(stripe, tee) * 0.85);
// Deeper towards the middle, as the eye expects.
vec2 e = vec2(${(WATER.w / 2).toFixed(2)}, ${(WATER.d / 2).toFixed(2)}) - abs(p);
float edge = smoothstep(0.0, 1.4, min(e.x, e.y));
vec3 shallow = vec3(0.36, 0.83, 0.9);
vec3 deep = vec3(0.09, 0.52, 0.76);
vec3 wcol = mix(floorCol * shallow, floorCol * deep, 0.35 + 0.45 * edge);
// Caustics: bright webbing where two drifting noise fields cross.
float c1 = vw_noise(q * 1.7 + vec2(t * 0.42, t * 0.21));
float c2 = vw_noise(q * 2.1 - vec2(t * 0.27, -t * 0.39) + 5.1);
float caust = pow(max(0.0, 1.0 - abs(c1 - c2) * 3.2), 6.0);
wcol += vec3(0.75, 0.95, 1.0) * caust * 0.32 * (1.0 - uNight * 0.5);
// A thin bright rim where the water meets the wall.
wcol = mix(vec3(0.82, 0.96, 1.0), wcol, smoothstep(0.0, 0.12, min(e.x, e.y)));
diffuseColor.rgb = wcol;
`;

const WATER_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
vec2 sc = vec2(p.x * 2.6 + t * 0.3, p.y * 2.6);
float sh = vw_hash12(floor(sc));
float spark = step(0.93, sh) * smoothstep(0.26, 0.0, length(fract(sc) - 0.5)) * (0.5 + 0.5 * sin(t * 4.0 + sh * 40.0));
totalEmissiveRadiance += spark * vec3(1.0, 0.97, 0.88) * 0.55 * (1.0 - uNight);
totalEmissiveRadiance += wcol * uNight * 0.55;
`;

function waterMaterial() {
  const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.12, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uNight = env.night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPool;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPool = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_PARS}`)
      .replace('#include <color_fragment>', WATER_COLOR)
      .replace('#include <emissivemap_fragment>', WATER_EMISSIVE);
  };
  m.customProgramCacheKey = () => 'sports-pool-water-v1';
  return m;
}

function deckGeometry(): BufferGeometry {
  const parts: Part[] = [
    rect(0, 0, DECK.w + 0.3, DECK.d + 0.3, 0.014, '#b9ad97'),
    rect(0, 0, DECK.w, DECK.d, 0.02, '#ece5d6'),
  ];
  // Coping round the water, with the tiled inner wall just showing above the surface.
  const cw = WATER.w + COPING * 2;
  const top = 0.3;
  for (const s of [-1, 1]) {
    parts.push({ geo: box(cw, top, COPING, 0.03), color: '#f4f0e6', at: [0, top / 2, s * (WATER.d / 2 + COPING / 2)] });
    parts.push({ geo: box(COPING, top, WATER.d, 0.03), color: '#f4f0e6', at: [s * (WATER.w / 2 + COPING / 2), top / 2, 0] });
  }
  // Starting blocks at the left end, one per lane.
  for (let i = 0; i < 4; i++) {
    const z = -WATER.d / 2 + LANE * (i + 0.5);
    parts.push({ geo: box(0.5, 0.55, 0.55, 0.04), color: '#f4f4f0', at: [-(WATER.w / 2 + 0.28), 0.28 + 0.27, z] });
    parts.push({ geo: box(0.56, 0.07, 0.6, 0.02), color: i % 2 ? '#2f6fd6' : '#d94141', at: [-(WATER.w / 2 + 0.24), 0.86, z], rot: [0, 0, -0.12] });
  }
  // Springboard stand and board.
  parts.push({ geo: box(0.7, BOARD.y - 0.05, 0.7, 0.05), color: '#2f6fd6', at: [BOARD.x0 - 0.15, (BOARD.y - 0.05) / 2, BOARD.z] });
  // Ladder on the near side: two rails curving over the coping, and steps.
  for (const dx of [-0.32, 0.32]) {
    parts.push({ geo: cyl(0.035, 0.035, 0.9, 8), color: '#dfe3e8', at: [-3.4 + dx, 0.55, WATER.d / 2 - 0.12] });
    parts.push({ geo: new TorusGeometry(0.22, 0.035, 6, 12, Math.PI), color: '#dfe3e8', at: [-3.4 + dx, 1.0, WATER.d / 2 + 0.1], rot: [0, Math.PI / 2, 0] });
    parts.push({ geo: cyl(0.035, 0.035, 0.7, 8), color: '#dfe3e8', at: [-3.4 + dx, 0.65, WATER.d / 2 + 0.32] });
  }
  // Lifeguard chair at the far side.
  const lx = 3.2;
  const lz = -(WATER.d / 2 + COPING + 0.95);
  for (const dx of [-0.4, 0.4]) {
    for (const dz of [-0.3, 0.3]) parts.push({ geo: cyl(0.05, 0.05, 1.8, 8), color: '#f4f4f0', at: [lx + dx, 0.9, lz + dz], rot: [dz * -0.25, 0, dx * 0.25] });
  }
  parts.push({ geo: box(0.85, 0.08, 0.6, 0.02), color: '#d94141', at: [lx, 1.8, lz] });
  parts.push({ geo: box(0.85, 0.6, 0.08, 0.02), color: '#d94141', at: [lx, 2.12, lz - 0.28] });
  parts.push({ geo: box(0.75, 0.05, 0.12, 0.01), color: '#f4f4f0', at: [lx, 0.6, lz] });
  parts.push({ geo: box(0.75, 0.05, 0.12, 0.01), color: '#f4f4f0', at: [lx, 1.15, lz] });
  // Backstroke flags: poles each side, a string of pennants across the pool near each end.
  for (const sx of [-1, 1]) {
    const x = sx * (WATER.w / 2 - 1.5);
    for (const sz of [-1, 1]) parts.push({ geo: cyl(0.04, 0.05, 1.9, 8), color: '#dfe3e8', at: [x, 0.95, sz * (WATER.d / 2 + COPING + 0.3)] });
    parts.push({ geo: cyl(0.01, 0.01, WATER.d + COPING * 2 + 0.6, 4), color: '#f4f4f0', at: [x, 1.82, 0], rot: [Math.PI / 2, 0, 0] });
    const n = 14;
    for (let k = 0; k < n; k++) {
      const z = -WATER.d / 2 - 0.2 + ((WATER.d + 0.4) * (k + 0.5)) / n;
      const tri = new ConeGeometry(0.16, 0.34, 3, 1);
      parts.push({ geo: tri, color: ['#d94141', '#f4f4f0', '#2f6fd6'][k % 3], at: [x, 1.62, z], rot: [Math.PI, 0, 0], scale: [1, 1, 0.2] });
    }
  }
  return paint(parts);
}

// Rail fence on the deck edge.
function fenceGeometry(): BufferGeometry {
  const parts: Part[] = [];
  const hx = DECK.w / 2;
  const hz = DECK.d / 2;
  const posts = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2.4));
    for (let i = 0; i <= n; i++) parts.push({ geo: cyl(0.05, 0.05, FENCE_H, 8), color: '#f0f2f4', at: [ax + ((bx - ax) * i) / n, FENCE_H / 2, az + ((bz - az) * i) / n] });
    const len = Math.hypot(bx - ax, bz - az);
    for (const y of [0.5, FENCE_H]) parts.push({ geo: cyl(0.035, 0.035, len, 6), color: '#f0f2f4', at: [(ax + bx) / 2, y, (az + bz) / 2], rot: [Math.PI / 2, 0, Math.atan2(-(bx - ax), bz - az)] });
  };
  posts(-hx, -hz, hx, -hz);
  posts(hx, -hz, hx, hz);
  posts(hx, hz, -hx, hz);
  posts(-hx, hz, -hx, -hz);
  // Lifebuoy on the near fence.
  const quarter: Part[] = [];
  for (let k = 0; k < 4; k++) {
    const g = new TorusGeometry(0.34, 0.09, 8, 5, Math.PI / 2);
    g.rotateZ((k * Math.PI) / 2);
    quarter.push({ geo: g, color: k % 2 ? '#f4f4f0' : '#e2442f', at: [2.2, 0.78, hz + 0.08] });
  }
  return paint([...parts, ...quarter]);
}

type Ripple = { x: number; z: number; age: number; life: number; size: number };
type Drop = { p: Vector3; v: Vector3; life: number };

const RIPPLES = 18;
const DROPS = 36;
const _m = new Matrix4();
const _q = new Quaternion();
const _flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

const DIVER_PIVOT = 0.8; // the dive turns the diver about a point this high, near the middle

const SWIM = { z: -WATER.d / 2 + LANE * 1.5, x: WATER.w / 2 - 0.9, speed: 1.35 };

export function Pool({ position }: { position: V3 }) {
  const deck = useMemo(deckGeometry, []);
  const fence = useMemo(fenceGeometry, []);
  const water = useMemo(() => {
    const g = new PlaneGeometry(WATER.w, WATER.d, 1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const waterMat = useMemo(waterMaterial, []);
  const board = useMemo(() => paint([
    { geo: box(BOARD.x0 - BOARD.x1, 0.08, 0.5, 0.03), color: '#f4f4f0', at: [-(BOARD.x0 - BOARD.x1) / 2, 0, 0] },
    { geo: box(BOARD.x0 - BOARD.x1 - 0.2, 0.012, 0.42, 0), color: '#4aa3c8', at: [-(BOARD.x0 - BOARD.x1) / 2 - 0.05, 0.045, 0] },
  ]), []);
  // Lane ropes: beads, red near the walls and blue and white between.
  const beads = useMemo(() => {
    const geo = paint([{ geo: cyl(0.07, 0.07, 0.15, 10), color: '#ffffff', rot: [0, 0, Math.PI / 2] }]);
    const items: { x: number; z: number; color: string }[] = [];
    for (let r = 1; r < 4; r++) {
      const z = -WATER.d / 2 + LANE * r;
      for (let x = -WATER.w / 2 + 0.12; x < WATER.w / 2 - 0.05; x += 0.19) {
        const nearWall = WATER.w / 2 - Math.abs(x) < 1.6;
        items.push({ x, z, color: nearWall ? '#d94141' : Math.round(x / 0.19) % 2 ? '#f4f4f0' : '#2f6fd6' });
      }
    }
    return { geo, items };
  }, []);
  const beadMesh = useRef<InstancedMesh>(null);
  useEffect(() => {
    const m = beadMesh.current;
    if (!m) return;
    beads.items.forEach((b, i) => {
      m.setMatrixAt(i, _m.makeTranslation(b.x, WATER.y + 0.03, b.z));
      m.setColorAt(i, _c.set(b.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [beads]);

  // People: a swimmer (cap and arms above the water) and a diver.
  const swimmer = useMemo(() => ({
    cap: paint([
      { geo: new SphereGeometry(0.2, 14, 10), color: '#e2442f', at: [0, 0, 0], scale: [1.15, 0.85, 1] },
      { geo: box(0.08, 0.05, 0.3, 0.02), color: '#23262d', at: [0.17, 0.02, 0] },
    ]),
    arm: paint([{ geo: cyl(0.065, 0.06, 0.62, 8), color: SKIN[1], at: [0, -0.31, 0] }]),
  }), []);
  const diverBody = useMemo(() => pegBody('#2f6fd6', SKIN[3], '#2b1d14'), []);
  const diverArm = useMemo(() => pegArm(SKIN[3], SKIN[3]), []);
  const ringMesh = useMemo(() => {
    const geo = new RingGeometry(0.82, 1, 28);
    const mat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    return { geo, mat };
  }, []);
  const dropMesh = useMemo(() => ({ geo: new SphereGeometry(0.06, 6, 4), mat: new MeshBasicMaterial({ color: '#f2fbff', toneMapped: false }) }), []);
  useEffect(() => () => {
    waterMat.dispose();
    ringMesh.mat.dispose();
    dropMesh.mat.dispose();
  }, [waterMat, ringMesh, dropMesh]);

  const root = useRef<Group>(null);
  const swim = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const diver = useRef<Group>(null);
  const diverArms = useRef<(Group | null)[]>([]);
  const boardRef = useRef<Group>(null);
  const rings = useRef<InstancedMesh>(null);
  const drops = useRef<InstancedMesh>(null);
  const sim = useRef<{ x: number; dir: number; turn: number; stroke: number; rippleT: number; kickT: number; cursor: number; dropCursor: number; dt: number; diveT: number; ripples: Ripple[]; drops: Drop[] } | null>(null);
  if (!sim.current) {
    sim.current = {
      x: -2, dir: 1, turn: 0, stroke: 0, rippleT: 0, kickT: 0, cursor: 0, dropCursor: 0, dt: 0, diveT: 0,
      ripples: Array.from({ length: RIPPLES }, () => ({ x: 0, z: 0, age: 9, life: 1, size: 1 })),
      drops: Array.from({ length: DROPS }, () => ({ p: new Vector3(), v: new Vector3(), life: 0 })),
    };
  }

  const ripple = (x: number, z: number, size: number, life: number) => {
    const s = sim.current!;
    const r = s.ripples[s.cursor++ % RIPPLES];
    r.x = x;
    r.z = z;
    r.size = size;
    r.life = life;
    r.age = 0;
  };
  const splash = (x: number, z: number, n: number, power: number) => {
    const s = sim.current!;
    for (let k = 0; k < n; k++) {
      const d = s.drops[s.dropCursor++ % DROPS];
      const a = Math.random() * Math.PI * 2;
      const sp = (0.5 + Math.random()) * power;
      d.p.set(x, WATER.y + 0.05, z);
      d.v.set(Math.cos(a) * sp * 0.6, (1.6 + Math.random() * 1.6) * power, Math.sin(a) * sp * 0.6);
      d.life = 0.7 + Math.random() * 0.4;
    }
  };

  useFrame((_, delta) => {
    const s = sim.current;
    const g = root.current;
    if (!s || !g) return;
    // Far from the car the pool only keeps its water moving.
    const far = Math.hypot(car.x - g.position.x, car.z - g.position.z) > 70;
    const reduced = useStore.getState().reducedMotion;
    const dt = Math.min(delta, 0.05) * (reduced ? 0.5 : 1);
    if (far) return;

    // Swimmer: front crawl up and down lane two, a tumble turn at each end.
    const sw = swim.current;
    if (s.turn > 0) {
      s.turn -= dt;
      if (s.turn <= 0) s.dir = -s.dir;
    } else {
      s.x += s.dir * SWIM.speed * dt;
      if (Math.abs(s.x) > SWIM.x) {
        s.x = Math.sign(s.x) * SWIM.x;
        s.turn = 0.9;
        ripple(s.x + s.dir * 0.4, SWIM.z, 1.1, 1.4);
        splash(s.x + s.dir * 0.3, SWIM.z, 6, 0.8);
      }
    }
    s.stroke += dt * 4.2;
    if (sw) {
      const turning = s.turn > 0 ? Math.sin((1 - s.turn / 0.9) * Math.PI) : 0;
      sw.position.set(s.x, WATER.y + 0.06 + Math.sin(s.stroke * 2) * 0.025 - turning * 0.35, SWIM.z);
      const yaw = s.dir > 0 ? 0 : Math.PI;
      sw.rotation.set(Math.sin(s.stroke) * 0.12, yaw + (s.turn > 0 ? (1 - s.turn / 0.9) * Math.PI * (s.dir > 0 ? 1 : -1) : 0), 0, 'YXZ');
    }
    if (armL.current) armL.current.rotation.z = -s.stroke;
    if (armR.current) armR.current.rotation.z = -s.stroke + Math.PI;
    s.rippleT += dt;
    if (s.rippleT > 0.32 && s.turn <= 0) {
      s.rippleT = 0;
      ripple(s.x + s.dir * 0.25, SWIM.z, 0.55, 1.1);
    }
    s.kickT += dt;
    if (s.kickT > 0.12 && s.turn <= 0) {
      s.kickT = 0;
      splash(s.x - s.dir * 1.0, SWIM.z + (Math.random() - 0.5) * 0.2, 1, 0.35);
    }

    // Diver: walk out, two bounces, dive, then back on the board after a pause. Cycle of 7.5 s.
    s.diveT = (s.diveT + dt) % 7.5;
    const t = s.diveT;
    const dv = diver.current;
    let bend = 0;
    if (dv) {
      let x = BOARD.x0 - 0.2;
      let y = BOARD.y + 0.04;
      let pitch = 0;
      let scale = 1;
      let arms = 0.2;
      if (t < 0.3) {
        scale = t / 0.3;
      } else if (t < 2.0) {
        x = BOARD.x0 - 0.2 - ((t - 0.3) / 1.7) * (BOARD.x0 - BOARD.x1 - 0.5);
        y += Math.abs(Math.sin((t - 0.3) * 7)) * 0.05;
      } else if (t < 3.3) {
        x = BOARD.x1 + 0.3;
        const b = (t - 2.0) / 0.65;
        const hop = Math.sin((b % 1) * Math.PI);
        y += hop * (b < 1 ? 0.35 : 0.6);
        bend = -(1 - hop) * 0.6;
        arms = 0.2 + hop * 2.6;
      } else if (t < 4.2) {
        const u = (t - 3.3) / 0.9;
        x = BOARD.x1 + 0.3 - u * 1.3;
        y = BOARD.y + 0.04 + 0.9 * 4 * u * (1 - u) - u * (BOARD.y + 1.0);
        pitch = u * Math.PI * 1.1;
        arms = 2.9;
        if (u > 0.92 && s.dt < 3.3) {
          s.dt = 4;
          ripple(BOARD.x1 - 1.0, BOARD.z, 1.6, 1.8);
          ripple(BOARD.x1 - 1.0, BOARD.z, 1.0, 1.2);
          splash(BOARD.x1 - 1.0, BOARD.z, 16, 1.4);
        }
      } else {
        scale = 0;
        s.dt = 0;
      }
      dv.position.set(x, y, BOARD.z);
      dv.rotation.set(0, -Math.PI / 2, 0);
      dv.children[0]?.rotation.set(pitch, 0, 0);
      dv.scale.setScalar(Math.max(scale, 0.0001));
      for (let k = 0; k < 2; k++) {
        const a = diverArms.current[k];
        if (a) a.rotation.x = -arms;
      }
    }
    if (boardRef.current) boardRef.current.rotation.z = bend * 0.08;

    // Ripples and drops.
    const rm = rings.current;
    if (rm) {
      for (let i = 0; i < RIPPLES; i++) {
        const r = s.ripples[i];
        r.age += dt;
        const k = Math.min(r.age / r.life, 1);
        _s.setScalar(r.age < r.life ? r.size * (0.25 + k * 1.5) : 0.0001);
        rm.setMatrixAt(i, _m.compose(_p.set(r.x, WATER.y + 0.012, r.z), _flat, _s));
        rm.setColorAt(i, _c.setScalar(r.age < r.life ? (1 - k) * (1 - k) * 0.5 : 0));
      }
      rm.instanceMatrix.needsUpdate = true;
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    }
    const dm = drops.current;
    if (dm) {
      for (let i = 0; i < DROPS; i++) {
        const d = s.drops[i];
        if (d.life > 0) {
          d.life -= dt;
          d.v.y -= 9.8 * dt;
          d.p.addScaledVector(d.v, dt);
          if (d.p.y < WATER.y) d.life = 0;
        }
        _s.setScalar(d.life > 0 ? Math.min(1, d.life * 3) : 0.0001);
        dm.setMatrixAt(i, _m.compose(d.p, _q.identity(), _s));
      }
      dm.instanceMatrix.needsUpdate = true;
    }
  });

  const hx = DECK.w / 2;
  const hz = DECK.d / 2;
  return (
    <group ref={root} position={position}>
      <mesh geometry={deck} material={paintMaterial} castShadow receiveShadow />
      <mesh geometry={fence} material={paintMaterial} castShadow />
      <mesh geometry={water} material={waterMat} position={[0, WATER.y, 0]} receiveShadow />
      <instancedMesh ref={beadMesh} args={[beads.geo, paintMaterial, beads.items.length]} />
      <group ref={boardRef} position={[BOARD.x0, BOARD.y, BOARD.z]}>
        <mesh geometry={board} material={paintMaterial} castShadow />
      </group>
      <group ref={swim}>
        <mesh geometry={swimmer.cap} material={paintMaterial} />
        <group ref={armL} position={[0.1, 0.02, -0.22]}>
          <mesh geometry={swimmer.arm} material={paintMaterial} />
        </group>
        <group ref={armR} position={[0.1, 0.02, 0.22]}>
          <mesh geometry={swimmer.arm} material={paintMaterial} />
        </group>
      </group>
      <group ref={diver}>
        <group position={[0, DIVER_PIVOT, 0]}>
          <mesh geometry={diverBody} material={paintMaterial} position={[0, -DIVER_PIVOT, 0]} castShadow />
          {[-1, 1].map((sx, k) => (
            <group key={sx} ref={(el) => { diverArms.current[k] = el; }} position={[sx * 0.33, PEG.shoulderY - DIVER_PIVOT, 0]}>
              <mesh geometry={diverArm} material={paintMaterial} castShadow />
            </group>
          ))}
        </group>
      </group>
      <instancedMesh ref={rings} args={[ringMesh.geo, ringMesh.mat, RIPPLES]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={drops} args={[dropMesh.geo, dropMesh.mat, DROPS]} frustumCulled={false} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hx, 0.65, 0.08]} position={[0, 0.65, -hz]} />
        <CuboidCollider args={[hx, 0.65, 0.08]} position={[0, 0.65, hz]} />
        <CuboidCollider args={[0.08, 0.65, hz]} position={[-hx, 0.65, 0]} />
        <CuboidCollider args={[0.08, 0.65, hz]} position={[hx, 0.65, 0]} />
      </RigidBody>
    </group>
  );
}
