import { MeshStandardMaterial } from 'three';
import type { MeshStandardMaterialParameters } from 'three';

// The camera-side cliff faces away from the sun, so on its own it renders nearly black. These
// materials add a share of their vertex or instance colour as emission so the rank colours still
// read. RidgeLogic sets `night` from the store.
export const selfLight = { night: false };

// day / night: share of the colour added as emission in each mode.
export function selfLitMaterial(params: MeshStandardMaterialParameters, day: number, night: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial(params);
  const uniform = { value: 0 };
  // read every frame through the shared flag, so one store subscription updates them all
  Object.defineProperty(uniform, 'value', { get: () => (selfLight.night ? night : day) });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSelfLight = uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSelfLight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance += vColor.rgb * uSelfLight;\n#endif');
  };
  m.customProgramCacheKey = () => 'ridge-self-lit';
  return m;
}
