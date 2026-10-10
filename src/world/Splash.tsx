import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, RingGeometry, ShaderMaterial, Vector3 } from 'three';
import type { Points } from 'three';
import { CAMERA } from '../config/world.ts';
import { car } from '../state/car.ts';
import { playSound } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { env } from './env.ts';
import { streamEdgeAt } from './field.ts';
import { onBridge } from './geo.ts';
import { WATER_Y } from './Stream.tsx';

// Spray and spreading foam rings when the car wades through the stream. CPU particles: one Points
// draw for the droplets, one instanced ring mesh for the foam.

const MAX = 260;
const RINGS = 24;
const VERT = /* glsl */ `
attribute float aLife;
uniform float uScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aLife > 0.0 ? uScale * (0.45 + 0.55 * aLife) / -mv.z : 0.0;
}
`;
const FRAG = /* glsl */ `
uniform float uNight;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vLife <= 0.0) discard;
  vec3 c = mix(vec3(0.95, 0.99, 1.0), vec3(0.55, 0.65, 0.8), uNight);
  gl_FragColor = vec4(c, smoothstep(1.0, 0.55, d) * min(vLife * 2.5, 1.0) * 0.95);
}
`;

const _m = new Matrix4();
const _q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

export function Splash() {
  const ref = useRef<Points>(null);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const state = useRef({ cursor: 0, wet: false, acc: 0, ringAcc: 0, ringCursor: 0 });
  const sim = useMemo(() => ({ vel: new Float32Array(MAX * 3), rings: Array.from({ length: RINGS }, () => ({ x: 0, z: 0, age: 9, life: 1 })) }), []);
  const { geometry, material } = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array(MAX * 3), 3);
    const life = new BufferAttribute(new Float32Array(MAX), 1);
    pos.setUsage(DynamicDrawUsage);
    life.setUsage(DynamicDrawUsage);
    g.setAttribute('position', pos);
    g.setAttribute('aLife', life);
    const m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 300 }, uNight: env.night },
      transparent: true,
      depthWrite: false,
    });
    return { geometry: g, material: m };
  }, []);
  const rings = useMemo(() => {
    const mesh = new InstancedMesh(new RingGeometry(0.72, 1, 28), new MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: AdditiveBlending, depthWrite: false }), RINGS);
    _s.setScalar(0);
    for (let i = 0; i < RINGS; i++) {
      mesh.setMatrixAt(i, _m.compose(_p.set(0, -50, 0), _q, _s));
      mesh.setColorAt(i, _c.setScalar(0));
    }
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.name = 'valley-splash-rings';
    return mesh;
  }, []);
  material.uniforms.uScale.value = (0.38 * size.height * dpr) / (2 * Math.tan((CAMERA.fov * Math.PI) / 360));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const pos = geometry.attributes.position as BufferAttribute;
    const life = geometry.attributes.aLife as BufferAttribute;
    const p = pos.array as Float32Array;
    const l = life.array as Float32Array;
    const v = sim.vel;
    const s = state.current;
    let alive = false;
    for (let i = 0; i < MAX; i++) {
      if (l[i] <= 0) continue;
      alive = true;
      l[i] -= dt * 1.25;
      v[i * 3 + 1] -= 9.8 * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < WATER_Y) l[i] = 0;
    }
    const speed = Math.abs(car.speed);
    const inWater = car.ready && streamEdgeAt(car.u, car.v) < -0.3 && !onBridge(car.u, car.v);
    const st = useStore.getState();
    if (inWater && speed > 4 && !s.wet && st.phase === 'play') playSound('splash', 0.7);
    s.wet = inWater && speed > 1.5;
    const fx = Math.cos(car.yaw);
    const fz = -Math.sin(car.yaw);
    if (s.wet && !st.reducedMotion) {
      s.acc += dt * Math.min(speed * 16, 240);
      const dir = Math.sign(car.speed) || 1;
      while (s.acc >= 1) {
        s.acc -= 1;
        const i = s.cursor++ % MAX;
        const lead = Math.random() < 0.6; // most spray comes off the leading wheels
        const along = (lead ? dir : -dir) * (0.99 + Math.random() * 0.4);
        const across = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.4);
        p[i * 3] = car.x + fx * along - fz * across;
        p[i * 3 + 1] = WATER_Y + 0.08;
        p[i * 3 + 2] = car.z + fz * along + fx * across;
        const out = 1.0 + Math.random() * 1.8;
        const sideX = -fz * Math.sign(across);
        const sideZ = fx * Math.sign(across);
        const push = dir * speed * (lead ? 0.12 : -0.1);
        v[i * 3] = sideX * out + fx * push + (Math.random() - 0.5) * 0.8;
        v[i * 3 + 1] = 2.4 + Math.random() * 2.8 + speed * 0.1;
        v[i * 3 + 2] = sideZ * out + fz * push + (Math.random() - 0.5) * 0.8;
        l[i] = 0.75 + Math.random() * 0.35;
        alive = true;
      }
    }
    // Foam rings spread out behind the car while it moves through the water.
    if (s.wet) {
      s.ringAcc += dt * Math.min(2 + speed * 0.6, 9);
      while (s.ringAcc >= 1) {
        s.ringAcc -= 1;
        const r = sim.rings[s.ringCursor++ % RINGS];
        r.x = car.x - fx * 0.6;
        r.z = car.z - fz * 0.6;
        r.age = 0;
        r.life = 1.2 + Math.random() * 0.5;
      }
    }
    let ringsAlive = false;
    for (let i = 0; i < RINGS; i++) {
      const r = sim.rings[i];
      if (r.age > r.life) continue;
      r.age += dt;
      const t = Math.min(r.age / r.life, 1);
      ringsAlive = true;
      _s.setScalar(1.6 + t * 3.2);
      rings.setMatrixAt(i, _m.compose(_p.set(r.x, WATER_Y + 0.02, r.z), _q, _s));
      rings.setColorAt(i, _c.setScalar((1 - t) * (1 - t) * 0.55 * (1 - 0.5 * env.night.value)));
    }
    if (ringsAlive || rings.visible) {
      rings.instanceMatrix.needsUpdate = true;
      if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    }
    rings.visible = ringsAlive;
    if (alive) {
      pos.needsUpdate = true;
      life.needsUpdate = true;
    }
    if (ref.current) ref.current.visible = alive;
  });
  return (
    <>
      <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
      <primitive object={rings} />
    </>
  );
}
