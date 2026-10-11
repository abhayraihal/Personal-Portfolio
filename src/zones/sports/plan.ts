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
  [[PLAZA.x + 5, PROMENADE_Z], [48.6, PROMENADE_Z]],
  [[RIGHT_PATH_X, PROMENADE_Z], [RIGHT_PATH_X, 41.5]],
  [[-23.5, NEAR_PATH_Z], [RIGHT_PATH_X, NEAR_PATH_Z]],
];

export const TABLE = { x: -4.6, z: -22.6 };
export const TABLE_PAD = { x: -4.6, z: -18.4 };
// Gaming: the board, the den and the game shelf in a row, the pad in front of the den.
export const GAME_BOARD = { x: 2.6, z: -22.4 };
export const DEN = { x: 9.6, z: -27.4 };
export const GAME_SHELF = { x: 20.1, z: -27.2 };
export const GAMING_PAD = { x: 9.6, z: -20.4 };
export const TYPING = { x: 34.6, z: -23.2 };
export const TYPING_PAD = { x: 34.6, z: -18.6 };
export const MOUNTAIN = { x: 53.5, z: -23, r: 8.2, h: 7.2 };
export const TREK_PAD = { x: 52.8, z: -9.6 };

export const TENNIS = { x: 49, z: 1.5 };
export const TENNIS_PAD = { x: 36.8, z: -1.2 };
// The pump track runs up the screen (turned a quarter), between the right path and the bowling lane.
export const PUMP = { x: 46.6, z: 24.4 };
export const PUMP_PAD = { x: 37.6, z: 27.6 };
export const BIKE_RACK = { x: 38.3, z: 39.6 };
// Bowling lane along the right edge, bowled up the screen: the camera looks down it from behind the
// ball. z falls towards the pins.
export const BOWL = { x: 58.6, width: 4.6, approachZ: 43.4, foulZ: 38.6, headZ: 21.2, backZ: 15.4 };
export const BOWL_PAD = { x: 53.4, z: 42.4 };

export const POOL = { x: -14.25, z: 38.2 };
export const POOL_PAD = { x: -0.9, z: 40.4 };
// Beach volleyball beside the pool.
export const VOLLEY = { x: 12.2, z: 37.9 };
export const VOLLEY_PAD = { x: 25.4, z: 40.4 };
