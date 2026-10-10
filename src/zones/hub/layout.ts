import { toZoneLocal } from '../../config/layout.ts';

// Phones and tablets: no keyboard, so the keycaps and key lines are left out.
export const TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

// Hub-local [x, y, z] (see <ZoneFrame>) for a screen-space point (u, v).
export function hubAt(u: number, v: number, y = 0): [number, number, number] {
  const [x, z] = toZoneLocal('hub', u, v);
  return [x, y, z];
}

const HUT = [20.2, 10.4] as const;

// Where everything in the hub sits, in screen space (u right, v up the screen). The car spawns at
// (0, -8) facing up. Keep clear of the world's roads: hub-spine |u| <= 4 from v -16 to 18, the
// campus and sports dirt roads leaving (+-6, -6) diagonally downwards, and the roundabout ring.
export const SPOT = {
  // Name letters stand across the spine; the car drives straight into them. The big ABHAY row stands
  // behind the smaller surname row, so from this camera the rows read top to bottom.
  abhayV: 8.5,
  surnameV: 3.2,
  // Painted on the road, sized to fit its 8 m width.
  roleV: -3.3, // centre of the role line block, between the car and the letters
  controlsV: -11.25, // first of the three control lines, just behind the car
  // On the grass wedge between the spine and the sports road, right of the control lines (the map
  // panel covers the bottom left of the screen); the cluster stays 0.4 m clear of both roads.
  keycaps: [6.4, -12.6] as const, // the W key; A S D sit below it
  // Left of the spine. The easel sits low so a car heading up-left from the spawn, towards the
  // skill wall, passes behind it.
  photo: [-10.6, 0.7] as const,
  photoPad: [-11.5, -2.5] as const, // 0.35 m clear of the campus road's upper edge
  wallLegendV: 5.95, // painted between the wall and its pad
  wall: [-19.4, 7.4] as const, // centre of the wall's base; it is about 11 m long
  wallPad: [-19.4, 2.3] as const,
  // Right of the spine.
  hut: HUT, // hut recipe origin, the middle of its front row of cells; the door faces the camera
  contactBoard: [12.8, 4.5] as const, // its right edge stays clear of the lantern behind it
  lantern: [16.9, 7.9] as const,
  mailbox: [23.6, 5.2] as const,
  contactPad: [HUT[0] - 1.25, 4.0] as const, // in front of the door, which is the hut's left cell
  // Top left, out of the way between the skill wall and the ridge road.
  bench: [-13.4, 17.2] as const,
  creditsPad: [-13.4, 14.6] as const,
};
