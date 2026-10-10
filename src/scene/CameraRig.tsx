import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import type { Camera, PerspectiveCamera } from 'three';
import { SPAWN } from '../config/layout.ts';
import { CAMERA, screenToWorld } from '../config/world.ts';
import { car, carObject } from '../state/car.ts';
import { events } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import type { CameraOverride } from '../state/store.ts';
import { DRIVE } from '../vehicle/tuning.ts';

// Bruno-style camera: fixed azimuth and elevation that never rotate with the car. Zones can ask
// for a different framing with useStore.setCameraOverride; the rig eases in and out of it.
const FOLLOW_RATE = 5; // 1/s, exponential smoothing of the look-at point
const FOLLOW_RATE_Y = 2.5; // softer vertically, so hops and bumps do not shake the view
const ZOOM_RATE = 8; // 1/s
const LOOK_AHEAD_S = 0.35; // seconds of velocity added to the look-at point
const LOOK_AHEAD_MAX = 6; // m
const INTRO_SECONDS = 2.6;
const SPEED_ZOOM = 0.25; // extra distance at boost top speed
const SPEED_ZOOM_IN = 1.2; // 1/s while speeding up
const SPEED_ZOOM_OUT = 0.7; // 1/s while slowing down
const PORTRAIT_EXP = 0.8; // distance x aspect^-0.8 below aspect 1 (x1.86 on a 390x844 phone)
const PORTRAIT_MAX = 2.2;
const MAX_TOTAL_DISTANCE = 95; // m, keeps the car out of distant fog on tall screens
const DEFAULT_BLEND = 1; // s
const CUT_DISTANCE = 60; // m: framing changes farther apart than this cut instead of gliding

// Establishing shot shown behind the HTML card, before Start.
const [HUB_X, HUB_Z] = screenToWorld(SPAWN.u, SPAWN.v + 26);
const IDLE = { azimuth: CAMERA.azimuth, elevation: 38 * MathUtils.DEG2RAD, distance: 70 };

type Pose = { x: number; y: number; z: number; distance: number; azimuth: number; elevation: number };
const pose = (): Pose => ({ x: 0, y: 0, z: 0, distance: CAMERA.distance, azimuth: CAMERA.azimuth, elevation: CAMERA.elevation });
const copyPose = (out: Pose, p: Pose) => Object.assign(out, p);

function lerpAngle(a: number, b: number, k: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

function lerpPose(out: Pose, a: Pose, b: Pose, k: number) {
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.z = a.z + (b.z - a.z) * k;
  // Distance blends in log space so a zoom from 70 m to 24 m feels even.
  out.distance = Math.exp(Math.log(a.distance) + (Math.log(b.distance) - Math.log(a.distance)) * k);
  out.azimuth = lerpAngle(a.azimuth, b.azimuth, k);
  out.elevation = a.elevation + (b.elevation - a.elevation) * k;
  return out;
}

const _dir = new Vector3();
function applyPose(camera: Camera, p: Pose) {
  const ce = Math.cos(p.elevation);
  _dir.set(-Math.sin(p.azimuth) * ce, Math.sin(p.elevation), Math.cos(p.azimuth) * ce);
  camera.position.set(p.x, p.y, p.z).addScaledVector(_dir, Math.min(p.distance, MAX_TOTAL_DISTANCE));
  camera.lookAt(p.x, p.y, p.z);
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (rate: number, dt: number) => 1 - Math.exp(-dt * rate);

const _car = new Vector3();
const _vel = new Vector3();

type Source = { kind: 'follow' } | { kind: 'override'; o: CameraOverride } | { kind: 'frozen'; pose: Pose };

// Framing asked for by an override. Unset fields fall back to the follow pose `fp`; override
// distances are scaled for tall screens like the follow distance.
function overridePose(o: CameraOverride, fp: Pose, portrait: number, out: Pose): Pose {
  out.x = o.target ? o.target[0] : fp.x;
  out.y = o.target ? o.target[1] : fp.y;
  out.z = o.target ? o.target[2] : fp.z;
  out.distance = o.distance !== undefined ? o.distance * portrait : fp.distance;
  out.azimuth = o.azimuth ?? CAMERA.azimuth;
  out.elevation = o.elevation ?? CAMERA.elevation;
  return out;
}

function sourcePose(src: Source, fp: Pose, portrait: number, out: Pose): Pose {
  if (src.kind === 'follow') return copyPose(out, fp);
  if (src.kind === 'override') return overridePose(src.o, fp, portrait, out);
  return copyPose(out, src.pose);
}

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const zoom = useRef({ goal: CAMERA.distance, value: CAMERA.distance });
  const st = useRef({
    follow: new Vector3(HUB_X, 0, HUB_Z),
    lookAhead: new Vector3(),
    last: new Vector3(),
    hasLast: false,
    speedK: 0,
    portrait: 1,
    portraitInit: false,
    shown: { ...pose(), x: HUB_X, z: HUB_Z, distance: IDLE.distance, elevation: IDLE.elevation },
    followPose: pose(),
    goal: pose(),
    from: pose(),
    playing: false,
    intro: null as { t: number; from: Pose } | null,
    // Override blending
    toId: null as string | null,
    to: null as CameraOverride | null,
    source: { kind: 'follow' } as Source,
    blendT: 1,
    blendDuration: DEFAULT_BLEND,
    cutUntil: 0,
    pinStep: -1, // after a teleport: hold the focus on the new spot until the next physics step
  });

  // Mouse wheel and two-finger pinch zoom (play only). touch-action: none stops the browser from
  // zooming the page under the pinch.
  useEffect(() => {
    const clampGoal = (g: number) => MathUtils.clamp(g, CAMERA.minDistance, CAMERA.maxDistance);
    const playing = () => useStore.getState().phase === 'play';
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!playing()) return;
      zoom.current.goal = clampGoal(zoom.current.goal * Math.exp(e.deltaY * 0.0015));
    };
    let pinch: { d0: number; g0: number } | null = null;
    const spread = (e: TouchEvent) => {
      const a = e.targetTouches[0];
      const b = e.targetTouches[1];
      return Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY));
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.targetTouches.length === 2) pinch = { d0: spread(e), g0: zoom.current.goal };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.targetTouches.length !== 2) return;
      e.preventDefault();
      if (playing()) zoom.current.goal = clampGoal((pinch.g0 * pinch.d0) / spread(e));
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.targetTouches.length < 2) pinch = null;
    };
    const onGesture = (e: Event) => e.preventDefault(); // iOS Safari page zoom
    const prevTouchAction = dom.style.touchAction;
    dom.style.touchAction = 'none';
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    dom.addEventListener('touchmove', onTouchMove, { passive: false });
    dom.addEventListener('touchend', onTouchEnd);
    dom.addEventListener('touchcancel', onTouchEnd);
    dom.addEventListener('gesturestart', onGesture);
    return () => {
      dom.style.touchAction = prevTouchAction;
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('touchcancel', onTouchEnd);
      dom.removeEventListener('gesturestart', onGesture);
    };
  }, [dom]);

  // After a teleport or reset, jump straight to the car instead of flying across the map. The
  // car's visual group only moves on the next physics step, so pin the focus to the new spot.
  useEffect(() => events.on('teleported', ({ x, z }) => {
    const s = st.current;
    s.follow.x = x;
    s.follow.z = z;
    s.lookAhead.set(0, 0, 0);
    s.hasLast = false;
    s.speedK = 0;
    s.blendT = 1;
    s.cutUntil = performance.now() + 600;
    s.pinStep = car.steps;
  }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = st.current;
    const store = useStore.getState();
    const reduced = store.reducedMotion;
    const obj = carObject.current;
    const aspect = (camera as PerspectiveCamera).aspect || 1;
    const portraitGoal = aspect < 1 ? Math.min(PORTRAIT_MAX, aspect ** -PORTRAIT_EXP) : 1;
    s.portrait = s.portraitInit ? s.portrait + (portraitGoal - s.portrait) * damp(4, dt) : portraitGoal;
    s.portraitInit = true;

    if (store.phase === 'boot' || store.phase === 'ready' || !obj) {
      // Slow drift over the hub while the card is up (still with reduced motion).
      const t = reduced ? 0 : performance.now() / 1000;
      const p = s.shown;
      p.x = HUB_X + Math.sin(t * 0.08) * 6;
      p.y = 0;
      p.z = HUB_Z + Math.cos(t * 0.06) * 4;
      p.distance = IDLE.distance * s.portrait ** 0.6;
      p.azimuth = IDLE.azimuth;
      p.elevation = IDLE.elevation;
      applyPose(camera, p);
      s.playing = false;
      s.intro = null;
      return;
    }

    // Follow point: the car plus a little look-ahead along its ground velocity.
    obj.getWorldPosition(_car);
    const pinned = s.pinStep >= 0 && car.steps === s.pinStep;
    if (!pinned) s.pinStep = -1;
    if (!s.hasLast || pinned) {
      s.last.copy(_car);
      s.hasLast = !pinned;
    }
    if (dt > 0 && !pinned) {
      _vel.subVectors(_car, s.last).divideScalar(dt);
      _vel.y = 0;
      _vel.multiplyScalar(LOOK_AHEAD_S).clampLength(0, LOOK_AHEAD_MAX);
      s.lookAhead.lerp(_vel, damp(2, dt));
    }
    s.last.copy(_car);
    if (!pinned) {
      const kf = damp(FOLLOW_RATE, dt);
      s.follow.x += (_car.x + s.lookAhead.x - s.follow.x) * kf;
      s.follow.z += (_car.z + s.lookAhead.z - s.follow.z) * kf;
      s.follow.y += (_car.y - s.follow.y) * damp(FOLLOW_RATE_Y, dt);
    }

    const z = zoom.current;
    z.value += (z.goal - z.value) * damp(ZOOM_RATE, dt);
    const speedGoal = reduced ? 0 : smoothstep(Math.min(Math.abs(car.speed) / DRIVE.boostMaxSpeed, 1));
    s.speedK += (speedGoal - s.speedK) * damp(speedGoal > s.speedK ? SPEED_ZOOM_IN : SPEED_ZOOM_OUT, dt);
    const speedMul = 1 + SPEED_ZOOM * s.speedK;

    const fp = s.followPose;
    fp.x = s.follow.x;
    fp.y = s.follow.y;
    fp.z = s.follow.z;
    fp.distance = z.value * s.portrait * speedMul;
    fp.azimuth = CAMERA.azimuth;
    fp.elevation = CAMERA.elevation;

    if (store.phase === 'intro') {
      // Glide from the establishing shot down to the car.
      if (!s.intro) s.intro = { t: 0, from: { ...s.shown } };
      const it = s.intro;
      it.t += dt / INTRO_SECONDS;
      s.follow.copy(_car);
      s.lookAhead.set(0, 0, 0);
      fp.x = _car.x;
      fp.y = _car.y;
      fp.z = _car.z;
      lerpPose(s.shown, it.from, fp, smoothstep(Math.min(it.t, 1)));
      applyPose(camera, s.shown);
      if (it.t >= 1) {
        s.intro = null;
        store.setPhase('play');
      }
      return;
    }

    // play
    const o = store.cameraOverride;
    const id = o?.id ?? null;
    if (!s.playing) {
      // Entering play (after the intro, or straight from the card with reduced motion): cut.
      s.playing = true;
      s.follow.copy(_car);
      s.lookAhead.set(0, 0, 0);
      z.value = z.goal;
      s.toId = id;
      s.to = o;
      s.source = { kind: 'follow' };
      s.blendT = 1;
    }

    if (id !== s.toId) {
      // A new framing was asked for (or the old one cleared). Blend from what is on screen now: a
      // live source if the camera is at rest on one, a frozen copy if a blend was still running.
      const prevBlend = s.to?.blend;
      s.source = s.blendT < 1 ? { kind: 'frozen', pose: { ...s.shown } } : s.to ? { kind: 'override', o: s.to } : { kind: 'follow' };
      s.blendDuration = Math.max(0.05, (o ? o.blend : prevBlend) ?? DEFAULT_BLEND);
      s.blendT = 0;
      s.toId = id;
      s.to = o;
      const goal = o ? overridePose(o, fp, s.portrait, s.goal) : copyPose(s.goal, fp);
      const from = sourcePose(s.source, fp, s.portrait, s.from);
      if (reduced || performance.now() < s.cutUntil || Math.hypot(goal.x - from.x, goal.z - from.z) > CUT_DISTANCE) s.blendT = 1;
    } else if (o) {
      s.to = o; // same owner, maybe a moved target: keep blending towards the fresh values
    }

    const goal = s.to ? overridePose(s.to, fp, s.portrait, s.goal) : copyPose(s.goal, fp);
    if (s.blendT < 1) {
      s.blendT = Math.min(1, s.blendT + dt / s.blendDuration);
      lerpPose(s.shown, sourcePose(s.source, fp, s.portrait, s.from), goal, easeInOut(s.blendT));
    } else {
      copyPose(s.shown, goal);
    }
    applyPose(camera, s.shown);
  });

  return null;
}
