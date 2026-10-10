import { useEffect, useMemo } from 'react';
import { CircleGeometry, Color, LatheGeometry, MeshStandardMaterial, PlaneGeometry, Vector2, Vector4 } from 'three';
import type { DataTexture } from 'three';
import { BOUNDS, ZONE_BY_ID } from '../config/layout.ts';
import { COLORS } from '../config/palette.ts';
import { env, LAMP_COLOR } from './env.ts';
import { ASPHALT, DIRT, ISLAND_R, RING } from './geo.ts';
import { NOISE, SCREEN } from './glsl.ts';
import { MASK_RECT, STREAM_ENC } from './mask.ts';
import { ISLAND_Y } from './plan.ts';

// The valley floor. Roads, kerbs, centre lines, dirt tracks, wear and the gradient are all drawn by
// this one shader from the layout (no extra meshes, so nothing can z-fight). The stream channel is
// cut out with discard; Stream.tsx draws the banks and water in the hole.

const HUB = ZONE_BY_ID.hub.center;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform vec4 uAsph[${ASPHALT.length}];
uniform float uAsphHalf[${ASPHALT.length}];
uniform vec4 uDirt[${DIRT.length}];
uniform float uDirtHalf[${DIRT.length}];
uniform vec4 uRing;
uniform float uIslandR;
uniform vec4 uBounds;
uniform vec2 uHub;
uniform vec3 uGCenter;
uniform vec3 uGMid;
uniform vec3 uGEdge;
uniform vec3 uRoad;
uniform vec3 uLine;
uniform vec3 uDirtCol;
uniform vec3 uKerb;
uniform vec3 uLamp;
uniform float uTime;
uniform float uNight;
uniform float uMotion;
uniform float uDetail;
varying vec2 vScreen;
${NOISE}

float vw_smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
`;

const FRAGMENT_COLOR = /* glsl */ `
vec2 p = vScreen;
vec4 msk = texture2D(uMask, (p - uMaskRect.xy) * uMaskRect.zw);
float se = msk.r * ${STREAM_ENC.range.toFixed(1)} - ${STREAM_ENC.offset.toFixed(1)};
if (se < 0.9) discard; // stream channel: banks and water are their own meshes
float px = length(fwidth(p)); // metres per pixel, for anti-aliasing and detail fades
float fine = uDetail * (1.0 - smoothstep(0.05, 0.22, px));

// ---- meadow gradient: warm in the middle of the valley, deeper green towards the edges
float n1 = vw_fbm(p * 0.017);
float n2 = vw_noise(p * 0.085 + 3.7);
float n3 = vw_noise(p * 0.31 - 1.3);
float hubD = length(p - uHub);
float edgeD = min(min(p.x - uBounds.x, uBounds.z - p.x), min(p.y - uBounds.y, uBounds.w - p.y));
float warm = 1.0 - smoothstep(10.0, 95.0, hubD + (n1 - 0.5) * 60.0);
float edgeT = 1.0 - smoothstep(-6.0, 62.0, edgeD + (n1 - 0.5) * 34.0);
vec3 col = mix(uGMid, uGCenter, warm * 0.5 + smoothstep(0.6, 0.85, n2) * 0.25);
col = mix(col, uGEdge, edgeT * 0.9);
col *= 0.92 + 0.16 * n1;
col = mix(col, col * vec3(1.07, 1.03, 0.82), smoothstep(0.6, 0.86, n2) * 0.5); // dry, golden patches
col = mix(col, col * vec3(0.82, 0.95, 0.86), smoothstep(0.4, 0.14, n2) * 0.55); // lush patches
col *= 1.0 + (n3 - 0.5) * 0.1;
// grass texture: soft clumps and speckles, faded out where a pixel covers several of them
float clump = vw_noise(p * 1.35);
vec2 sp = p * 3.2;
vec2 cell = floor(sp);
vec2 jit = vec2(vw_hash12(cell), vw_hash12(cell + 19.7)) * 0.7 + 0.15;
float dot1 = smoothstep(0.32, 0.12, length(fract(sp) - jit));
float shade = vw_hash12(cell + 3.1);
col *= 1.0 + ((clump - 0.5) * 0.12 + dot1 * (shade - 0.45) * 0.16) * fine;

// wildflower specks in some patches of the meadow
vec2 fp = p * 1.15;
vec2 fc = floor(fp);
float fpatch = smoothstep(0.5, 0.78, vw_noise(p * 0.045 + 9.0));
if (vw_hash12(fc + 41.0) < 0.4 * fpatch && fine > 0.0) {
  vec2 fj = vec2(vw_hash12(fc + 5.0), vw_hash12(fc + 9.0)) * 0.7 + 0.15;
  float petal = smoothstep(0.085, 0.045, length(fract(fp) - fj));
  float pick = vw_hash12(fc + 13.0);
  vec3 fcol = pick < 0.35 ? vec3(0.86, 0.85, 0.8) : pick < 0.62 ? vec3(0.92, 0.62, 0.08) : pick < 0.82 ? vec3(0.42, 0.33, 0.82) : vec3(0.9, 0.34, 0.5);
  col = mix(col, fcol, petal * fine);
}

// ---- riverside: lusher and darker towards the water
float lush = 1.0 - smoothstep(0.9, 7.0, se + (n2 - 0.5) * 2.5);
col = mix(col, uGEdge * vec3(0.9, 1.02, 0.9), lush * 0.55);
col *= 1.0 - 0.16 * (1.0 - smoothstep(0.9, 1.9, se)); // damp lip of the bank

// ---- forest floor and contact shading under trees, rocks and poles
float ao = msk.b;
col = mix(col, col * vec3(0.66, 0.64, 0.55), ao * 0.85);

// ---- dirt roads with soft, ragged edges and tyre ruts
float dD = 1e5;
float dirtAcross = 0.0;
for (int i = 0; i < ${DIRT.length}; i++) {
  vec2 a = uDirt[i].xy;
  vec2 ab = uDirt[i].zw - a;
  float L = length(ab);
  vec2 t = ab / L;
  vec2 ap = p - a;
  float al = clamp(dot(ap, t), 0.0, L);
  float d = length(ap - t * al) - uDirtHalf[i];
  if (d < dD) { dD = d; dirtAcross = dot(ap, vec2(-t.y, t.x)); }
}
dD += (vw_noise(p * 0.7) - 0.5) * 0.55 + (n3 - 0.5) * 0.25;
float wornDirt = 1.0 - smoothstep(0.0, 2.2, dD);
col = mix(col, col * vec3(0.9, 0.85, 0.72), wornDirt * 0.6);
float onDirt = 1.0 - smoothstep(-0.25, 0.2, dD);
vec3 dirt = uDirtCol * 1.08 * (0.93 + 0.12 * vw_noise(p * 0.45)) * (1.0 + (vw_noise(p * 2.6) - 0.5) * 0.1);
float rut = smoothstep(0.5, 0.05, abs(abs(dirtAcross) - 1.2));
dirt *= 1.0 - 0.12 * rut;
vec2 pp = p * 2.4;
vec2 pc = floor(pp);
float peb = smoothstep(0.2, 0.08, length(fract(pp) - (vec2(vw_hash12(pc), vw_hash12(pc + 7.3)) * 0.6 + 0.2))) * step(0.55, vw_hash12(pc + 2.2));
dirt = mix(dirt, dirt * vec3(1.18, 1.14, 1.06), peb * fine * 0.7);
dirt *= 1.0 - 0.1 * smoothstep(-0.9, 0.0, dD); // darker, packed edge
col = mix(col, dirt, onDirt);

// ---- the bike trail through the woods (mask alpha on dry ground)
float trail = msk.a * smoothstep(1.2, 2.0, se);
col = mix(col, col * vec3(0.88, 0.84, 0.72), smoothstep(0.0, 0.35, trail) * 0.55);
vec3 trailCol = uDirtCol * vec3(0.8, 0.74, 0.68) * (0.9 + 0.2 * vw_noise(p * 1.1));
col = mix(col, trailCol, smoothstep(0.4, 0.75, trail + (vw_noise(p * 1.7) - 0.5) * 0.3));

// ---- asphalt: straight roads and the roundabout, filleted where they meet
float dA = 1e5;
float near = 1e5;
float along = 0.0;
float across = 0.0;
float ringDist = length(p - uRing.xy);
for (int i = 0; i < ${ASPHALT.length}; i++) {
  vec2 a = uAsph[i].xy;
  vec2 ab = uAsph[i].zw - a;
  float L = length(ab);
  vec2 t = ab / L;
  vec2 ap = p - a;
  float al = dot(ap, t);
  float d = length(ap - t * clamp(al, 0.0, L)) - uAsphHalf[i];
  if (d < near) { near = d; along = al; across = dot(ap, vec2(-t.y, t.x)); }
  dA = vw_smin(dA, d, 2.2);
}
float dRing = abs(ringDist - uRing.z) - uRing.w;
bool onRing = dRing < near;
dA = vw_smin(dA, dRing, 2.2);
dA = max(dA, uIslandR - ringDist); // the island is not road
float aa = max(px, 0.002) * 1.2;

// worn verge and the kerb's soft shadow just outside the road
float verge = 1.0 - smoothstep(0.0, 2.4, dA + (n3 - 0.5) * 0.9);
col = mix(col, col * vec3(0.86, 0.83, 0.72), verge * 0.55);
col *= 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.35, dA));

vec3 road = uRoad * 1.15 * (0.93 + 0.1 * vw_noise(p * 0.5)) * (1.0 + (vw_noise(p * 5.0) - 0.5) * 0.08 * fine);
float lane = onRing ? abs(ringDist - uRing.z) : abs(across);
road *= 1.0 - 0.06 * smoothstep(0.7, 0.0, abs(lane - 1.9)); // wheel tracks
// dashed centre line
float dashT = onRing ? atan(p.y - uRing.y, p.x - uRing.x) * uRing.z : along;
float period = onRing ? 6.2831853 * uRing.z / floor(6.2831853 * uRing.z / 6.0 + 0.5) : 6.0;
float dash = step(fract(dashT / period), 0.5);
float lineW = 0.12;
float lineM = (1.0 - smoothstep(lineW - aa, lineW + aa, lane)) * dash;
if (!onRing && ringDist < uRing.z + uRing.w + 0.6) lineM = 0.0;
if (!onRing && abs(p.x) < 4.5 && p.y > -17.0 && p.y < 18.0) lineM = 0.0; // hub spine carries painted text
road = mix(road, uLine, lineM * 0.92);
// kerb: light stone band with joints, a gutter line on the road side
float kerbW = 0.36;
float kerbM = smoothstep(-kerbW - aa, -kerbW + aa, dA);
float joint = onRing ? dashT : along;
vec3 kerb = uKerb * (0.92 + 0.08 * step(0.5, fract(joint / 1.2)));
kerb *= 1.0 - 0.25 * smoothstep(-0.08, 0.0, dA); // rounded outer edge
road = mix(road, kerb, kerbM);
road *= 1.0 - 0.25 * (smoothstep(-kerbW - 0.12, -kerbW, dA) - kerbM);
float onRoad = 1.0 - smoothstep(-aa, aa, dA);
col = mix(col, road, onRoad);

// ---- roundabout island lawn (the raised island mesh uses this same shader)
float isl = 1.0 - smoothstep(uIslandR - aa, uIslandR + aa, ringDist);
vec3 lawn = uGMid * vec3(0.78, 1.0, 0.72) * (0.95 + 0.1 * n3);
lawn *= 1.0 + (vw_noise(p * 2.4) - 0.5) * 0.12 * fine;
col = mix(col, lawn, isl);

// A little extra saturation; the filmic tone curve washes greens out.
col = max(mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.08), 0.0);
diffuseColor.rgb = col;
`;

const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += uLamp * msk.g * msk.g * uNight * diffuseColor.rgb * 0.75;
`;

// Drifting cloud shadows only dim the sun, not the sky light.
const FRAGMENT_LIGHT = /* glsl */ `
#include <lights_fragment_end>
float cloud = smoothstep(0.5, 0.78, vw_fbm(p * 0.021 + uTime * uMotion * vec2(0.012, -0.007))) * 0.3 * (1.0 - uNight);
reflectedLight.directDiffuse *= 1.0 - cloud;
`;

function makeMaterial(mask: DataTexture) {
  const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  const uniforms = {
    uMask: { value: mask },
    uMaskRect: { value: new Vector4(...MASK_RECT) },
    uAsph: { value: ASPHALT.map((s) => new Vector4(s.a[0], s.a[1], s.b[0], s.b[1])) },
    uAsphHalf: { value: ASPHALT.map((s) => s.half) },
    uDirt: { value: DIRT.map((s) => new Vector4(s.a[0], s.a[1], s.b[0], s.b[1])) },
    uDirtHalf: { value: DIRT.map((s) => s.half) },
    uRing: { value: new Vector4(RING.u, RING.v, RING.r, RING.half) },
    uIslandR: { value: ISLAND_R },
    uBounds: { value: new Vector4(BOUNDS.u0, BOUNDS.v0, BOUNDS.u1, BOUNDS.v1) },
    uHub: { value: new Vector2(HUB[0], HUB[1]) },
    uGCenter: { value: new Color(COLORS.groundCenter) },
    uGMid: { value: new Color(COLORS.groundMid) },
    uGEdge: { value: new Color(COLORS.groundEdge) },
    uRoad: { value: new Color(COLORS.road) },
    uLine: { value: new Color(COLORS.roadLine) },
    uDirtCol: { value: new Color(COLORS.dirt) },
    uKerb: { value: new Color('#d9d4c7') },
    uLamp: { value: LAMP_COLOR },
    uTime: env.time,
    uNight: env.night,
    uMotion: env.motion,
    uDetail: { value: 1 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vScreen;\n${SCREEN}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvScreen = vw_screen((modelMatrix * vec4(transformed, 1.0)).xyz);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE)
      .replace('#include <lights_fragment_end>', FRAGMENT_LIGHT);
  };
  m.customProgramCacheKey = () => 'valley-ground-v1';
  return { material: m, uniforms };
}

// Raised stone kerb around the roundabout island (a lathe of a rounded kerb profile).
function islandKerb() {
  const R = ISLAND_R;
  const pts = [
    [R - 0.2, -0.05], [R - 0.2, ISLAND_Y + 0.06], [R - 0.15, ISLAND_Y + 0.11], [R + 0.13, ISLAND_Y + 0.11],
    [R + 0.19, ISLAND_Y + 0.05], [R + 0.2, -0.05],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(pts, 72);
}

export function Ground({ mask, low }: { mask: DataTexture; low: boolean }) {
  const { material, uniforms } = useMemo(() => makeMaterial(mask), [mask]);
  useEffect(() => {
    uniforms.uDetail.value = low ? 0.4 : 1;
  }, [low, uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  const plane = useMemo(() => new PlaneGeometry(1500, 1500, 24, 24).rotateX(-Math.PI / 2), []);
  const island = useMemo(() => new CircleGeometry(ISLAND_R - 0.1, 48).rotateX(-Math.PI / 2), []);
  const kerb = useMemo(islandKerb, []);
  const kerbMat = useMemo(() => new MeshStandardMaterial({ color: '#d6d1c4', roughness: 0.9 }), []);
  const cu = (BOUNDS.u0 + BOUNDS.u1) / 2;
  const cv = (BOUNDS.v0 + BOUNDS.v1) / 2;
  return (
    <>
      <mesh name="valley-ground" geometry={plane} material={material} position={[cu, 0, -cv]} receiveShadow />
      <mesh name="roundabout-island" geometry={island} material={material} position={[RING.u, ISLAND_Y, -RING.v]} receiveShadow />
      <mesh name="roundabout-kerb" geometry={kerb} material={kerbMat} position={[RING.u, 0, -RING.v]} castShadow receiveShadow />
    </>
  );
}
