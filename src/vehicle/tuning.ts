// Vehicle tuning shared by <Vehicle> and the headless sim (scripts/sim-vehicle.ts).
// Chassis frame: +X forward, +Y up, +Z right. These are rapier's defaults
// (indexForwardAxis = 0, indexUpAxis = 1), so the controller axes are never changed.

export const PHYSICS_DT = 1 / 60;
export const GRAVITY = 9.81;

export type Vec3 = { x: number; y: number; z: number };

export const CHASSIS = {
  halfExtents: [1.9, 0.6, 1.1] as [number, number, number],
  mass: 150,
  // Pulled down to just above the ground plane so hard cornering slides instead of rolling.
  centerOfMass: { x: 0, y: -0.75, z: 0 } as Vec3,
  linearDamping: 0.05,
  angularDamping: 0.8,
  friction: 0.4,
  restitution: 0.05,
  // Chassis origin sits 1.0 m above the ground at rest; spawn this high and let it settle.
  spawnHeight: 1.4,
};

// Solid-box inertia about the box centre; the centre of mass is moved without the parallel-axis term
// on purpose, which keeps roll and pitch inertia low enough for the car to feel light.
const [HX, HY, HZ] = CHASSIS.halfExtents;
export const CHASSIS_MASS_PROPERTIES = {
  mass: CHASSIS.mass,
  centerOfMass: CHASSIS.centerOfMass,
  principalAngularInertia: {
    x: (CHASSIS.mass / 3) * (HY * HY + HZ * HZ),
    y: (CHASSIS.mass / 3) * (HX * HX + HZ * HZ),
    z: (CHASSIS.mass / 3) * (HX * HX + HY * HY),
  } as Vec3,
  angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
};

export const WHEEL = {
  radius: 0.45,
  restLength: 0.35,
  maxSuspensionTravel: 0.3,
  stiffness: 30,
  compression: 2.4,
  relaxation: 3.2,
  maxSuspensionForce: 100_000,
  frictionSlip: 1.6,
  sideFrictionStiffness: 1,
};

// Wheel centres at rest, in the chassis frame. X and Y line up with the Kenney SUV wheel nodes once
// the model is scaled by MODEL.scale and rotated to face +X. The physics track (+-0.75 m) is about
// 0.11 m wider per side than the visible tyres (+-0.64 m), which buys roll stability.
const AXLE_X = 0.99;
const HALF_TRACK = 0.75;
export const WHEEL_CENTER_Y = -0.55;
// Static sag of a centred load: 4 * stiffness * sag * mass = mass * g.
export const STATIC_SAG = GRAVITY / (4 * WHEEL.stiffness);
const HARDPOINT_Y = WHEEL_CENTER_Y + WHEEL.restLength - STATIC_SAG;

export const WHEELS = [
  { node: 'wheel-front-left', front: true, position: { x: AXLE_X, y: HARDPOINT_Y, z: -HALF_TRACK } },
  { node: 'wheel-front-right', front: true, position: { x: AXLE_X, y: HARDPOINT_Y, z: HALF_TRACK } },
  { node: 'wheel-back-left', front: false, position: { x: -AXLE_X, y: HARDPOINT_Y, z: -HALF_TRACK } },
  { node: 'wheel-back-right', front: false, position: { x: -AXLE_X, y: HARDPOINT_Y, z: HALF_TRACK } },
] as const;

export const SUSPENSION_DIRECTION: Vec3 = { x: 0, y: -1, z: 0 };
export const AXLE: Vec3 = { x: 0, y: 0, z: 1 };

export const DRIVE = {
  engineForce: 340, // N per wheel, all four wheels driven
  boostMultiplier: 1.7,
  reverseMultiplier: 0.6,
  maxSpeed: 16, // m/s
  boostMaxSpeed: 25,
  reverseMaxSpeed: 7,
  brakeImpulse: 5, // N*s per wheel per step; only applied when engine force is 0
  coastBrake: 1.2,
  steerMax: 0.6, // rad, at standstill
  steerMaxAtSpeed: 0.22, // rad, at maxSpeed and above
  steerRate: 3.2, // rad/s towards the target angle
  steerReturnRate: 5, // rad/s back to centre
};

// Kenney car-kit suv.glb (public/models/car-kit/vehicle-jeep-suv.glb): front faces +Z, ground at y = 0, wheel radius 0.3, front axle z = 0.76,
// rear axle z = -0.56. Scale 1.5 gives a 3.8 m long car with 0.45 m wheels.
export const MODEL = {
  url: 'models/car-kit/vehicle-jeep-suv.glb',
  scale: 1.5,
  rotationY: Math.PI / 2, // model +Z -> chassis +X
  // chassis = R(scale * model) + offset; puts the axles at x = +-0.99 and the ground at y = -1.0
  offset: { x: -0.15, y: -1.0, z: 0 } as Vec3,
};
