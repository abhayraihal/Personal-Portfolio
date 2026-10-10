import { MeshStandardMaterial } from 'three';
import type { MeshStandardMaterialParameters } from 'three';

// The camera-side cliff faces away from the sun, so on its own it renders nearly black. These
// materials add a share of their vertex or instance colour as emission so the rank colours still
// read. RidgeLogic lowers selfLight at night.
export const selfLight = { value: 0.32 };

export function selfLitMaterial(params: MeshStandardMaterialParameters, scale = 1): MeshStandardMaterial {
  const m = new MeshStandardMaterial(params);
  const uniform = { value: 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSelfLight = uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSelfLight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance += vColor.rgb * uSelfLight;\n#endif');
  };
  m.customProgramCacheKey = () => 'ridge-self-lit';
  // read every frame through the shared value, so one store subscription updates them all
  Object.defineProperty(uniform, 'value', { get: () => selfLight.value * scale });
  return m;
}
