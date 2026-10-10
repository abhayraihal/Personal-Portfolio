import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4, Vector3 } from 'three';
import type { DirectionalLight } from 'three';
import { COLORS } from '../config/palette.ts';
import { carObject } from '../state/car.ts';
import { useStore } from '../state/store.ts';

// The shadow frustum follows the car and is snapped to whole shadow-map texels in light space.
// Keep the sun away from the camera direction or shadows hide behind their casters.
const OFFSET = new Vector3(-5, 26, -20);
const SHADOW_HALF = 30;
const LIGHT_BASIS = new Matrix4().lookAt(OFFSET, new Vector3(), new Vector3(0, 1, 0));
const LIGHT_BASIS_INV = LIGHT_BASIS.clone().invert();
const _p = new Vector3();

export function SunLight() {
  const light = useRef<DirectionalLight>(null);
  const quality = useStore((s) => s.quality);
  const size = quality === 'low' ? 1024 : 2048;
  const texel = (2 * SHADOW_HALF) / size;
  useFrame(() => {
    const l = light.current;
    const obj = carObject.current;
    if (!l || !obj) return;
    obj.getWorldPosition(_p).applyMatrix4(LIGHT_BASIS_INV);
    _p.x = Math.round(_p.x / texel) * texel;
    _p.y = Math.round(_p.y / texel) * texel;
    _p.applyMatrix4(LIGHT_BASIS);
    l.target.position.copy(_p);
    l.target.updateMatrixWorld();
    l.position.copy(_p).add(OFFSET);
  });
  return (
    <directionalLight
      key={size}
      ref={light}
      position={OFFSET.toArray()}
      intensity={2.6}
      color={COLORS.sun}
      castShadow
      shadow-mapSize={[size, size]}
      shadow-camera-left={-SHADOW_HALF}
      shadow-camera-right={SHADOW_HALF}
      shadow-camera-top={SHADOW_HALF}
      shadow-camera-bottom={-SHADOW_HALF}
      shadow-camera-near={1}
      shadow-camera-far={110}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    />
  );
}
