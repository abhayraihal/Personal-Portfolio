import type { MeshStandardMaterial } from 'three';
import { env } from '../../world/env.ts';

// Adds a share of the surface colour (troika glyph colours included) as emission, scaled by how far
// into the night the sky has eased, so road paint and labels still read by moonlight.
export function glowAtNight<M extends MeshStandardMaterial>(material: M, amount: number): M {
  const uniform = {} as { value: number };
  Object.defineProperty(uniform, 'value', { get: () => env.night.value * amount });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNightGlow = uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNightGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uNightGlow;');
  };
  material.customProgramCacheKey = () => 'hub-night-glow';
  return material;
}
