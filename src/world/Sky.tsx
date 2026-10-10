import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Fog, ShaderMaterial } from 'three';
import type { HemisphereLight, Points } from 'three';
import { BOUNDS } from '../config/layout.ts';
import { screenToWorld } from '../config/world.ts';
import { car } from '../state/car.ts';
import { useStore } from '../state/store.ts';
import { env, LOOK } from './env.ts';
import { rng } from './rand.ts';

const NIGHT_RATE = 1.4; // 1/s, about 2.5 s from day to night

// Advances the shared clock and eases the day/night blend. Mounted once, before everything else.
export function EnvDriver() {
  const camera = useThree((s) => s.camera);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = useStore.getState();
    env.time.value += dt * (s.reducedMotion ? 0.3 : 1);
    env.motion.value = s.reducedMotion ? 0.3 : 1;
    const target = s.night ? 1 : 0;
    const n = env.night.value;
    env.night.value = Math.abs(target - n) < 0.002 ? target : n + (target - n) * (1 - Math.exp(-dt * NIGHT_RATE));
    env.car.value.set(car.x, car.y + 0.8, car.z);
    env.cam.value.copy(camera.position);
  }, -10);
  return null;
}

// Background, fog and sky light. Fog and background share one colour so distant ground melts
// into the sky.
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<HemisphereLight>(null);
  const fog = useMemo(() => new Fog(LOOK.day.fog.clone(), 95, 300), []);
  const bg = useMemo(() => LOOK.day.fog.clone(), []);
  useLayoutEffect(() => {
    const prevFog = scene.fog;
    const prevBg = scene.background;
    scene.fog = fog;
    scene.background = bg;
    return () => {
      scene.fog = prevFog;
      scene.background = prevBg;
    };
  }, [scene, fog, bg]);
  useFrame(() => {
    const k = env.night.value;
    fog.color.lerpColors(LOOK.day.fog, LOOK.night.fog, k);
    bg.copy(fog.color);
    fog.near = 95 - 25 * k;
    fog.far = 300 - 90 * k;
    const h = hemi.current;
    if (h) {
      h.color.lerpColors(LOOK.day.hemiSky, LOOK.night.hemiSky, k);
      h.groundColor.lerpColors(LOOK.day.hemiGround, LOOK.night.hemiGround, k);
      h.intensity = LOOK.day.hemi + (LOOK.night.hemi - LOOK.day.hemi) * k;
    }
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[LOOK.day.hemiSky, LOOK.day.hemiGround, LOOK.day.hemi]} />
      <Stars />
    </>
  );
}

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uNight;
uniform float uDpr;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.65 + 0.35 * sin(uTime * (1.3 + aPhase) + aPhase * 17.0);
  vAlpha = uNight * tw;
  gl_PointSize = aSize * uDpr;
}
`;
const STAR_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(d));
  gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * vAlpha, 1.0);
}
`;

// A dome of stars, seen whenever a camera framing shows the sky at night.
function Stars() {
  const ref = useRef<Points>(null);
  const dpr = useThree((s) => s.viewport.dpr);
  const { geometry, material } = useMemo(() => {
    const r = rng(77);
    const n = 900;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const [cx, cz] = screenToWorld((BOUNDS.u0 + BOUNDS.u1) / 2, (BOUNDS.v0 + BOUNDS.v1) / 2);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const el = Math.asin(0.08 + r() * 0.92);
      const R = 430;
      pos[i * 3] = cx + Math.cos(a) * Math.cos(el) * R;
      pos[i * 3 + 1] = Math.sin(el) * R * 0.6 + 20;
      pos[i * 3 + 2] = cz + Math.sin(a) * Math.cos(el) * R;
      size[i] = 1.2 + r() * r() * 2.6;
      phase[i] = r() * 3;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aPhase', new BufferAttribute(phase, 1));
    const m = new ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: env.time, uNight: env.night, uDpr: { value: 1 } },
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    });
    return { geometry: g, material: m };
  }, []);
  material.uniforms.uDpr.value = dpr;
  useFrame(() => {
    if (ref.current) ref.current.visible = env.night.value > 0.02;
  });
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />;
}

