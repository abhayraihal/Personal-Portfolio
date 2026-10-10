import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { MeshStandardMaterial as MSM } from 'three';
import { modelScale, useMerged } from '../components/Model.tsx';
import { COLORS } from '../config/palette.ts';
import { env } from './env.ts';
import { InstancedItems } from './Instances.tsx';
import type { Variant } from './Instances.tsx';
import { bannerMaterial } from './materials.ts';
import type { FlagString, Plan } from './plan.ts';
import { rng } from './rand.ts';

// Lungta strings: small flags in the five traditional colours (blue, white, red, green, yellow)
// hanging from a sagging rope between poles, fluttering in a wind vertex shader.

const FLAG_W = 0.4;
const FLAG_H = 0.48;
const SPACING = 0.56;
const POLE_NATIVE_H = 1.4; // pole-prayer-flag-mast
const BANNER: Variant = (base) => bannerMaterial(base as MSM);

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

// Point on a string at t in [0, 1], in the FACE_CAMERA frame (x = u, z = -v).
function ropePoint(s: FlagString, t: number, out: Vector3) {
  const y = s.a[2] + (s.b[2] - s.a[2]) * t - s.sag * 4 * t * (1 - t);
  return out.set(s.a[0] + (s.b[0] - s.a[0]) * t, y, -(s.a[1] + (s.b[1] - s.a[1]) * t));
}

function ropeGeometry(strings: FlagString[]) {
  const pos: number[] = [];
  const idx: number[] = [];
  const r = 0.025;
  const a = new Vector3();
  const b = new Vector3();
  for (const s of strings) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const segs = Math.max(8, Math.ceil(len / 1.2));
    for (let i = 0; i < segs; i++) {
      ropePoint(s, i / segs, a);
      ropePoint(s, (i + 1) / segs, b);
      // A flat ribbon facing up plus one facing sideways reads as a round rope from above.
      const base = pos.length / 3;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * r;
      const nz = (dx / l) * r;
      pos.push(a.x + nx, a.y, a.z + nz, a.x - nx, a.y, a.z - nz, b.x + nx, b.y, b.z + nz, b.x - nx, b.y, b.z - nz);
      pos.push(a.x, a.y + r, a.z, a.x, a.y - r, a.z, b.x, b.y + r, b.z, b.x, b.y - r, b.z);
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      idx.push(base + 4, base + 6, base + 5, base + 5, base + 6, base + 7);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const FLAG_PARS = /* glsl */ `
uniform float uTime;
uniform float uMotion;
attribute float aPhase;
varying vec2 vFlagUv;
`;

const FLAG_VERTEX = /* glsl */ `
#include <begin_vertex>
vFlagUv = uv;
float hang = clamp(-position.y / ${FLAG_H.toFixed(2)}, 0.0, 1.0);
float ft = uTime * 4.2 + aPhase;
transformed.z += (sin(ft + position.x * 5.0 - hang * 2.5) * 0.09 + 0.1) * hang * uMotion;
transformed.x += sin(ft * 0.7 + hang * 3.0) * 0.025 * hang * uMotion;
transformed.y += (cos(ft) * 0.02 - 0.01) * hang * uMotion;
`;

const FLAG_FRAGMENT = /* glsl */ `
#include <color_fragment>
float print = step(abs(vFlagUv.x - 0.5), 0.3) * step(abs(vFlagUv.y - 0.5), 0.3);
diffuseColor.rgb *= 1.0 - 0.14 * print;
`;

function flagMaterial() {
  const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0, side: DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uMotion = env.motion;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLAG_PARS}`)
      .replace('#include <begin_vertex>', FLAG_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFlagUv;')
      .replace('#include <color_fragment>', FLAG_FRAGMENT);
  };
  m.customProgramCacheKey = () => 'valley-flags-v1';
  return m;
}

function buildFlags(strings: FlagString[]) {
  const r = rng(5);
  const palette = COLORS.flags.map((c) => new Color(c));
  const items: { m: Matrix4; c: Color; ph: number }[] = [];
  const a = new Vector3();
  for (const s of strings) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const n = Math.max(2, Math.floor(len / SPACING) - 1);
    const yaw = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
    _q.setFromAxisAngle(_up, yaw);
    const start = Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      ropePoint(s, t, a);
      _p.copy(a);
      _s.set(1, 1, 1);
      items.push({ m: new Matrix4().compose(_p, _q, _s), c: palette[(start + i) % 5], ph: r() * 6.28 + t * 9 });
    }
  }
  const geo = new PlaneGeometry(FLAG_W, FLAG_H, 2, 3).translate(0, -FLAG_H / 2 - 0.02, 0);
  const mesh = new InstancedMesh(geo, flagMaterial(), items.length);
  const phase = new Float32Array(items.length);
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, it.m);
    mesh.setColorAt(i, it.c);
    phase[i] = it.ph;
  });
  geo.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'valley-prayer-flags';
  return mesh;
}

function Poles({ plan }: { plan: Plan }) {
  const { geometry, material } = useMerged('pole-prayer-flag-mast');
  const mesh = useMemo(() => {
    const poles = plan.poles.filter((p) => p.mast);
    const m = new InstancedMesh(geometry, material, poles.length);
    const s0 = modelScale('pole-prayer-flag-mast');
    poles.forEach((p, i) => {
      // Sunk 0.25 m so the mast's wide base disappears into the ground.
      const sy = (p.h + 0.25) / (POLE_NATIVE_H * s0);
      _p.set(p.u, p.y - 0.25, -p.v);
      _q.identity();
      _s.set(s0 * 0.5, s0 * sy, s0 * 0.5);
      m.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'valley-flag-poles';
    return m;
  }, [geometry, material, plan]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

export function PrayerFlags({ plan }: { plan: Plan }) {
  const flags = useMemo(() => buildFlags(plan.strings), [plan]);
  const rope = useMemo(() => ropeGeometry(plan.strings), [plan]);
  const ropeMat = useMemo(() => new MeshStandardMaterial({ color: '#5a4636', roughness: 1 }), []);
  useEffect(() => () => flags.dispose(), [flags]);
  return (
    <group name="valley-flags">
      <Poles plan={plan} />
      <mesh geometry={rope} material={ropeMat} castShadow />
      <primitive object={flags} />
      <InstancedItems items={plan.darchog} variant={() => BANNER} />
    </group>
  );
}
