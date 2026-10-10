import { useCallback, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CuboidCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
// Types only. Runtime values (QueryFilterFlags) come from useRapier().rapier, the module instance
// that <Physics> initialised.
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import type { Group } from 'three';
import { SPAWN, ZONE_BY_ID, zoneAt } from '../config/layout.ts';
import type { Respawn } from '../config/layout.ts';
import { screenToWorld, worldToScreen, yawForScreenDir } from '../config/world.ts';
import { car, carObject } from '../state/car.ts';
import { events } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { CarModel } from './CarModel.tsx';
import type { ControlName } from './controls.ts';
import { addWheels, applyDrive } from './drive.ts';
import type { DriveInput, DriveState } from './drive.ts';
import { CHASSIS, CHASSIS_MASS_PROPERTIES, MODEL, PHYSICS_DT, WHEEL, WHEELS } from './tuning.ts';

const RAD2DEG = 180 / Math.PI;
const _q = new Quaternion();
const _v = new Vector3();

function spawnPose(r: Respawn) {
  const [x, z] = screenToWorld(r.u, r.v);
  const yaw = yawForScreenDir(r.du, r.dv);
  return { x, z, yaw };
}

const START = spawnPose(SPAWN);

export function Vehicle() {
  const { world, rapier } = useRapier();
  const chassisRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<Group>(null);
  const controllerRef = useRef<DynamicRayCastVehicleController | null>(null);
  const wheelRefs = useRef<(Group | null)[]>([]);
  const drive = useRef<DriveState>({ steer: 0 });
  const input = useRef<DriveInput>({ throttle: 0, steer: 0, brake: false, boost: false });
  const [subscribeKeys, getKeys] = useKeyboardControls<ControlName>();

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

  // Put the car at a pose, upright and at rest.
  const place = useCallback((x: number, z: number, yaw: number) => {
    const body = chassisRef.current;
    if (!body) return;
    body.setTranslation({ x, y: CHASSIS.spawnHeight, z }, true);
    body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    drive.current.steer = 0;
    events.emit('teleported', { x, z, yaw });
  }, []);

  // R: back to the respawn point of the zone the car is in (or the start).
  const reset = useCallback(() => {
    const zone = zoneAt(car.u, car.v);
    const p = spawnPose(zone ? zone.respawn : SPAWN);
    place(p.x, p.z, p.yaw);
  }, [place]);

  useEffect(() => subscribeKeys((s) => s.reset, (pressed) => {
    if (pressed && useStore.getState().phase === 'play') reset();
  }), [subscribeKeys, reset]);

  useEffect(() => useStore.subscribe((s, prev) => {
    if (s.teleportRequest && s.teleportRequest !== prev.teleportRequest) {
      const p = spawnPose(ZONE_BY_ID[s.teleportRequest.zone].respawn);
      place(p.x, p.z, p.yaw);
    }
  }), [place]);

  // Runs before every world.step(); the controller writes the chassis velocity directly.
  useBeforePhysicsStep(() => {
    const vc = controllerRef.current;
    if (!vc) return;
    const s = useStore.getState();
    const i = input.current;
    const blocked = s.phase !== 'play' || s.panel !== null || s.classicOpen;
    if (blocked) {
      i.throttle = 0;
      i.steer = 0;
      i.brake = true;
      i.boost = false;
    } else {
      const k = getKeys();
      const t = s.touch;
      i.throttle = Math.max(-1, Math.min(1, (k.forward ? 1 : 0) - (k.backward ? 1 : 0) + t.throttle));
      i.steer = Math.max(-1, Math.min(1, (k.left ? 1 : 0) - (k.right ? 1 : 0) + t.steer));
      i.brake = k.brake || t.brake;
      i.boost = k.boost || t.boost;
    }
    applyDrive(vc, i, drive.current, PHYSICS_DT);
    vc.updateVehicle(PHYSICS_DT, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
  });

  useAfterPhysicsStep((stepWorld) => {
    const vc = controllerRef.current;
    const body = chassisRef.current;
    if (!vc || !body) return;
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
    car.speed = vc.currentVehicleSpeed();
    car.steer = drive.current.steer;
    car.throttle = input.current.throttle;
    car.braking = input.current.brake;
    car.boosting = input.current.boost && input.current.throttle > 0;
    let contacts = 0;
    for (let w = 0; w < vc.numWheels(); w++) if (vc.wheelIsInContact(w)) contacts++;
    car.contacts = contacts;
    car.airborne = contacts === 0;
    car.controllers = stepWorld.vehicleControllers.size;
    car.steps++;
    if (p.y < -20) reset(); // fell off the world
  });

  // Wheel visuals follow the controller: suspension travel, spin and steering, in model space.
  useFrame(() => {
    const vc = controllerRef.current;
    if (!vc) return;
    WHEELS.forEach((w, i) => {
      const g = wheelRefs.current[i];
      if (!g) return;
      const length = vc.wheelSuspensionLength(i) ?? WHEEL.restLength;
      g.position.y = (w.position.y - length - MODEL.offset.y) / MODEL.scale;
      g.rotation.y = vc.wheelSteering(i) ?? 0;
      g.rotation.x = vc.wheelRotation(i) ?? 0;
    });
  });

  return (
    <RigidBody
      ref={chassisRef}
      name="car"
      colliders={false}
      position={[START.x, CHASSIS.spawnHeight, START.z]}
      rotation={[0, START.yaw, 0]}
      canSleep={false}
      linearDamping={CHASSIS.linearDamping}
      angularDamping={CHASSIS.angularDamping}
    >
      <CuboidCollider args={CHASSIS.halfExtents} massProperties={CHASSIS_MASS_PROPERTIES} friction={CHASSIS.friction} restitution={CHASSIS.restitution} />
      <group ref={visualRef}>
        <CarModel wheelRefs={wheelRefs} />
      </group>
    </RigidBody>
  );
}
