import type { Object3D } from 'three';

// Per-frame car telemetry, written by the vehicle after every physics step. Plain mutable object:
// read it inside useFrame / requestAnimationFrame, never subscribe React state to it.

export type CarState = {
  ready: boolean; // the chassis exists
  x: number;
  y: number;
  z: number;
  u: number; // screen-space position (see config/world.ts)
  v: number;
  yaw: number; // radians, chassis +X heading (0 = world +X, + = counter-clockwise from above)
  speed: number; // m/s, signed: negative when reversing
  vx: number; // world velocity
  vy: number;
  vz: number;
  tilt: number; // degrees between chassis up and world up
  contacts: number; // wheels touching the ground
  steer: number; // front wheel angle, radians
  throttle: number; // -1..1 as applied this step
  braking: boolean;
  boosting: boolean;
  airborne: boolean; // no wheel in contact
  steps: number; // physics steps since the controller was created
  controllers: number; // live vehicle controllers in the world; must stay 1 under StrictMode
  controllersCreated: number;
};

export const car: CarState = {
  ready: false,
  x: 0, y: 0, z: 0, u: 0, v: 0, yaw: 0, speed: 0, vx: 0, vy: 0, vz: 0,
  tilt: 0, contacts: 0, steer: 0, throttle: 0, braking: false, boosting: false, airborne: false,
  steps: 0, controllers: 0, controllersCreated: 0,
};

declare global {
  interface Window {
    __car?: CarState;
    __ready?: boolean;
  }
}

if (typeof window !== 'undefined') window.__car = car;

// Horizontal distance from the car to a world point.
export function carDistanceTo(x: number, z: number): number {
  return Math.hypot(car.x - x, car.z - z);
}

// The car's visual group (interpolated between physics steps). Cameras and lights follow this.
export const carObject: { current: Object3D | null } = { current: null };
