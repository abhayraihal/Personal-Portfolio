import { useCallback, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CuboidCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import type { CollisionEnterPayload, RapierRigidBody } from '@react-three/rapier';
// Types only. Runtime values (QueryFilterFlags) come from useRapier().rapier, the module instance
// that <Physics> initialised.
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import type { Group } from 'three';
import { SPAWN, ZONE_BY_ID, zoneAt } from '../config/layout.ts';
import type { Respawn } from '../config/layout.ts';
import { screenToWorld, worldToScreen, yawForScreenDir } from '../config/world.ts';
import { car, carActions, carObject } from '../state/car.ts';
import { events, playSound } from '../state/events.ts';
import type { Events } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { CarModel } from './CarModel.tsx';
import type { ControlName } from './controls.ts';
import { exposeVehicleDebug } from './debug.ts';
import { addWheels, applyDrive } from './drive.ts';
import type { DriveInput, DriveState } from './drive.ts';
import { Dust } from './Dust.tsx';
import { REAR_WHEELS, wheelFx } from './fx.ts';
import { CHASSIS, CHASSIS_MASS_PROPERTIES, HORN, IMPACT, MODEL, PHYSICS_DT, RECOVERY, UNSTUCK, WHEEL, WHEELS } from './tuning.ts';

const RAD2DEG = 180 / Math.PI;
const _q = new Quaternion();
const _v = new Vector3();
const _fwd = new Vector3();
const VEL_HISTORY = 4; // pre-step chassis velocities kept for impact strength

type Material = Events['impact']['material'];

function spawnPose(r: Respawn) {
  const [x, z] = screenToWorld(r.u, r.v);
  const yaw = yawForScreenDir(r.du, r.dv);
  return { x, z, yaw };
}

const START = spawnPose(SPAWN);

const yawQuat = (yaw: number, out: Quaternion) => out.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));

// Heading of a tilted chassis: its forward axis on the ground, or its up axis when the nose points
// straight down or up.
function groundHeading(q: Quaternion): number {
  _fwd.set(1, 0, 0).applyQuaternion(q);
  if (Math.hypot(_fwd.x, _fwd.z) < 0.3) _fwd.set(0, 1, 0).applyQuaternion(q).multiplyScalar(Math.sign(_fwd.y) || 1);
  return Math.atan2(-_fwd.z, _fwd.x);
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function Vehicle() {
  const { world, rapier } = useRapier();
  const chassisRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<Group>(null);
  const controllerRef = useRef<DynamicRayCastVehicleController | null>(null);
  const wheelRefs = useRef<(Group | null)[]>([]);
  const drive = useRef<DriveState>({ steer: 0 });
  const input = useRef<DriveInput>({ throttle: 0, steer: 0, brake: false, boost: false });
  const blockedRef = useRef(true);
  const [subscribeKeys, getKeys] = useKeyboardControls<ControlName>();

  // Flip recovery, unstuck hop, airtime and impact bookkeeping. Mutable, never React state.
  const fx = useRef({
    recovering: false,
    recT: 0,
    from: new Vector3(),
    q0: new Quaternion(),
    q1: new Quaternion(),
    tiltFor: 0,
    stuckT: -1, // < 0: not measuring
    perchT: 0,
    stuckX: 0,
    stuckZ: 0,
    airT: 0,
    minVy: 0,
    hornAt: -Infinity,
    impactAt: -Infinity,
    plop: false, // recovery finished: puff and thud when the wheels touch down
    vel: new Float32Array(VEL_HISTORY * 3),
    velIdx: 0,
  });

  // One controller per mounted chassis. StrictMode runs mount -> cleanup -> mount in dev, and
  // <RigidBody> may hand out a new body on the second mount, so read the ref inside the effect.
  useEffect(() => {
    const chassis = chassisRef.current;
    if (!chassis) return;
    const vc = world.createVehicleController(chassis);
    addWheels(vc);
    controllerRef.current = vc;
    car.controllersCreated++;
    car.steps = 0;
    car.ready = true;
    return () => {
      controllerRef.current = null;
      car.ready = false;
      world.removeVehicleController(vc);
    };
  }, [world]);

  useEffect(() => {
    carObject.current = visualRef.current;
    return () => {
      carObject.current = null;
    };
  }, []);

  const clearFx = useCallback(() => {
    const f = fx.current;
    f.recovering = false;
    f.tiltFor = 0;
    f.stuckT = -1;
    f.perchT = 0;
    f.airT = 0;
    f.minVy = 0;
    f.plop = false;
    f.vel.fill(0);
    car.recovering = false;
  }, []);

  // Put the car at a pose, upright and at rest.
  const place = useCallback((x: number, z: number, yaw: number) => {
    const body = chassisRef.current;
    if (!body) return;
    body.setTranslation({ x, y: CHASSIS.spawnHeight, z }, true);
    body.setRotation(yawQuat(yaw, _q), true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    drive.current.steer = 0;
    clearFx();
    events.emit('teleported', { x, z, yaw });
  }, [clearFx]);

  // R: back to the respawn point of the zone the car is in (or the start).
  const reset = useCallback(() => {
    const zone = zoneAt(car.u, car.v);
    const p = spawnPose(zone ? zone.respawn : SPAWN);
    place(p.x, p.z, p.yaw);
  }, [place]);

  const startRecovery = useCallback(() => {
    const body = chassisRef.current;
    if (!body) return;
    const f = fx.current;
    const t = body.translation();
    const r = body.rotation();
    f.from.set(t.x, t.y, t.z);
    f.q0.set(r.x, r.y, r.z, r.w);
    yawQuat(groundHeading(f.q0), f.q1);
    if (f.q0.dot(f.q1) < 0) f.q1.set(-f.q1.x, -f.q1.y, -f.q1.z, -f.q1.w);
    f.recovering = true;
    f.recT = 0;
    f.tiltFor = 0;
    f.stuckT = -1;
    f.perchT = 0;
    f.airT = 0;
    f.minVy = 0;
    car.recovering = true;
    playSound('whoosh', 0.7);
  }, []);

  // Vertical kick, plus an optional push along the chassis and a yaw spin (both in m/s, rad/s).
  const kick = useCallback((up: number, push = 0, spin = 0) => {
    const body = chassisRef.current;
    if (!body) return;
    const r = body.rotation();
    _fwd.set(1, 0, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
    const m = CHASSIS.mass;
    body.applyImpulse({ x: _fwd.x * push * m, y: up * m, z: _fwd.z * push * m }, true);
    if (spin) body.applyTorqueImpulse({ x: 0, y: spin * CHASSIS_MASS_PROPERTIES.principalAngularInertia.y, z: 0 }, true);
  }, []);

  const honk = useCallback(() => {
    const s = useStore.getState();
    if (s.phase !== 'play' || s.panel !== null || s.classicOpen) return;
    const f = fx.current;
    const now = performance.now();
    if (now - f.hornAt < HORN.cooldown * 1000) return;
    f.hornAt = now;
    playSound('horn');
    if (car.contacts > 0 && !f.recovering) kick(HORN.hop);
  }, [kick]);

  useEffect(() => subscribeKeys((s) => s.reset, (pressed) => {
    if (pressed && useStore.getState().phase === 'play') {
      reset();
      playSound('whoosh', 0.6);
    }
  }), [subscribeKeys, reset]);

  useEffect(() => subscribeKeys((s) => s.horn, (pressed) => {
    if (pressed) honk();
  }), [subscribeKeys, honk]);

  useEffect(() => {
    carActions.honk = honk;
    return () => {
      carActions.honk = () => {};
    };
  }, [honk]);

  useEffect(() => useStore.subscribe((s, prev) => {
    if (s.teleportRequest && s.teleportRequest !== prev.teleportRequest) {
      const p = spawnPose(ZONE_BY_ID[s.teleportRequest.zone].respawn);
      place(p.x, p.z, p.yaw);
    }
  }), [place]);

  useEffect(() => exposeVehicleDebug({
    flip: (mode = 'side') => {
      const body = chassisRef.current;
      if (!body) return;
      const t = body.translation();
      yawQuat(car.yaw, _q);
      const roll = new Quaternion().setFromAxisAngle(new Vector3(mode === 'nose' ? 0 : 1, 0, mode === 'nose' ? 1 : 0), mode === 'roof' ? Math.PI : Math.PI * 0.55);
      _q.multiply(roll);
      body.setTranslation({ x: t.x, y: 2.2, z: t.z }, true);
      body.setRotation(_q, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
    honk,
    hop: (speed = HORN.hop) => kick(speed),
    push: (vx, vy, vz) => chassisRef.current?.setLinvel({ x: vx, y: vy, z: vz }, true),
    state: () => {
      const f = fx.current;
      return { recovering: f.recovering, recT: f.recT, tiltFor: f.tiltFor, stuckT: f.stuckT, airT: f.airT, tilt: car.tilt, contacts: car.contacts, y: car.y, speed: car.speed };
    },
    night: (on) => {
      if (useStore.getState().night !== on) useStore.getState().toggleNight();
    },
    camera: (o) => {
      const s = useStore.getState();
      if (o) s.setCameraOverride({ id: 'vehicle-debug', ...o });
      else s.clearCameraOverride('vehicle-debug');
    },
  }), [honk, kick]);

  // Impacts: closing speed along the contact normal, from the chassis velocity just before the
  // steps that produced the contact (events are drained after the frame's steps).
  const onCollisionEnter = useCallback((e: CollisionEnterPayload) => {
    const f = fx.current;
    if (f.recovering) return;
    const now = performance.now();
    if (now - f.impactAt < IMPACT.minGapMs) return;
    const n = e.manifold.normal();
    let closing = 0;
    for (let k = 0; k < VEL_HISTORY; k++) {
      const i = k * 3;
      closing = Math.max(closing, Math.abs(f.vel[i] * n.x + f.vel[i + 1] * n.y + f.vel[i + 2] * n.z));
    }
    const other = e.other.rigidBody;
    if (other && other.isDynamic()) {
      const ov = other.linvel();
      closing = Math.max(closing, Math.abs(ov.x * n.x + ov.y * n.y + ov.z * n.z));
    }
    if (closing < IMPACT.minStrength) return;
    f.impactAt = now;
    const p = e.manifold.numSolverContacts() > 0 ? e.manifold.solverContactPoint(0) : { x: car.x, y: car.y, z: car.z };
    const material = (other?.userData as { material?: Material } | undefined)?.material;
    events.emit('impact', { strength: closing, x: p.x, y: p.y, z: p.z, material });
  }, []);

  // Runs before every world.step(); the controller writes the chassis velocity directly.
  useBeforePhysicsStep(() => {
    const vc = controllerRef.current;
    const body = chassisRef.current;
    if (!vc || !body) return;
    const s = useStore.getState();
    const i = input.current;
    const f = fx.current;
    const blocked = s.phase !== 'play' || s.panel !== null || s.classicOpen;
    blockedRef.current = blocked;
    if (blocked || f.recovering) {
      i.throttle = 0;
      i.steer = 0;
      i.brake = !f.recovering;
      i.boost = false;
    } else {
      const k = getKeys();
      const t = s.touch;
      i.throttle = Math.max(-1, Math.min(1, (k.forward ? 1 : 0) - (k.backward ? 1 : 0) + t.throttle));
      i.steer = Math.max(-1, Math.min(1, (k.left ? 1 : 0) - (k.right ? 1 : 0) + t.steer));
      i.brake = k.brake || t.brake;
      i.boost = k.boost || t.boost;
    }

    if (f.recovering) {
      // Lift, turn upright about the current heading, set down where it was.
      f.recT += PHYSICS_DT;
      const k = Math.min(f.recT / RECOVERY.duration, 1);
      const e = smoothstep(k);
      const y = f.from.y + (RECOVERY.endY - f.from.y) * e + RECOVERY.lift * Math.sin(Math.PI * k);
      _q.slerpQuaternions(f.q0, f.q1, e);
      body.setTranslation({ x: f.from.x, y, z: f.from.z }, true);
      body.setRotation(_q, true);
    }

    applyDrive(vc, i, drive.current, PHYSICS_DT);
    vc.updateVehicle(PHYSICS_DT, rapier.QueryFilterFlags.EXCLUDE_SENSORS);

    if (f.recovering) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      if (f.recT >= RECOVERY.duration) {
        f.recovering = false;
        f.plop = true;
        f.airT = 0;
        f.minVy = 0;
        car.recovering = false;
      }
    }

    const lv = body.linvel();
    const j = f.velIdx * 3;
    f.vel[j] = lv.x;
    f.vel[j + 1] = lv.y;
    f.vel[j + 2] = lv.z;
    f.velIdx = (f.velIdx + 1) % VEL_HISTORY;
  });

  useAfterPhysicsStep((stepWorld) => {
    const vc = controllerRef.current;
    const body = chassisRef.current;
    if (!vc || !body) return;
    const f = fx.current;
    const i = input.current;
    const p = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    _q.set(r.x, r.y, r.z, r.w);
    _v.set(1, 0, 0).applyQuaternion(_q);
    car.yaw = Math.atan2(-_v.z, _v.x);
    _v.set(0, 1, 0).applyQuaternion(_q);
    car.tilt = Math.acos(Math.min(1, Math.max(-1, _v.y))) * RAD2DEG;
    car.x = p.x;
    car.y = p.y;
    car.z = p.z;
    [car.u, car.v] = worldToScreen(p.x, p.z);
    car.vx = lv.x;
    car.vy = lv.y;
    car.vz = lv.z;
    const speed = vc.currentVehicleSpeed();
    car.speed = speed;
    car.steer = drive.current.steer;
    car.throttle = i.throttle;
    car.braking = i.brake;
    car.boosting = i.boost && i.throttle > 0;
    const blocked = blockedRef.current;
    car.brakeLight = !blocked && !f.recovering && (i.brake || i.throttle < -0.02 || (i.throttle > 0.02 && speed < -0.5));
    let contacts = 0;
    for (let w = 0; w < vc.numWheels(); w++) if (vc.wheelIsInContact(w)) contacts++;
    car.contacts = contacts;
    car.airborne = contacts === 0;
    car.controllers = stepWorld.vehicleControllers.size;
    car.steps++;

    // Sideways sliding speed (chassis +Z is right).
    _v.set(0, 0, 1).applyQuaternion(_q);
    car.slip = contacts > 0 ? Math.abs(lv.x * _v.x + lv.y * _v.y + lv.z * _v.z) : 0;

    for (let k = 0; k < 2; k++) {
      const w = REAR_WHEELS[k];
      const hit = vc.wheelIsInContact(w);
      wheelFx.contact[k] = hit;
      if (hit) {
        const cp = vc.wheelContactPoint(w);
        const cn = vc.wheelContactNormal(w);
        if (cp) {
          const out = wheelFx.point[k];
          out[0] = cp.x;
          out[1] = cp.y;
          out[2] = cp.z;
        }
        wheelFx.normalY[k] = cn ? cn.y : 1;
      }
    }

    // Landing after a jump: a thud for the audio and a dust ring.
    if (contacts === 0) {
      f.airT += PHYSICS_DT;
      f.minVy = Math.min(f.minVy, lv.y);
    } else {
      if (f.plop) {
        f.plop = false;
        f.airT = IMPACT.landingAirTime + 1;
        f.minVy = Math.min(f.minVy, -IMPACT.landingMinSpeed - 1);
      }
      if (f.airT > IMPACT.landingAirTime && -f.minVy > IMPACT.landingMinSpeed && !f.recovering) {
        const strength = -f.minVy;
        wheelFx.landing = strength;
        const now = performance.now();
        if (now - f.impactAt >= IMPACT.minGapMs) {
          f.impactAt = now;
          events.emit('impact', { strength: strength * 0.8, x: p.x, y: p.y - 1, z: p.z, material: 'soft' });
        }
      }
      f.airT = 0;
      f.minVy = 0;
    }
    car.airTime = f.airT;

    // Flip recovery: tilted too far for too long.
    if (!f.recovering) {
      f.tiltFor = car.tilt > RECOVERY.tiltDeg ? f.tiltFor + PHYSICS_DT : 0;
      const moving = Math.hypot(lv.x, lv.y, lv.z) > RECOVERY.maxSpeed;
      if (f.tiltFor >= RECOVERY.seconds && (!moving || f.tiltFor >= RECOVERY.forceAfter)) startRecovery();
    }

    // Unstuck: throttle held, the car is upright-ish but has not gone anywhere.
    if (!blocked && !f.recovering && Math.abs(i.throttle) > 0.5 && car.tilt < RECOVERY.tiltDeg) {
      if (f.stuckT < 0) {
        f.stuckT = 0;
        f.stuckX = p.x;
        f.stuckZ = p.z;
      }
      f.stuckT += PHYSICS_DT;
      if (f.stuckT >= UNSTUCK.seconds) {
        if (Math.hypot(p.x - f.stuckX, p.z - f.stuckZ) < UNSTUCK.minProgress) {
          kick(UNSTUCK.hop, -Math.sign(i.throttle) * UNSTUCK.push, (Math.random() < 0.5 ? -1 : 1) * UNSTUCK.spin);
        }
        f.stuckT = 0;
        f.stuckX = p.x;
        f.stuckZ = p.z;
      }
    } else {
      f.stuckT = -1;
    }

    // Perched: no wheel on the ground, nearly still and not tipped over (high-centred on a knocked
    // letter or a rock). Hop it back the way it came instead of waiting for the throttle timer.
    const still = Math.hypot(lv.x, lv.y, lv.z) < UNSTUCK.perchSpeed;
    f.perchT = !blocked && !f.recovering && contacts === 0 && still && car.tilt < RECOVERY.tiltDeg ? f.perchT + PHYSICS_DT : 0;
    if (f.perchT >= UNSTUCK.perchSeconds) {
      f.perchT = 0;
      kick(UNSTUCK.hop, -(Math.sign(i.throttle) || 1) * UNSTUCK.push, (Math.random() < 0.5 ? -1 : 1) * UNSTUCK.spin);
    }

    if (p.y < -20) reset(); // fell off the world
  });

  // Wheel visuals follow the controller: suspension travel, spin and steering, in model space.
  useFrame(() => {
    const vc = controllerRef.current;
    if (!vc) return;
    for (let i = 0; i < WHEELS.length; i++) {
      const g = wheelRefs.current[i];
      if (!g) continue;
      const length = vc.wheelSuspensionLength(i) ?? WHEEL.restLength;
      g.position.y = (WHEELS[i].position.y - length - MODEL.offset.y) / MODEL.scale;
      g.rotation.y = vc.wheelSteering(i) ?? 0;
      g.rotation.x = vc.wheelRotation(i) ?? 0;
    }
  });

  return (
    <>
      <RigidBody
        ref={chassisRef}
        name="car"
        colliders={false}
        position={[START.x, CHASSIS.spawnHeight, START.z]}
        rotation={[0, START.yaw, 0]}
        canSleep={false}
        linearDamping={CHASSIS.linearDamping}
        angularDamping={CHASSIS.angularDamping}
        onCollisionEnter={onCollisionEnter}
      >
        <CuboidCollider args={CHASSIS.halfExtents} massProperties={CHASSIS_MASS_PROPERTIES} friction={CHASSIS.friction} restitution={CHASSIS.restitution} />
        <group ref={visualRef}>
          <CarModel wheelRefs={wheelRefs} />
        </group>
      </RigidBody>
      <Dust />
    </>
  );
}
