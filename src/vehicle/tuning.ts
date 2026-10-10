import { COLORS } from '../config/palette.ts';

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

// Paint: the body panels take the site accent (the pink polo in Abhay's photo). The hardtop (roof,
// rear quarters, tailgate) is painted separately; bumpers, flares and grille stay Kenney grey.
// Pink on the hardtop too: from the 45 degree camera the roof is most of what you see.
export const PAINT = {
  panels: COLORS.accent,
  hardtop: COLORS.accent as string | undefined,
  roughness: 0.62,
};

export const LIGHTS = {
  tailColor: '#ff2b3a',
  headColor: '#fff1c2',
  beamColor: '#ffe9b8',
  brakeIntensity: 2.6, // emissive, braking or reversing
  tailNightIntensity: 0.9, // running lights at night
  headIntensity: 2.2,
  tailGlowSize: 0.9, // m, additive halo sprite
  headGlowSize: 1.3,
  // Beam: a pool ahead of the car that stays below white, so road paint and labels in it stay readable.
  spotIntensity: 55, // cd
  spotDistance: 30,
  spotAngle: 0.5, // rad, half angle
  spotPenumbra: 0.8,
  spotDecay: 1.2,
  // Beam origin and aim point in body-model units (x1.5 for metres). Aimed down about 9 degrees, so
  // the pool starts just past the bumper.
  spotFrom: [0, 0.45, 1.3] as [number, number, number],
  spotAim: [0, -0.8, 9] as [number, number, number],
};

// Visual body lean on a spring (the physics chassis does not move): nose up under acceleration,
// down under braking, outwards in turns. Radians per m/s^2, capped at max.
export const LEAN = { pitch: 0.0055, roll: 0.0045, max: 0.07, stiffness: 140, damping: 0.42 };

// Flip recovery: tilted past tiltDeg for `seconds`, the car is lifted and turned upright in place.
export const RECOVERY = {
  tiltDeg: 70,
  seconds: 1.5,
  maxSpeed: 4, // m/s; a car still sliding on its roof gets up to `forceAfter` seconds to stop
  forceAfter: 3,
  duration: 1.0, // s, lift and turn
  lift: 1.3, // m, extra height at the middle of the move
  endY: 1.3, // chassis height when released (rest is 1.0)
};

// Throttle held for `seconds` with less than `minProgress` metres of travel: a small hop. The same
// hop frees a car resting on something with no wheel on the ground for `perchSeconds`.
export const UNSTUCK = { seconds: 2, minProgress: 0.5, hop: 3.0, push: 1.2, spin: 0.9, perchSeconds: 0.7, perchSpeed: 0.8 };

// H key. hop is the vertical speed change in m/s.
export const HORN = { cooldown: 0.6, hop: 2.1 };

// Impact events for audio: closing speed in m/s, at most one event per minGapMs.
export const IMPACT = { minStrength: 1.5, minGapMs: 80, landingMinSpeed: 3, landingAirTime: 0.3 };
