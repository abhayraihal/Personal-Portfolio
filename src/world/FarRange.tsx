import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Mesh } from 'three';
import { SPAWN } from '../config/layout.ts';
import { COLORS } from '../config/palette.ts';
import { env, LOOK, SUN_DIR } from './env.ts';
import { NOISE } from './glsl.ts';
import { clamp, fbm, range, rng, smoothstep, vnoise } from './rand.ts';

// Snow peaks far behind the valley walls, in the direction the camera always looks. Only a low
// camera (the horizon in frame) shows them; play and zone framings look down past their feet.
// They carry their own haze instead of the scene fog, which would hide anything this far out.

const CENTER: [number, number] = [SPAWN.u, SPAWN.v + 26]; // the idle camera's focus
const R0 = 330; // m from CENTER to the front edge of the band
const R1 = 470; // back edge, inside the camera's 600 m far plane from the idle camera
const SPAN = 82; // degrees either side of screen-up
const COLS = 170;
const ROWS = 14;

// Separate summits along the arc, joined by a lower ragged ridge.
const PEAKS = (() => {
  const r = rng(1931);
  const out: { u: number; v: number; h: number; w: number }[] = [];
  for (let a = -SPAN + 3; a < SPAN; a += range(r, 8, 15)) {
    const rho = range(r, R0 + 45, R1 - 40);
    const t = (a * Math.PI) / 180;
    out.push({ u: CENTER[0] + Math.sin(t) * rho, v: CENTER[1] + Math.cos(t) * rho, h: range(r, 58, 112), w: range(r, 48, 80) });
  }
  return out;
})();

function height(u: number, v: number, rho: number): number {
  const rise = smoothstep(R0, R0 + 40, rho) * (1 - smoothstep(R1 - 25, R1, rho));
  let h = 14 + 20 * fbm(u / 70 + 7.3, v / 70 - 2.1, 3);
  for (const p of PEAKS) {
    const d = Math.hypot(u - p.u, v - p.v) / p.w;
    if (d < 1) h = Math.max(h, p.h * (1 - d) ** 1.3 * (0.86 + 0.28 * vnoise(u / 21, v / 21)));
  }
  return rise * (h + 5 * (vnoise(u / 9, v / 9) - 0.5)) - 4;
}

function buildGeometry(): BufferGeometry {
  const pos: number[] = [];
  const grid: [number, number, number][][] = [];
  for (let j = 0; j <= ROWS; j++) {
    const row: [number, number, number][] = [];
    for (let i = 0; i <= COLS; i++) {
      // Jitter breaks the polar grid into irregular facets.
      const jt = (vnoise(i * 1.7, j * 2.3) - 0.5) * 0.7;
      const jr = (vnoise(i * 2.9 + 40, j * 1.3) - 0.5) * 7;
      const a = ((-SPAN + ((i + jt) / COLS) * 2 * SPAN) * Math.PI) / 180;
      const rho = clamp(R0 + (j / ROWS) * (R1 - R0) + jr, R0, R1);
      const u = CENTER[0] + Math.sin(a) * rho;
      const v = CENTER[1] + Math.cos(a) * rho;
      row.push([u, height(u, v, rho), -v]);
    }
    grid.push(row);
  }
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i];
      const d = grid[j + 1][i + 1];
      // Non-indexed so every facet is flat; winding faces +Y and the camera side.
      if ((i + j) % 2 === 0) pos.push(...a, ...b, ...d, ...a, ...d, ...c);
      else pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeBoundingSphere();
  return g;
}

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uNight;
uniform vec3 uHaze;
uniform vec3 uHazeHigh;
uniform vec3 uRock;
uniform vec3 uPine;
uniform vec3 uSnow;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  float h = vWorld.y;
  float slope = 1.0 - n.y;
  float k = vw_noise(vWorld.xz * 0.025);
  vec3 col = mix(uPine, uRock, smoothstep(18.0, 55.0, h + (k - 0.5) * 20.0));
  float snow = smoothstep(50.0, 58.0, h + (k - 0.5) * 18.0) * (1.0 - smoothstep(0.66, 0.9, slope));
  col = mix(col, uSnow, snow);
  float lit = 0.55 + 0.6 * max(dot(n, uSun), 0.0);
  col *= mix(lit, 0.35 + 0.35 * lit, uNight);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Aerial perspective, mixed in output space like three's fog so a fully hazed foot matches the
  // fog colour exactly: the feet melt into it, the summits stay crisp.
  float up = smoothstep(12.0, 95.0, h);
  float haze = mix(0.9, 0.3, up);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(uHaze, uHazeHigh, up), mix(haze, haze * 0.85, uNight));
}
`;

const _c = new Color();
const _h = new Color();

export function FarRange() {
  const geometry = useMemo(buildGeometry, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uSun: { value: new Vector3() },
          uNight: env.night,
          uHaze: { value: new Color() },
          uHazeHigh: { value: new Color() },
          uRock: { value: new Color() },
          uPine: { value: new Color() },
          uSnow: { value: new Color() },
        },
        fog: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const day = useMemo(() => ({ rock: new Color(COLORS.rock), pine: new Color(COLORS.pine).multiplyScalar(0.8), snow: new Color(COLORS.snow) }), []);
  const night = useMemo(() => ({ rock: new Color('#2a3150'), pine: new Color('#16243a'), snow: new Color('#8fa3d6') }), []);
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = env.topEdge.value > -0.05;
  });
  return (
    <mesh
      ref={ref}
      name="valley-far-range"
      geometry={geometry}
      material={material}
      renderOrder={1}
      onBeforeRender={() => {
        const k = env.night.value;
        const u = material.uniforms;
        (u.uSun.value as Vector3).copy(SUN_DIR);
        _c.lerpColors(LOOK.day.fog, LOOK.night.fog, k).getRGB(u.uHaze.value as Color, SRGBColorSpace);
        // Summits fade towards the sky behind them rather than the fog.
        _c.lerp(_h.lerpColors(LOOK.day.skyLow, LOOK.night.skyLow, k), 0.6).getRGB(u.uHazeHigh.value as Color, SRGBColorSpace);
        (u.uRock.value as Color).lerpColors(day.rock, night.rock, k);
        (u.uPine.value as Color).lerpColors(day.pine, night.pine, k);
        (u.uSnow.value as Color).lerpColors(day.snow, night.snow, k);
      }}
    />
  );
}
