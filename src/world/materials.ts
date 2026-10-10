// Material variants of the shared Kenney kit materials: wind sway for trees and grass, a
// screen-door fade for trees between the camera and the car, and fluttering darchog banners.
// Each variant keeps the kit's colormap, so no texture is uploaded twice.
import { MeshStandardMaterial } from 'three';
import { env } from './env.ts';
import { DITHER, NOISE } from './glsl.ts';

const cache = new Map<string, MeshStandardMaterial>();

type SwayOpts = {
  height: number; // native model height used to normalise the sway
  amp: number; // metres of sway at the top, before instance scaling
  dither?: boolean; // fade when between the camera and the car
};

const SWAY_PARS = /* glsl */ `
uniform float uTime;
uniform float uMotion;
varying vec3 vWorldPos;
`;

function swayProject(o: SwayOpts) {
  return /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 vwW = modelMatrix * mvPosition;
float vwH = clamp(transformed.y / ${o.height.toFixed(3)}, 0.0, 1.0);
float vwPh = dot(vwW.xz, vec2(0.071, 0.053));
float vwS = (sin(uTime * 1.35 + vwPh) * 0.65 + sin(uTime * 2.2 + vwPh * 1.9) * 0.35) * uMotion;
vwW.xz += vec2(0.8, 0.55) * vwS * ${o.amp.toFixed(3)} * vwH * vwH;
vWorldPos = vwW.xyz;
mvPosition = viewMatrix * vwW;
gl_Position = projectionMatrix * mvPosition;
`;
}

const DITHER_PARS = /* glsl */ `
uniform vec3 uCar;
uniform vec3 uCam;
varying vec3 vWorldPos;
${DITHER}
`;

const DITHER_MAIN = /* glsl */ `
#include <clipping_planes_fragment>
{
  vec3 ca = uCar - uCam;
  vec3 cp = vWorldPos - uCam;
  float tt = dot(cp, ca) / max(dot(ca, ca), 1e-3);
  if (tt > 0.05 && tt < 0.97) {
    float d = length(cp - ca * tt);
    float fade = (1.0 - smoothstep(1.1, 2.7, d)) * 0.72;
    if (fade > vw_bayer(gl_FragCoord.xy)) discard;
  }
}
`;

export function swayMaterial(base: MeshStandardMaterial, o: SwayOpts): MeshStandardMaterial {
  const key = `sway|${base.name}|${o.height}|${o.amp}|${o.dither ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new MeshStandardMaterial({ map: base.map, roughness: 1, metalness: 0, side: base.side });
  m.name = key;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uMotion = env.motion;
    shader.uniforms.uCar = env.car;
    shader.uniforms.uCam = env.cam;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SWAY_PARS}`)
      .replace('#include <project_vertex>', swayProject(o));
    if (o.dither) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${DITHER_PARS}`)
        .replace('#include <clipping_planes_fragment>', DITHER_MAIN);
    }
  };
  // Same code for every kit, so the kits share one program per variant.
  m.customProgramCacheKey = () => `valley-sway|${o.height}|${o.amp}|${o.dither ? 1 : 0}`;
  cache.set(key, m);
  return m;
}

// Darchog banners: the cloth (native x < -0.04, away from the pole) ripples in the wind.
export function bannerMaterial(base: MeshStandardMaterial): MeshStandardMaterial {
  const key = `banner|${base.name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new MeshStandardMaterial({ map: base.map, roughness: 1, metalness: 0, side: base.side });
  m.name = key;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uMotion = env.motion;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uMotion;\n${NOISE}`)
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
float vwK = clamp((-transformed.x - 0.04) / 0.22, 0.0, 1.0);
#ifdef USE_INSTANCING
  float vwPh = dot(instanceMatrix[3].xz, vec2(0.37, 0.23));
#else
  float vwPh = 0.0;
#endif
float vwT = uTime * 3.1 + vwPh;
transformed.z += (sin(vwT + transformed.y * 7.0 - transformed.x * 11.0) * 0.032 + sin(vwT * 1.7 + transformed.y * 3.0) * 0.012) * vwK * uMotion;
transformed.x += sin(vwT * 0.8 + transformed.y * 4.0) * 0.012 * vwK * uMotion;`,
      );
  };
  m.customProgramCacheKey = () => 'valley-banner';
  cache.set(key, m);
  return m;
}
