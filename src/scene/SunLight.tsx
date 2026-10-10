import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Matrix4, Vector3 } from 'three';
import type { DirectionalLight } from 'three';
import { SPAWN } from '../config/layout.ts';
import { screenToWorld } from '../config/world.ts';
import { carObject } from '../state/car.ts';
import { useStore } from '../state/store.ts';
import { env, LOOK } from '../world/env.ts';

// Morning sun by day, moonlight at night (same light, eased by env.night). The sun comes from over
// the camera's left shoulder (screen left and slightly towards the camera, 46 deg up), so faces
// turned to the camera are lit and shadows fall up and to the right, clear of their casters.
//
// While driving, the shadow frustum is 60 m across, follows the car and is snapped to whole
// shadow-map texels in light space. Behind the start card it widens to cover the whole idle
// overview, centred where the idle camera looks, and eases back during the intro. Nothing moves
// much behind the card, so that wide shadow map is only re-rendered a few times a second.
const DIR = new Vector3(-23.3, 24.5, -3.1).normalize();
const PLAY_HALF = 30;
const IDLE_HALF = 88;
const LIGHT_BASIS = new Matrix4().lookAt(DIR, new Vector3(), new Vector3(0, 1, 0));
const LIGHT_BASIS_INV = LIGHT_BASIS.clone().invert();
const [IDLE_X, IDLE_Z] = screenToWorld(SPAWN.u, SPAWN.v + 26); // CameraRig's idle focus
const IDLE_FOCUS = new Vector3(IDLE_X, 0, IDLE_Z);
const _p = new Vector3();
const _car = new Vector3();

export function SunLight() {
  const light = useRef<DirectionalLight>(null);
  const wide = useRef(1); // 1 = idle overview frustum, 0 = driving frustum
  const half = useRef({ h: 0, cam: null as unknown });
  const frames = useRef(0);
  const quality = useStore((s) => s.quality);
  const gl = useThree((s) => s.gl);
  const size = quality === 'low' ? 1024 : 2048;
  useFrame((_, delta) => {
    const l = light.current;
    if (!l) return;
    const k = env.night.value;
    l.color.lerpColors(LOOK.day.sun, LOOK.night.sun, k);
    l.intensity = LOOK.day.sunI + (LOOK.night.sunI - LOOK.day.sunI) * k;

    const phase = useStore.getState().phase;
    const idle = phase === 'boot' || phase === 'ready';
    const goal = idle ? 1 : 0;
    frames.current = idle ? frames.current + 1 : 0;
    gl.shadowMap.autoUpdate = !idle;
    if (idle && (frames.current < 60 || frames.current % 60 === 0)) gl.shadowMap.needsUpdate = true;
    const rate = phase === 'intro' ? 1.8 : 8;
    wide.current += (goal - wide.current) * (1 - Math.exp(-Math.min(delta, 0.1) * rate));
    if (Math.abs(goal - wide.current) < 0.001) wide.current = goal;
    const w = wide.current;
    const h = PLAY_HALF + (IDLE_HALF - PLAY_HALF) * w;
    const cam = l.shadow.camera;
    const dist = 34 + (h - PLAY_HALF) * 1.3;
    if (Math.abs(h - half.current.h) > 1e-3 || half.current.cam !== cam) {
      half.current = { h, cam };
      cam.left = -h;
      cam.right = h;
      cam.top = h;
      cam.bottom = -h;
      cam.far = dist + 1.4 * h + 20;
      cam.updateProjectionMatrix();
      l.shadow.normalBias = 0.04 * (h / PLAY_HALF);
      gl.shadowMap.needsUpdate = true;
    }

    const obj = carObject.current;
    if (obj) obj.getWorldPosition(_car);
    else _car.copy(IDLE_FOCUS);
    _p.lerpVectors(_car, IDLE_FOCUS, w).applyMatrix4(LIGHT_BASIS_INV);
    const texel = (2 * h) / size;
    _p.x = Math.round(_p.x / texel) * texel;
    _p.y = Math.round(_p.y / texel) * texel;
    _p.applyMatrix4(LIGHT_BASIS);
    l.target.position.copy(_p);
    l.target.updateMatrixWorld();
    l.position.copy(_p).addScaledVector(DIR, dist);
  });
  return (
    <directionalLight
      key={size}
      ref={light}
      position={DIR.clone().multiplyScalar(34).toArray()}
      intensity={LOOK.day.sunI}
      color={LOOK.day.sun}
      castShadow
      shadow-mapSize={[size, size]}
      shadow-camera-left={-PLAY_HALF}
      shadow-camera-right={PLAY_HALF}
      shadow-camera-top={PLAY_HALF}
      shadow-camera-bottom={-PLAY_HALF}
      shadow-camera-near={1}
      shadow-camera-far={110}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    />
  );
}
