import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import type { Camera, PerspectiveCamera } from 'three';
import { CAMERA, screenToWorld } from '../config/world.ts';
import { car, carObject } from '../state/car.ts';
import { events } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import type { CameraOverride } from '../state/store.ts';
import { DRIVE } from '../vehicle/tuning.ts';

const DEG = MathUtils.DEG2RAD;

// Bruno-style camera: fixed azimuth and elevation that never rotate with the car. Zones can ask
// for a different framing with useStore.setCameraOverride; the rig eases in and out of it.
const FOLLOW_RATE = 5; // 1/s, exponential smoothing of the look-at point
const FOLLOW_RATE_Y = 2.5; // softer vertically, so hops and bumps do not shake the view
const ZOOM_RATE = 8; // 1/s
const LOOK_AHEAD_S = 0.35; // seconds of velocity added to the look-at point
const LOOK_AHEAD_MAX = 6; // m
const INTRO_SECONDS = 2.8;
const SPEED_ZOOM = 0.25; // extra distance at boost top speed
const SPEED_ZOOM_IN = 1.2; // 1/s while speeding up
const SPEED_ZOOM_OUT = 0.7; // 1/s while slowing down
const MAX_TOTAL_DISTANCE = 95; // m, keeps the car out of distant fog when zoomed out on tall screens
const DEFAULT_BLEND = 1; // s
const CUT_DISTANCE = 60; // m: framing changes farther apart than this cut instead of gliding

// Tall screens (aspect below 1) widen the vertical FOV up to PORTRAIT_FOV and step back only as
// far as it takes to keep the ground width at the car at aspect^0.3 of a square screen's: about
// 18.5 m across a 390x844 phone at the default zoom (43 m away), so the car stays a fifth of the
// screen wide.
const PORTRAIT_FOV = 50;
const PORTRAIT_WIDTH_EXP = 0.3;
const TAN_BASE = Math.tan((CAMERA.fov * DEG) / 2);

// fov: vertical FOV; follow: distance multiplier for the follow camera and override distances.
type Framing = { fov: number; follow: number };
function framing(aspect: number, out: Framing): Framing {
  const a = MathUtils.clamp(aspect, 0.35, 1);
  out.fov = CAMERA.fov + (PORTRAIT_FOV - CAMERA.fov) * Math.min(1, (1 - a) / 0.55);
  out.follow = (a ** (PORTRAIT_WIDTH_EXP - 1) * TAN_BASE) / Math.tan((out.fov * DEG) / 2);
  return out;
}

// Establishing shot behind the start card: a low, wide look from the car at the start, up the
// career road and its gates to the far hills, with a band of sky. The look-at point floats 28 m
// above the hub, which puts the camera about 60 m up near the south edge of the valley and keeps
// the glide down to the car short.
const [IDLE_X, IDLE_Z] = screenToWorld(-6, 10);
const IDLE = { x: IDLE_X, y: 28, z: IDLE_Z, azimuth: 36 * DEG, elevation: 20 * DEG, distance: 100, fov: 44 };

type Pose = { x: number; y: number; z: number; distance: number; azimuth: number; elevation: number };
const pose = (): Pose => ({ x: 0, y: 0, z: 0, distance: CAMERA.distance, azimuth: CAMERA.azimuth, elevation: CAMERA.elevation });
const copyPose = (out: Pose, p: Pose) => Object.assign(out, p);

// Slow sway while the card is up; t = 0 holds still (reduced motion).
function idlePose(t: number, out: Pose): Pose {
  out.x = IDLE.x + Math.sin(t * 0.07) * 3;
  out.y = IDLE.y;
  out.z = IDLE.z + Math.cos(t * 0.05) * 3;
  out.distance = IDLE.distance;
  out.azimuth = IDLE.azimuth + Math.sin(t * 0.09) * 2.5 * DEG;
  out.elevation = IDLE.elevation;
  return out;
}

function lerpAngle(a: number, b: number, k: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

function lerpPose(out: Pose, a: Pose, b: Pose, k: number) {
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.z = a.z + (b.z - a.z) * k;
  // Distance blends in log space so a zoom from 100 m to 32 m feels even.
  out.distance = Math.exp(Math.log(a.distance) + (Math.log(b.distance) - Math.log(a.distance)) * k);
  out.azimuth = lerpAngle(a.azimuth, b.azimuth, k);
  out.elevation = a.elevation + (b.elevation - a.elevation) * k;
  return out;
}

const _dir = new Vector3();
function applyPose(camera: Camera, p: Pose) {
  const ce = Math.cos(p.elevation);
  _dir.set(-Math.sin(p.azimuth) * ce, Math.sin(p.elevation), Math.cos(p.azimuth) * ce);
  camera.position.set(p.x, p.y, p.z).addScaledVector(_dir, p.distance);
  camera.lookAt(p.x, p.y, p.z);
}

// Vertical FOV plus a horizontal lens shift in CSS px (content moves right by `shift`). Only
// touches the projection when something changed.
function setLens(cam: PerspectiveCamera, fov: number, shift: number, w: number, h: number) {
  const shifted = Math.abs(shift) >= 0.5;
  const v = cam.view;
  const same = Math.abs(cam.fov - fov) < 1e-5
    && (shifted ? !!v?.enabled && Math.abs(v.offsetX + shift) < 0.25 && v.fullWidth === w && v.fullHeight === h : !v?.enabled);
  if (same) return;
  cam.fov = fov;
  if (shifted) cam.setViewOffset(w, h, -shift, 0, w, h);
  else if (v?.enabled) cam.clearViewOffset();
  else cam.updateProjectionMatrix();
}

// Lens shift that centres the idle shot on the part of the screen the start card leaves free.
function cardShift(width: number): number {
  const el = typeof document === 'undefined' ? null : document.querySelector('.card-layer .card');
  if (!el) return 0;
  const right = el.getBoundingClientRect().right;
  return width - right > 160 ? right / 2 : 0;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (rate: number, dt: number) => 1 - Math.exp(-dt * rate);

const _car = new Vector3();
const _vel = new Vector3();

type Source = { kind: 'follow' } | { kind: 'override'; o: CameraOverride } | { kind: 'frozen'; pose: Pose };

// Framing asked for by an override. Unset fields fall back to the follow pose `fp`. Override
// distances are landscape distances: tall screens scale them like the follow distance (`portrait`
// is the follow multiplier from framing()).
function overridePose(o: CameraOverride, fp: Pose, portrait: number, out: Pose): Pose {
  out.x = o.target ? o.target[0] : fp.x;
  out.y = o.target ? o.target[1] : fp.y;
  out.z = o.target ? o.target[2] : fp.z;
  out.distance = o.distance !== undefined ? Math.min(o.distance * portrait, MAX_TOTAL_DISTANCE) : fp.distance;
  out.azimuth = o.azimuth ?? CAMERA.azimuth;
  out.elevation = o.elevation ?? CAMERA.elevation;
  return out;
}

// Same owner, new values: a jump (another board, another angle) is blended like a new framing;
// small changes (a target that moves every frame) are followed directly.
function jumped(a: CameraOverride, b: CameraOverride): boolean {
  if (!!a.target !== !!b.target) return true;
  if (a.target && b.target && Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]) > 2) return true;
  if (Math.abs((a.distance ?? 0) - (b.distance ?? 0)) > 1) return true;
  if (Math.abs((a.azimuth ?? CAMERA.azimuth) - (b.azimuth ?? CAMERA.azimuth)) > 0.05) return true;
  return Math.abs((a.elevation ?? CAMERA.elevation) - (b.elevation ?? CAMERA.elevation)) > 0.05;
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
    follow: new Vector3(IDLE.x, 0, IDLE.z),
    lookAhead: new Vector3(),
    last: new Vector3(),
    hasLast: false,
    speedK: 0,
    aspect: 1,
    aspectInit: false,
    framing: { fov: CAMERA.fov, follow: 1 } as Framing,
    fov: IDLE.fov,
    shift: 0,
    shiftGoal: 0,
    shiftInit: false,
    shiftCheck: 0,
    shown: idlePose(0, pose()),
    followPose: pose(),
    goal: pose(),
    from: pose(),
    playing: false,
    intro: null as { t: number; from: Pose; fov: number; shift: number } | null,
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
      // deltaMode 1 = lines, 2 = pages (Firefox). A trackpad pinch arrives as ctrl+wheel with small deltas.
      const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1);
      zoom.current.goal = clampGoal(zoom.current.goal * Math.exp(px * (e.ctrlKey ? 0.01 : 0.0015)));
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

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = st.current;
    const store = useStore.getState();
    const reduced = store.reducedMotion;
    const obj = carObject.current;
    const cam = camera as PerspectiveCamera;
    const { width, height } = state.size;
    s.aspect = s.aspectInit ? s.aspect + ((cam.aspect || 1) - s.aspect) * damp(4, dt) : cam.aspect || 1;
    s.aspectInit = true;
    const fr = framing(s.aspect, s.framing);

    if (store.phase === 'boot' || store.phase === 'ready' || !obj) {
      const now = performance.now();
      if (now >= s.shiftCheck) {
        s.shiftCheck = now + 250;
        s.shiftGoal = cardShift(width);
      }
      s.shift = s.shiftInit ? s.shift + (s.shiftGoal - s.shift) * damp(6, dt) : s.shiftGoal;
      s.shiftInit = true;
      // Slow sway behind the card; still with reduced motion.
      idlePose(reduced ? 0 : now / 1000, s.shown);
      s.fov = Math.max(IDLE.fov, fr.fov + 4);
      applyPose(cam, s.shown);
      setLens(cam, s.fov, s.shift, width, height);
      s.playing = false;
      s.intro = null;
      return;
    }

    obj.getWorldPosition(_car);
    if (store.phase === 'play' && !s.playing) {
      // Entering play (after the intro, or straight from the card with reduced motion): cut.
      s.playing = true;
      s.follow.copy(_car);
      s.lookAhead.set(0, 0, 0);
      s.hasLast = false;
      zoom.current.value = zoom.current.goal;
      s.toId = store.cameraOverride?.id ?? null;
      s.to = store.cameraOverride;
      s.source = { kind: 'follow' };
      s.blendT = 1;
    }

    // Follow point: the car plus a little look-ahead along its ground velocity.
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
    fp.distance = Math.min(z.value * fr.follow * speedMul, MAX_TOTAL_DISTANCE);
    fp.azimuth = CAMERA.azimuth;
    fp.elevation = CAMERA.elevation;

    if (store.phase === 'intro') {
      // Glide from the establishing shot down to the car; the FOV and the lens shift ease out with it.
      if (!s.intro) s.intro = { t: 0, from: { ...s.shown }, fov: s.fov, shift: s.shift };
      const it = s.intro;
      it.t += dt / INTRO_SECONDS;
      s.follow.copy(_car);
      s.lookAhead.set(0, 0, 0);
      fp.x = _car.x;
      fp.y = _car.y;
      fp.z = _car.z;
      const k = easeInOut(Math.min(it.t, 1));
      lerpPose(s.shown, it.from, fp, k);
      s.fov = it.fov + (fr.fov - it.fov) * k;
      s.shift = it.shift * (1 - k);
      applyPose(cam, s.shown);
      setLens(cam, s.fov, s.shift, width, height);
      if (it.t >= 1) {
        s.intro = null;
        store.setPhase('play');
      }
      return;
    }

    // play
    s.fov = fr.fov;
    s.shift = 0;
    setLens(cam, fr.fov, 0, width, height);
    const o = store.cameraOverride;
    const id = o?.id ?? null;

    if (id !== s.toId || (o && s.to && o !== s.to && jumped(o, s.to))) {
      // A new framing was asked for (or the old one cleared). Blend from what is on screen now: a
      // live source if the camera is at rest on one, a frozen copy if a blend was still running.
      const prevBlend = s.to?.blend;
      const sameOwner = id !== null && id === s.toId;
      s.source = s.blendT < 1 || sameOwner ? { kind: 'frozen', pose: { ...s.shown } } : s.to ? { kind: 'override', o: s.to } : { kind: 'follow' };
      s.blendDuration = Math.max(0.05, (o ? o.blend : prevBlend) ?? DEFAULT_BLEND);
      s.blendT = 0;
      s.toId = id;
      s.to = o;
      const goal = o ? overridePose(o, fp, fr.follow, s.goal) : copyPose(s.goal, fp);
      const from = sourcePose(s.source, fp, fr.follow, s.from);
      if (reduced || performance.now() < s.cutUntil || Math.hypot(goal.x - from.x, goal.z - from.z) > CUT_DISTANCE) s.blendT = 1;
    } else if (o) {
      s.to = o; // same owner, maybe a moved target: keep blending towards the fresh values
    }

    const goal = s.to ? overridePose(s.to, fp, fr.follow, s.goal) : copyPose(s.goal, fp);
    if (s.blendT < 1) {
      s.blendT = Math.min(1, s.blendT + dt / s.blendDuration);
      lerpPose(s.shown, sourcePose(s.source, fp, fr.follow, s.from), goal, easeInOut(s.blendT));
    } else {
      copyPose(s.shown, goal);
    }
    applyPose(cam, s.shown);
  });

  return null;
}
