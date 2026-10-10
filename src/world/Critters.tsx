import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import type { Points } from 'three';
import { CAMERA } from '../config/world.ts';
import { env } from './env.ts';
import { streamEdgeAt } from './field.ts';
import { STREAM_PATH, outside, zoneDist } from './geo.ts';
import type { Plan } from './plan.ts';
import { range, rng } from './rand.ts';

// Small life in the valley: butterflies over the flowers by day, fireflies by night. Both are
// animated entirely in their vertex shaders (one draw call each, no per-frame CPU work).

const FIREFLY_VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform float uNight;
uniform float uScale;
varying float vGlow;
void main() {
  vec3 p = position;
  float t = uTime * 0.6 + aPhase;
  p += vec3(sin(t * 1.3) * 0.9 + sin(t * 0.37 + aPhase) * 1.6, sin(t * 1.9 + aPhase * 2.0) * 0.35, cos(t * 1.1) * 0.9 + cos(t * 0.29 + aPhase) * 1.6);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float blink = smoothstep(0.2, 1.0, sin(uTime * 1.6 + aPhase * 5.0) * 0.5 + 0.5);
  vGlow = blink * uNight;
  gl_PointSize = uScale * (0.6 + 0.4 * blink) / -mv.z;
}
`;
const FIREFLY_FRAG = /* glsl */ `
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.0) * vGlow;
  gl_FragColor = vec4(vec3(0.95, 1.0, 0.5) * a * 1.4, 1.0);
}
`;

function Fireflies({ plan, count }: { plan: Plan; count: number }) {
  const ref = useRef<Points>(null);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const { geometry, material } = useMemo(() => {
    const r = rng(404);
    const pos: number[] = [];
    const phase: number[] = [];
    const add = (u: number, v: number) => {
      if (outside(u, v) > -2) return;
      pos.push(u, range(r, 0.5, 2.6), -v);
      phase.push(r() * 40);
    };
    // Along forest edges and the stream banks.
    for (let i = 0; i < count * 0.45 && plan.trees.length; i++) {
      const t = plan.trees[Math.floor(r() * plan.trees.length)];
      const a = r() * Math.PI * 2;
      const d = range(r, 2, 5);
      add(t.u + Math.cos(a) * d, t.v + Math.sin(a) * d);
    }
    // Over open meadow, away from zones.
    for (let i = 0; i < count * 0.4; i++) {
      const u = range(r, -185, 112);
      const v = range(r, -86, 152);
      if (zoneDist(u, v) > 3) add(u, v);
    }
    const sp = STREAM_PATH;
    for (let i = 0; i < count * 0.3; i++) {
      const k = Math.floor(r() * sp.pts.length);
      const side = r() < 0.5 ? -1 : 1;
      const off = side * (sp.w[k] + range(r, 0.5, 4));
      const u = sp.pts[k][0] + sp.n[k][0] * off;
      const v = sp.pts[k][1] + sp.n[k][1] * off;
      if (streamEdgeAt(u, v) > -0.5) add(u, v);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aPhase', new BufferAttribute(new Float32Array(phase), 1));
    g.computeBoundingSphere();
    const m = new ShaderMaterial({
      vertexShader: FIREFLY_VERT,
      fragmentShader: FIREFLY_FRAG,
      uniforms: { uTime: env.time, uNight: env.night, uScale: { value: 300 } },
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    return { geometry: g, material: m };
  }, [plan, count]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  // About 0.45 m across on screen, whatever the viewport.
  useFrame(({ camera }) => {
    const fov = 'fov' in camera ? (camera.fov as number) : CAMERA.fov;
    material.uniforms.uScale.value = (0.45 * size.height * dpr) / (2 * Math.tan((fov * Math.PI) / 360));
    if (ref.current) ref.current.visible = env.night.value > 0.05;
  });
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

// Two wings hinged on the body (local Z), 0.5 m across.
function wingGeometry() {
  const p = [
    // left wing
    0, 0, 0.16, -0.26, 0, 0.12, -0.24, 0, -0.08,
    0, 0, 0.16, -0.24, 0, -0.08, 0, 0, -0.1,
    -0.02, 0, -0.06, -0.2, 0, -0.1, -0.08, 0, -0.24,
    // right wing
    0, 0, 0.16, 0.24, 0, -0.08, 0.26, 0, 0.12,
    0, 0, 0.16, 0, 0, -0.1, 0.24, 0, -0.08,
    0.02, 0, -0.06, 0.08, 0, -0.24, 0.2, 0, -0.1,
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.computeVertexNormals();
  return g;
}

const BUTTERFLY_VERTEX = /* glsl */ `
#include <begin_vertex>
float side = sign(position.x);
float flap = (sin(uTime * 15.0 + aPhase) * 0.75 + 0.45) * side;
float span = abs(position.x);
transformed = vec3(span * cos(flap) * side, span * sin(abs(flap)), position.z);
float bt = uTime * (0.55 + 0.25 * fract(aPhase)) + aPhase;
vec3 off = vec3(cos(bt) * 1.8 + sin(bt * 2.3) * 0.5, 0.75 + sin(bt * 1.7) * 0.35 + sin(uTime * 7.0 + aPhase) * 0.05, sin(bt * 1.3) * 1.5);
vec3 vel = vec3(-sin(bt) * 1.8 + cos(bt * 2.3) * 1.15, 0.0, cos(bt * 1.3) * 1.95);
float yaw = atan(vel.x, vel.z);
float cy = cos(yaw);
float sy = sin(yaw);
transformed = vec3(transformed.x * cy + transformed.z * sy, transformed.y, -transformed.x * sy + transformed.z * cy) + off;
`;

function butterflyMaterial() {
  const m = new MeshBasicMaterial({ color: '#ffffff', side: DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;')
      .replace('#include <begin_vertex>', BUTTERFLY_VERTEX);
  };
  m.customProgramCacheKey = () => 'valley-butterfly';
  return m;
}

const WING_COLORS = ['#fff4e0', '#ffd23f', '#ff9f43', '#7fb7ff', '#ffffff'].map((c) => new Color(c));
const _m = new Matrix4();
const _v = new Vector3();

function Butterflies({ plan, count }: { plan: Plan; count: number }) {
  const mesh = useMemo(() => {
    const r = rng(808);
    const flowers = plan.cover.filter((c) => c.name.startsWith('flowers') && outside(c.u, c.v) < -4);
    const spots: [number, number][] = [];
    for (let i = 0; i < flowers.length && spots.length < count; i += Math.max(1, Math.floor(flowers.length / count))) {
      const f = flowers[i];
      if (spots.some(([u, v]) => Math.hypot(u - f.u, v - f.v) < 10)) continue;
      spots.push([f.u, f.v]);
    }
    const geo = wingGeometry();
    const m = new InstancedMesh(geo, butterflyMaterial(), spots.length);
    const phase = new Float32Array(spots.length);
    spots.forEach(([u, v], i) => {
      m.setMatrixAt(i, _m.makeTranslation(_v.set(u, 0, -v)));
      m.setColorAt(i, WING_COLORS[i % WING_COLORS.length]);
      phase[i] = r() * 50;
    });
    geo.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.frustumCulled = false; // the shader moves them away from their anchors
    m.name = 'valley-butterflies';
    return m;
  }, [plan, count]);
  useEffect(
    () => () => {
      mesh.dispose();
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    },
    [mesh],
  );
  useFrame(() => {
    mesh.visible = env.night.value < 0.4;
  });
  return <primitive object={mesh} />;
}

export function Critters({ plan, low }: { plan: Plan; low: boolean }) {
  return (
    <group name="valley-critters">
      <Fireflies plan={plan} count={low ? 140 : 380} />
      {!low && <Butterflies plan={plan} count={14} />}
    </group>
  );
}
