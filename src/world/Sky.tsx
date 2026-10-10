import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, Fog, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { HemisphereLight, Points } from 'three';
import { car } from '../state/car.ts';
import { useStore } from '../state/store.ts';
import { env, LOOK } from './env.ts';
import { rng, smoothstep } from './rand.ts';

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

const DEG = Math.PI / 180;
const _fwd = new Vector3();

// Background, fog and sky light. Fog and background share one colour so distant ground melts
// into the sky. A low camera (the horizon in frame) gets thinner fog, so the far hills and the
// snow peaks behind them read as layers instead of a white wall.
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
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
    camera.getWorldDirection(_fwd);
    const low = 1 - smoothstep(16 * DEG, 24 * DEG, Math.asin(Math.min(1, Math.max(-1, -_fwd.y))));
    fog.near = 95 - 25 * k + 60 * low;
    fog.far = 300 - 90 * k + 180 * low;
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
      <SkyDome />
      <Stars />
    </>
  );
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w); // on the far plane, behind everything
}
`;
// Colours arrive in output (sRGB) space and are written as they are, so the horizon is exactly
// the fog colour that the far ground and the background fade to.
const SKY_FRAG = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uLow;
uniform vec3 uZenith;
varying vec3 vDir;
void main() {
  float e = normalize(vDir).y;
  vec3 col = mix(uHorizon, uLow, smoothstep(0.05, 0.22, e));
  col = mix(col, uZenith, smoothstep(0.22, 0.9, e));
  gl_FragColor = vec4(col, 1.0);
}
`;

const _sky = new Color();

// Gradient sky behind everything. Drawn after the opaque pass, so only pixels with nothing else
// in them run its shader; a framing that never shows the horizon costs one empty draw call.
function SkyDome() {
  const { geometry, material } = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uHorizon: { value: new Color() }, uLow: { value: new Color() }, uZenith: { value: new Color() } },
      side: BackSide,
      depthWrite: false,
      transparent: true,
      fog: false,
      toneMapped: false,
    });
    return { geometry: new SphereGeometry(1, 24, 12), material: m };
  }, []);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(() => {
    const k = env.night.value;
    const u = material.uniforms;
    _sky.lerpColors(LOOK.day.fog, LOOK.night.fog, k).getRGB(u.uHorizon.value as Color, SRGBColorSpace);
    _sky.lerpColors(LOOK.day.skyLow, LOOK.night.skyLow, k).getRGB(u.uLow.value as Color, SRGBColorSpace);
    _sky.lerpColors(LOOK.day.skyTop, LOOK.night.skyTop, k).getRGB(u.uZenith.value as Color, SRGBColorSpace);
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-2} name="valley-sky" />;
}

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uNight;
uniform float uDpr;
varying float vAlpha;
void main() {
  // Directions on a unit sphere, drawn at infinity like the sky: anything in front hides them.
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
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

// Stars, seen whenever a camera framing shows the sky at night. Low cameras only show a few
// degrees of sky above the far peaks, so the stars crowd towards the horizon.
function Stars() {
  const ref = useRef<Points>(null);
  const dpr = useThree((s) => s.viewport.dpr);
  const { geometry, material } = useMemo(() => {
    const r = rng(77);
    const n = 900;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const t = r();
      const el = Math.asin(0.035 + 0.965 * t * t);
      pos[i * 3] = Math.cos(a) * Math.cos(el);
      pos[i * 3 + 1] = Math.sin(el);
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(el);
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

