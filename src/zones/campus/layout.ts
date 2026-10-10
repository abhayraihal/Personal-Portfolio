import { toZoneLocal } from '../../config/layout.ts';
import type { P2 } from './geometry.ts';
import { roundedRect, resample, smoothPath } from './geometry.ts';

// Campus layout in the zone frame: x = screen right, z = towards the camera (screen down).
// Zone circle radius 30. Tall things sit at the back (negative z).

// Where the hub's dirt road ends (screen (-38, -34)) and the direction it travels in.
export const ROAD_END = toZoneLocal('campus', -38, -34) as P2; // (20, -16)
const ROAD_DIR: P2 = [-0.7526, 0.6585];

// The campus loop road around the central lawn.
export const LOOP = { cx: 0, cz: 0, hx: 12.5, hz: 9.5, r: 7.5, width: 5.5 };
export const LOOP_PATH = resample(roundedRect(LOOP.cx, LOOP.cz, LOOP.hx, LOOP.hz, LOOP.r, 14), 0.6, true);

// The hub road continues into the loop's top-right corner, meeting it at right angles.
export const JUNCTION: P2 = [LOOP.hx - LOOP.r + LOOP.r * 0.7526, -(LOOP.hz - LOOP.r) - LOOP.r * 0.6585];
export const CONNECTOR: P2[] = [
  [ROAD_END[0] - ROAD_DIR[0] * 2.2, ROAD_END[1] - ROAD_DIR[1] * 2.2],
  JUNCTION,
];

// Coursework lamps on the inner edge of the loop, labels on the lawn.
export const LAMP_RING = resample(roundedRect(LOOP.cx, LOOP.cz, LOOP.hx - 3.4, LOOP.hz - 3.4, LOOP.r - 3.4, 16), 0.25, true);

export const BUILDINGS = {
  main: { x: -1.5, z: -20.6, scale: 0.58 },
  hostel: { x: -15.2, z: -17.6, scale: 0.52 },
};

// The IIT Mandi sign sits beside the hub road so it is in view the moment the car arrives.
export const MONUMENT = { x: 14.2, z: -20.7, width: 8.2 };
export const EDU_PAD: P2 = [14.4, -15.3];
// Photo easel at the entrance, beside the hub road, next to the IIT Mandi sign.
export const EASEL: P2 = [23.4, -10.9];

// ICPR research corner, right of the loop.
export const RESEARCH = {
  board: [22.6, -4.4] as P2,
  field: { cx: 23.1, cz: 3.9, step: 1.55, n: 5, odd: [1, 3] as [number, number] }, // odd = [row, col]
  mast: [27.6, -0.4] as P2,
  status: [19.3, 8.9] as P2,
  pad: [17.7, 1.3] as P2,
};

// Hackathon podium, below the loop.
export const PODIUM = { x: 8.2, z: 21, pad: [8.2, 15.4] as P2 };

// School gate (Delhi), below-left. The pad sits on the far side of the gate.
export const SCHOOL = { x: -8, z: 19, pad: [-8, 23.6] as P2, board: [-1.2, 20.4] as P2 };

// Mountain biking trail: leaves the loop's top-left corner, runs straight down the left edge over
// a tabletop kicker and rejoins the loop at its bottom-left corner.
export const TRAIL_CTRL: P2[] = [
  [-14.4, -5.6], [-18.6, -6.7], [-22.7, -6.3], [-25.3, -3.7], [-25.7, 0.4], [-25.7, 6.2], [-24.9, 10.6],
  [-22.1, 13.9], [-17.6, 15.1], [-13.4, 12.4], [-12.2, 10.2],
];
export const TRAIL = smoothPath(TRAIL_CTRL, 0.5);
export const TRAIL_WIDTH = 4.4;
export const KICKER = { x: -25.7, z: 3.3, width: 3.1, height: 0.62, curve: 2.3 }; // tabletop centre
export const TRAILHEAD = { sign: [-21.6, -10.6] as P2, pad: [-19.4, -6.5] as P2, bike: [-16.4, -9.9] as P2 };
