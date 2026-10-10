import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import { SPAWN } from '../config/layout.ts';
import { CAMERA, screenToWorld } from '../config/world.ts';
import { carObject } from '../state/car.ts';
import { events } from '../state/events.ts';
import { useStore } from '../state/store.ts';

// Bruno-style camera: fixed azimuth and elevation that never rotate with the car. Zones can ask
// for a different framing with useStore.setCameraOverride (eased in and out).
const FOLLOW_RATE = 5; // 1/s, exponential smoothing of the look-at point
const ZOOM_RATE = 8; // 1/s
const LOOK_AHEAD_S = 0.35; // seconds of velocity added to the look-at point
const LOOK_AHEAD_MAX = 6; // m
const INTRO_SECONDS = 2.6;

// Establishing shot shown behind the HTML card, before Start.
const [HUB_X, HUB_Z] = screenToWorld(SPAWN.u, SPAWN.v + 26);
const IDLE = { azimuth: CAMERA.azimuth, elevation: 38 * MathUtils.DEG2RAD, distance: 70 };

const _target = new Vector3();
const _velocity = new Vector3();
const _dir = new Vector3();

function offsetDir(azimuth: number, elevation: number, out: Vector3) {
  return out.set(-Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const zoom = useRef({ goal: CAMERA.distance, value: IDLE.distance });
  const angles = useRef({ azimuth: IDLE.azimuth, elevation: IDLE.elevation });
  const focus = useRef(new Vector3(HUB_X, 0, HUB_Z));
  const last = useRef<Vector3 | null>(null);
  const lookAhead = useRef(new Vector3());
  const intro = useRef<{ t: number; from: Vector3; fromDist: number; fromEl: number } | null>(null);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const z = zoom.current;
      z.goal = MathUtils.clamp(z.goal * Math.exp(e.deltaY * 0.0015), CAMERA.minDistance, CAMERA.maxDistance);
    };
    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => dom.removeEventListener('wheel', onWheel);
  }, [dom]);

  // After a teleport or reset, jump straight to the car instead of flying across the map.
  useEffect(() => events.on('teleported', () => {
    last.current = null;
    lookAhead.current.set(0, 0, 0);
    if (carObject.current) {
      carObject.current.updateWorldMatrix(true, false);
      carObject.current.getWorldPosition(focus.current);
    }
  }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = useStore.getState();
    const obj = carObject.current;

    if (s.phase === 'boot' || s.phase === 'ready' || !obj) {
      // Slow drift over the hub while the card is up.
      const t = performance.now() / 1000;
      focus.current.set(HUB_X + Math.sin(t * 0.08) * 6, 0, HUB_Z + Math.cos(t * 0.06) * 4);
      offsetDir(IDLE.azimuth, IDLE.elevation, _dir);
      camera.position.copy(focus.current).addScaledVector(_dir, IDLE.distance);
      camera.lookAt(focus.current);
      return;
    }

    obj.getWorldPosition(_target);

    if (s.phase === 'intro') {
      if (!intro.current) intro.current = { t: 0, from: focus.current.clone(), fromDist: zoom.current.value, fromEl: angles.current.elevation };
      const it = intro.current;
      it.t += dt / INTRO_SECONDS;
      const k = smoothstep(Math.min(it.t, 1));
      focus.current.lerpVectors(it.from, _target, k);
      zoom.current.value = MathUtils.lerp(it.fromDist, zoom.current.goal, k);
      angles.current.elevation = MathUtils.lerp(it.fromEl, CAMERA.elevation, k);
      offsetDir(angles.current.azimuth, angles.current.elevation, _dir);
      camera.position.copy(focus.current).addScaledVector(_dir, zoom.current.value);
      camera.lookAt(focus.current);
      if (it.t >= 1) {
        intro.current = null;
        last.current = null;
        useStore.getState().setPhase('play');
      }
      return;
    }

    // play
    if (!last.current) last.current = _target.clone();
    if (dt > 0) {
      _velocity.subVectors(_target, last.current).divideScalar(dt);
      _velocity.y = 0;
      _velocity.multiplyScalar(LOOK_AHEAD_S).clampLength(0, LOOK_AHEAD_MAX);
      lookAhead.current.lerp(_velocity, 1 - Math.exp(-dt * 2));
    }
    last.current.copy(_target);

    const o = s.cameraOverride;
    const blend = 1 - Math.exp(-dt * (o ? 3 / Math.max(o.blend ?? 1, 0.05) : 2.5));
    const goalAz = o?.azimuth ?? CAMERA.azimuth;
    const goalEl = o?.elevation ?? CAMERA.elevation;
    angles.current.azimuth += (goalAz - angles.current.azimuth) * blend;
    angles.current.elevation += (goalEl - angles.current.elevation) * blend;
    if (o?.target) _target.set(o.target[0], o.target[1], o.target[2]);
    else _target.add(lookAhead.current);

    focus.current.lerp(_target, 1 - Math.exp(-dt * FOLLOW_RATE));
    const z = zoom.current;
    const goalDist = o?.distance ?? z.goal;
    z.value += (goalDist - z.value) * (1 - Math.exp(-dt * ZOOM_RATE * (o?.distance ? 0.35 : 1)));
    offsetDir(angles.current.azimuth, angles.current.elevation, _dir);
    camera.position.copy(focus.current).addScaledVector(_dir, z.value);
    camera.lookAt(focus.current);
  });

  return null;
}
