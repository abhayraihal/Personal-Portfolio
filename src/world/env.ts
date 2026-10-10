// Shared, per-frame environment values. Shaders hold references to these uniform objects, so
// updating .value once per frame (in <EnvDriver>) animates every material without React renders.
import { Color, Vector3 } from 'three';
import { COLORS } from '../config/palette.ts';

export const env = {
  time: { value: 0 }, // seconds, frozen with reduced motion
  night: { value: 0 }, // 0 day .. 1 night, eased
  motion: { value: 1 }, // 1 normally, 0.25 with reduced motion (wind, flags, water speed)
  car: { value: new Vector3() }, // world position of the car body, for see-through trees
  cam: { value: new Vector3(0, 50, 50) },
  // Elevation of the top edge of the view above the horizon (radians). Below zero the frame holds
  // no sky, so the sky, stars and far peaks skip their draw calls.
  topEdge: { value: -0.4 },
};

// Day and night looks. Fog and background match so the far ground fades into the sky.
export const LOOK = {
  day: {
    fog: new Color('#cfe3dd'),
    skyLow: new Color('#bfe0ee'), // sky gradient above the fog-coloured horizon
    skyTop: new Color('#93c6e6'),
    hemiSky: new Color('#d6eaff'),
    hemiGround: new Color('#8e9866'),
    hemi: 1.2,
    sun: new Color('#fff3dc'),
    sunI: 2.3,
  },
  night: {
    fog: new Color('#14223f'),
    skyLow: new Color('#0f1b3a'),
    skyTop: new Color('#070e24'),
    hemiSky: new Color('#5470b8'),
    hemiGround: new Color('#1d2640'),
    hemi: 0.78,
    sun: new Color('#a8bcff'),
    sunI: 0.7,
  },
};

// Towards the sun (and the moon at night): over the camera's left shoulder, 46 deg up.
export const SUN_DIR = new Vector3(-23.3, 24.5, -3.1).normalize();

export const LAMP_COLOR = new Color('#ffc977');
export const WATER = { light: new Color('#6fd0cf'), mid: new Color(COLORS.water), deep: new Color(COLORS.waterDeep) };
