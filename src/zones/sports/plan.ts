// Sports ground layout, in the zone frame (x = screen right, -z = screen up, origin at the zone
// centre, screen (52, -46)). The dirt road from the hub ends at the top-left, near screen (34, -30),
// and the respawn faces down-right into the zone.

export const ZONE = 'sports' as const;

// Pitch: 28 m goal line to goal line, 17 m wide, with a mown border around it.
export const PITCH = { x: 2, z: 1, length: 28, width: 17, border: 1.2 };
export const GOAL = { width: 6, height: 2.6, depth: 2.2 };
export const BALL_RADIUS = 0.7;
export const CENTRE_SPOT: [number, number] = [PITCH.x, PITCH.z];

// Goal lines; side -1 is the left goal (screen left), +1 the right one.
export const goalLineX = (side: -1 | 1) => PITCH.x + side * (PITCH.length / 2);

export const SIGN = { x: -6.4, z: -17.6 };
export const PAD = { x: -12.0, z: -12.6 };
export const SCOREBOARD = { x: 2, z: -11.6 };
export const TABLE = { x: 11.6, z: -13.4 };
