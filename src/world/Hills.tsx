import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, Vector4 } from 'three';
import type { DataTexture } from 'three';
import { BOUNDS } from '../config/layout.ts';
import { COLORS } from '../config/palette.ts';
import { streamEdgeAt } from './field.ts';
import { hillHeight, outside } from './geo.ts';
import { NOISE, SCREEN } from './glsl.ts';
import { MASK_RECT, STREAM_ENC } from './mask.ts';
import { hash2 } from './rand.ts';

// Low-poly valley walls just outside BOUNDS: meadow at the foot, pine-green slopes, terraced
// fields in places, rock on steep faces and snow on the far, taller ring. Flat shaded.

const CELL = 5.5;
const SINK = 0.08; // the foot of the hills sits just under the valley floor

function buildGeometry(): BufferGeometry {
  const u0 = BOUNDS.u0 - 150;
  const u1 = BOUNDS.u1 + 150;
  const v0 = BOUNDS.v0 - 95;
  const v1 = BOUNDS.v1 + 150;
  const nu = Math.ceil((u1 - u0) / CELL);
  const nv = Math.ceil((v1 - v0) / CELL);
  const cols = nu + 1;
  const pos = new Float32Array(cols * (nv + 1) * 3);
  const s = new Float32Array(cols * (nv + 1));
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      let u = u0 + i * CELL;
      let v = v0 + j * CELL;
      // Jitter for irregular facets; less near the valley floor so the foot line stays tidy.
      const jit = Math.min(1, Math.max(0, outside(u, v) / 8)) * 1.7;
      u += (hash2(i, j) - 0.5) * 2 * jit;
      v += (hash2(i + 913, j - 77) - 0.5) * 2 * jit;
      const k = j * cols + i;
      s[k] = outside(u, v);
      const h = hillHeight(u, v, streamEdgeAt(u, v));
      pos[k * 3] = u;
      pos[k * 3 + 1] = h - SINK;
      pos[k * 3 + 2] = -v;
    }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (Math.max(s[a], s[b], s[c], s[d]) < -1.5) continue; // inside the valley
      // Alternate the diagonal for a less regular look. Winding faces +Y (local z = -v).
      if ((i + j) % 2 === 0) idx.push(a, b, d, a, d, c);
      else idx.push(a, b, c, b, d, c);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const PARS = /* glsl */ `
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform vec3 uMeadow;
uniform vec3 uPine;
uniform vec3 uRock;
uniform vec3 uSnow;
varying vec3 vWorld;
${NOISE}
`;

// The stream runs through the hills in a gorge; the channel itself is cut out like the ground.
const CUT = /* glsl */ `
#include <clipping_planes_fragment>
{
  vec2 cp = vec2(0.70710678 * (vWorld.x + vWorld.z), 0.70710678 * (vWorld.x - vWorld.z));
  float ce = texture2D(uMask, (cp - uMaskRect.xy) * uMaskRect.zw).r * ${STREAM_ENC.range.toFixed(1)} - ${STREAM_ENC.offset.toFixed(1)};
  if (ce < 0.9 && vWorld.y < 3.0) discard;
}
`;

const COLOR = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 wN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  float slope = 1.0 - wN.y;
  float h = vWorld.y;
  vec2 p = vec2(0.70710678 * (vWorld.x + vWorld.z), 0.70710678 * (vWorld.x - vWorld.z));
  float n = vw_fbm(p * 0.03);
  float n2 = vw_noise(p * 0.11);
  vec3 meadow = uMeadow * (0.92 + 0.16 * n2);
  vec3 forest = mix(uPine, uMeadow * 0.72, 0.3 + 0.35 * n);
  vec3 col = mix(meadow, forest, smoothstep(0.6, 4.0, h + (n - 0.5) * 4.0) * 0.92);
  float sector = smoothstep(0.6, 0.7, vw_noise(p * 0.013 + 4.0));
  float terr = sector * (1.0 - smoothstep(0.16, 0.36, slope)) * smoothstep(0.7, 1.5, h) * (1.0 - smoothstep(9.0, 13.0, h));
  vec3 crop = mix(vec3(0.46, 0.5, 0.15), vec3(0.3, 0.45, 0.13), step(0.5, fract(h / 2.6 + n * 0.3)));
  col = mix(col, mix(crop, crop * 0.62, smoothstep(0.86, 0.94, fract(h / 1.3))), terr);
  float rockT = smoothstep(0.42, 0.62, slope + (n2 - 0.5) * 0.22) * 0.85 + smoothstep(21.0, 31.0, h + (n - 0.5) * 9.0);
  col = mix(col, uRock * (0.82 + 0.28 * n2), clamp(rockT, 0.0, 1.0));
  float snowT = smoothstep(32.0, 35.0, h + (n - 0.5) * 12.0) * (1.0 - smoothstep(0.55, 0.78, slope));
  col = mix(col, uSnow * (0.94 + 0.06 * n2), snowT);
  diffuseColor.rgb = col;
}
`;

function makeMaterial(mask: DataTexture) {
  const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, flatShading: true });
  const uniforms = {
    uMask: { value: mask },
    uMaskRect: { value: new Vector4(...MASK_RECT) },
    uMeadow: { value: new Color(COLORS.groundEdge) },
    uPine: { value: new Color(COLORS.pine) },
    uRock: { value: new Color(COLORS.rock) },
    uSnow: { value: new Color(COLORS.snow) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorld;\n${SCREEN}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <clipping_planes_fragment>', CUT)
      .replace('#include <normal_fragment_maps>', COLOR);
  };
  m.customProgramCacheKey = () => 'valley-hills-v1';
  return m;
}

export function Hills({ mask }: { mask: DataTexture }) {
  const geometry = useMemo(buildGeometry, []);
  const material = useMemo(() => makeMaterial(mask), [mask]);
  return <mesh name="valley-hills" geometry={geometry} material={material} receiveShadow />;
}
