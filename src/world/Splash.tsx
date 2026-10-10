import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, ShaderMaterial } from 'three';
import type { Points } from 'three';
import { CAMERA } from '../config/world.ts';
import { car } from '../state/car.ts';
import { playSound } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { env } from './env.ts';
import { streamEdgeAt } from './field.ts';
import { onBridge } from './geo.ts';
import { WATER_Y } from './Stream.tsx';

// Spray from the wheels when the car wades through the stream. CPU particles in one Points draw.

const MAX = 160;
const VERT = /* glsl */ `
attribute float aLife;
uniform float uScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aLife > 0.0 ? uScale * (0.5 + 0.5 * aLife) / -mv.z : 0.0;
}
`;
const FRAG = /* glsl */ `
uniform float uNight;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vLife <= 0.0) discard;
  vec3 c = mix(vec3(0.93, 0.98, 1.0), vec3(0.5, 0.6, 0.75), uNight);
  gl_FragColor = vec4(c, smoothstep(1.0, 0.6, d) * min(vLife * 2.0, 1.0));
}
`;

export function Splash() {
  const ref = useRef<Points>(null);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const state = useRef({ cursor: 0, wet: false, acc: 0 });
  const sim = useMemo(() => ({ vel: new Float32Array(MAX * 3) }), []);
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
  material.uniforms.uScale.value = (0.22 * size.height * dpr) / (2 * Math.tan((CAMERA.fov * Math.PI) / 360));

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
      l[i] -= dt * 1.4;
      v[i * 3 + 1] -= 9.8 * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < WATER_Y) l[i] = 0;
    }
    const speed = Math.abs(car.speed);
    const inWater = car.ready && streamEdgeAt(car.u, car.v) < -0.3 && !onBridge(car.u, car.v);
    if (inWater && speed > 4 && !s.wet && useStore.getState().phase === 'play') playSound('whoosh', 0.35);
    s.wet = inWater && speed > 2;
    if (s.wet && !useStore.getState().reducedMotion) {
      s.acc += dt * Math.min(speed * 7, 110);
      const fx = Math.cos(car.yaw);
      const fz = -Math.sin(car.yaw);
      const dir = Math.sign(car.speed) || 1;
      while (s.acc >= 1) {
        s.acc -= 1;
        const i = s.cursor++ % MAX;
        const along = (Math.random() < 0.5 ? -1 : 1) * 0.99;
        const across = (Math.random() < 0.5 ? -1 : 1) * 0.85;
        p[i * 3] = car.x + fx * along - fz * across;
        p[i * 3 + 1] = WATER_Y + 0.05;
        p[i * 3 + 2] = car.z + fz * along + fx * across;
        const out = 0.8 + Math.random() * 1.4;
        v[i * 3] = -fz * across * out - fx * dir * speed * 0.15 + (Math.random() - 0.5);
        v[i * 3 + 1] = 2.2 + Math.random() * 2.4 + speed * 0.08;
        v[i * 3 + 2] = fx * across * out - fz * dir * speed * 0.15 + (Math.random() - 0.5);
        l[i] = 0.7 + Math.random() * 0.3;
        alive = true;
      }
    }
    if (alive) {
      pos.needsUpdate = true;
      life.needsUpdate = true;
    }
    if (ref.current) ref.current.visible = alive;
  });
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
