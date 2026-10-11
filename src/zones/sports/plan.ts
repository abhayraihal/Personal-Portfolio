// Sports park layout, in the zone frame (x = screen right, -z = screen up, origin at the zone
// centre, screen (52, -46)). The zone is the screen rect u 26..114, v -90..-14, so local x runs
// -26..62 and z -32..44. The dirt road from the hub ends at the top-left, near local (-18, -16).
//
// The stadium (running track around the football pitch) fills the left and middle. Above it, along
// the far edge: the entrance plaza, table tennis, the gaming den, the typing keyboard and the
// trekking mountain. Down the right: tennis, beach volleyball and the pump track. Along the near
// edge: the pool and the bowling lane. Tall things sit at the far edge so they hide nothing.

export const ZONE = 'sports' as const;
export const BOUNDS = { x0: -26, x1: 62, z0: -32, z1: 44 };

// Stadium centre; the pitch and the track share it.
export const STADIUM = { x: 4, z: 11 };

// Pitch: 28 m goal line to goal line, 17 m wide, with a mown border around it.
export const PITCH = { x: STADIUM.x, z: STADIUM.z, length: 28, width: 17, border: 1.2 };
export const GOAL = { width: 6, height: 2.6, depth: 2.2 };
export const BALL_RADIUS = 0.7;
export const CENTRE_SPOT: [number, number] = [PITCH.x, PITCH.z];

// Goal lines; side -1 is the left goal (screen left), +1 the right one.
export const goalLineX = (side: -1 | 1) => PITCH.x + side * (PITCH.length / 2);

// Running track: two straights joined by half circles, four lanes, run anticlockwise seen from above
// (screen: along the far straight to the left). The start line crosses the far straight at x.
export const TRACK = {
  x: STADIUM.x,
  z: STADIUM.z,
  straight: 22, // length of each straight
  rIn: 11.5, // inner edge radius of the bends
  lanes: 4,
  lane: 1.25,
  startX: STADIUM.x,
};
export const TRACK_R_OUT = TRACK.rIn + TRACK.lanes * TRACK.lane;

// Stadium front along the far straight: football and running pads either side of the scoreboard.
export const SCOREBOARD = { x: STADIUM.x, z: STADIUM.z - TRACK_R_OUT - 3.2 };
export const FOOTBALL_PAD = { x: STADIUM.x - 8.8, z: SCOREBOARD.z + 0.7 };
export const RUNNING_PAD = { x: STADIUM.x + 8.8, z: SCOREBOARD.z + 0.7 };

// Entrance plaza at the end of the road, with the park sign behind it.
export const PLAZA = { x: -15, z: -14, r: 7 };
export const ENTRANCE_SIGN = { x: -15.5, z: -24.5 };
export const ENTRANCE_PAD = { x: -19.5, z: -17.5 };

// Promenade along the far edge of the stadium, and paths down the right and along the near edge.
export const PROMENADE_Z = -14;
export const RIGHT_PATH_X = 34.6;
export const NEAR_PATH_Z = 30.6;
export const PATH_W = 3.4;
export const PATHS: [number, number][][] = [
  [[PLAZA.x + 5, PROMENADE_Z], [46.5, PROMENADE_Z]],
  [[RIGHT_PATH_X, PROMENADE_Z], [RIGHT_PATH_X, 41.5]],
  [[-23.5, NEAR_PATH_Z], [RIGHT_PATH_X, NEAR_PATH_Z]],
];

export const TABLE = { x: -2.5, z: -22.5 };
export const GAMING = { x: 10.5, z: -25.5 };
export const TYPING = { x: 33.5, z: -23.5 };
export const MOUNTAIN = { x: 53.5, z: -23, r: 8.2, h: 7.2 };

export const TENNIS = { x: 49, z: 1.5 };
export const TENNIS_PAD = { x: 36.8, z: -1.2 };
export const VOLLEY = { x: 49, z: 16.5 };
export const VOLLEY_PAD = { x: 37, z: 17.6 };
export const PUMP = { x: 50, z: 33.6 };
export const BIKE_RACK = { x: 39.2, z: 24.6 };
export const PUMP_PAD = { x: 36.9, z: 36.4 };

export const POOL = { x: -14.25, z: 38.2 };
export const POOL_PAD = { x: -1.5, z: 40 };
export const BOWLING = { x: 17.5, z: 38.2 };
