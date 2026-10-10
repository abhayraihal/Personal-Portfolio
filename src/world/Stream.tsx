import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, Vector4 } from 'three';
import type { DataTexture } from 'three';
import { env, WATER } from './env.ts';
import { STREAM_PATH } from './geo.ts';
import { NOISE, SCREEN } from './glsl.ts';
import { MASK_RECT } from './mask.ts';

// The stream sits in a shallow channel: the ground shader cuts the channel out (stream edge
// distance < 0.9 m) and these meshes fill it. The car still drives on the flat ground collider,
// so it wades through the water.
export const WATER_Y = -0.3;

// Bank cross-section, from under the water out to just below the ground at the cut.
const BANK_OFF = [-0.7, 0.0, 0.32, 0.68, 1.1];
const BANK_Y = [-0.62, -0.34, -0.2, -0.09, -0.03];
const BANK_COL = ['#3f382e', '#54473a', '#8b7d68', '#617a45', '#6a8a4b'].map((c) => new Color(c));

function waterGeometry() {
  const p = STREAM_PATH;
  const n = p.pts.length;
  const pos = new Float32Array(n * 6);
  const nor = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const [cu, cv] = p.pts[i];
    const [nu, nv] = p.n[i];
    const w = p.w[i] + 0.35;
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? 1 : -1;
      const o = (i * 2 + k) * 3;
      pos[o] = cu + nu * w * side;
      pos[o + 1] = WATER_Y;
      pos[o + 2] = -(cv + nv * w * side);
      nor[o + 1] = 1;
      uv[(i * 2 + k) * 2] = (side * w) / p.w[i];
      uv[(i * 2 + k) * 2 + 1] = p.s[i];
    }
    if (i < n - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function bankGeometry() {
  const p = STREAM_PATH;
  const n = p.pts.length;
  const rows = BANK_OFF.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const [cu, cv] = p.pts[i];
      const [nu, nv] = p.n[i];
      for (let r = 0; r < rows; r++) {
        const o = (p.w[i] + BANK_OFF[r]) * side;
        pos.push(cu + nu * o, BANK_Y[r], -(cv + nv * o));
        const c = BANK_COL[r];
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < n - 1; i++)
      for (let r = 0; r < rows - 1; r++) {
        const A = base + i * rows + r;
        const B = A + 1;
        const C = A + rows;
        const D = C + 1;
        if (side === 1) idx.push(B, A, D, A, C, D);
        else idx.push(A, B, C, B, D, C);
      }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const WATER_PARS = /* glsl */ `
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform float uTime;
uniform float uNight;
uniform vec3 uWLight;
uniform vec3 uWMid;
uniform vec3 uWDeep;
varying vec2 vStream;
varying vec2 vScreen;
${NOISE}
`;

const WATER_COLOR = /* glsl */ `
float wx = abs(vStream.x);
float flow = vStream.y - uTime * 1.15;
float wn = vw_noise(vec2(vStream.x * 2.2, flow * 0.28));
float wn2 = vw_noise(vec2(vStream.x * 5.0 + 7.0, flow * 0.8));
vec3 wcol = mix(uWDeep, uWMid, smoothstep(0.05, 0.85, wx + (wn - 0.5) * 0.35));
wcol = mix(wcol, uWLight, smoothstep(0.62, 1.02, wx));
float st = vw_noise(vec2(vStream.x * 7.0, flow * 0.22));
float streak = smoothstep(0.64, 0.7, st) * (1.0 - smoothstep(0.76, 0.84, st));
wcol = mix(wcol, uWLight * 1.18, streak * 0.5);
vec4 wmsk = texture2D(uMask, (vScreen - uMaskRect.xy) * uMaskRect.zw);
float edgeFoam = smoothstep(0.8, 0.98, wx + (wn2 - 0.5) * 0.24);
float rockFoam = smoothstep(0.2, 0.65, wmsk.a * (0.65 + 0.7 * wn2));
float foam = max(edgeFoam, rockFoam);
wcol = mix(wcol, vec3(0.92, 0.97, 0.98), foam * 0.88);
diffuseColor.rgb = wcol;
`;

const WATER_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
vec2 sc = vec2(vStream.x * 9.0, flow * 1.7);
float sh = vw_hash12(floor(sc));
float spark = step(0.92, sh) * smoothstep(0.24, 0.0, length(fract(sc) - 0.5)) * (0.5 + 0.5 * sin(uTime * 5.0 + sh * 40.0));
totalEmissiveRadiance += spark * (1.0 - foam) * mix(vec3(1.0, 0.95, 0.82) * 0.45, vec3(0.7, 0.82, 1.0) * 0.8, uNight);
totalEmissiveRadiance += wcol * 0.05 * uNight;
`;

function waterMaterial(mask: DataTexture) {
  const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.32, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uMask: { value: mask },
      uMaskRect: { value: new Vector4(...MASK_RECT) },
      uTime: env.time,
      uNight: env.night,
      uWLight: { value: WATER.light },
      uWMid: { value: WATER.mid },
      uWDeep: { value: WATER.deep },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vStream;\nvarying vec2 vScreen;\n${SCREEN}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStream = uv;\nvScreen = vw_screen((modelMatrix * vec4(transformed, 1.0)).xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_PARS}`)
      .replace('#include <color_fragment>', WATER_COLOR)
      .replace('#include <emissivemap_fragment>', WATER_EMISSIVE);
  };
  m.customProgramCacheKey = () => 'valley-water-v1';
  return m;
}

function bankMaterial() {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vScreen;\n${SCREEN}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvScreen = vw_screen((modelMatrix * vec4(transformed, 1.0)).xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vScreen;\n${NOISE}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.86 + 0.24 * vw_noise(vScreen * 2.6) + 0.1 * (vw_noise(vScreen * 0.4) - 0.5);');
  };
  m.customProgramCacheKey = () => 'valley-bank-v1';
  return m;
}

export function Stream({ mask }: { mask: DataTexture }) {
  const water = useMemo(waterGeometry, []);
  const banks = useMemo(bankGeometry, []);
  const wMat = useMemo(() => waterMaterial(mask), [mask]);
  const bMat = useMemo(bankMaterial, []);
  useEffect(() => () => wMat.dispose(), [wMat]);
  return (
    <group name="valley-stream">
      <mesh geometry={banks} material={bMat} receiveShadow />
      <mesh geometry={water} material={wMat} receiveShadow />
    </group>
  );
}
