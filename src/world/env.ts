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
};

// Day and night looks. Fog and background match so the far ground fades into the sky.
export const LOOK = {
  day: {
    fog: new Color('#cfe3dd'),
    hemiSky: new Color('#d6eaff'),
    hemiGround: new Color('#8e9866'),
    hemi: 1.2,
    sun: new Color('#fff3dc'),
    sunI: 2.3,
  },
  night: {
    fog: new Color('#14223f'),
    hemiSky: new Color('#5470b8'),
    hemiGround: new Color('#1d2640'),
    hemi: 0.78,
    sun: new Color('#a8bcff'),
    sunI: 0.7,
  },
};

export const LAMP_COLOR = new Color('#ffc977');
export const WATER = { light: new Color('#6fd0cf'), mid: new Color(COLORS.water), deep: new Color(COLORS.waterDeep) };
