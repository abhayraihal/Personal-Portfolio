// Lap timer for the running track. Four gates across the track band: the start line on the far
// straight, the apex of each bend and the middle of the near straight. A lap counts when the car
// crosses the start line, passes the other three in order (either way round) and crosses the start
// line again. Cutting across the infield or going round outside the track misses a gate.
import { carLocal } from '../career/kit/frame.ts';
import { TRACK, TRACK_R_OUT, ZONE } from './plan.ts';

type Gate = { ax: number; az: number; bx: number; bz: number };

const S = TRACK.straight / 2;
const M = 0.6; // gates reach a little past the painted edges
const GATES: Gate[] = [
  // 0: start line, across the far straight (-z side)
  { ax: TRACK.startX, az: TRACK.z - TRACK_R_OUT - M, bx: TRACK.startX, bz: TRACK.z - TRACK.rIn + M },
  // 1: left bend apex
  { ax: TRACK.x - S - TRACK_R_OUT - M, az: TRACK.z, bx: TRACK.x - S - TRACK.rIn + M, bz: TRACK.z },
  // 2: near straight, middle
  { ax: TRACK.x, az: TRACK.z + TRACK.rIn - M, bx: TRACK.x, bz: TRACK.z + TRACK_R_OUT + M },
  // 3: right bend apex
  { ax: TRACK.x + S + TRACK.rIn - M, az: TRACK.z, bx: TRACK.x + S + TRACK_R_OUT + M, bz: TRACK.z },
];

const BEST_KEY = 'sports-best-lap';
const MAX_LAP = 120_000; // ms; a lap left this long is dropped

function loadBest(): number | null {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function saveBest(ms: number) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.round(ms)));
  } catch {
    // private mode: the best lap lasts for this visit only
  }
}

// Read every frame by the scoreboard; written only by stepLap.
export const lap = {
  running: false,
  dir: 1 as 1 | -1, // 1 = anticlockwise (gates 0, 1, 2, 3), -1 = clockwise (0, 3, 2, 1)
  next: 1, // gate expected next
  t0: 0, // performance.now() at the start line
  last: null as number | null, // ms
  best: loadBest(),
  laps: 0,
};

export type LapResult = { ms: number; best: boolean };

// True when the car's step p0-p1 crosses the gate segment.
function crosses(g: Gate, x0: number, z0: number, x1: number, z1: number): boolean {
  const gx = g.bx - g.ax;
  const gz = g.bz - g.az;
  const s0 = gx * (z0 - g.az) - gz * (x0 - g.ax);
  const s1 = gx * (z1 - g.az) - gz * (x1 - g.ax);
  if (s0 === s1 || (s0 > 0) === (s1 > 0)) return false;
  const u = s0 / (s0 - s1);
  const px = x0 + (x1 - x0) * u - g.ax;
  const pz = z0 + (z1 - z0) * u - g.az;
  const t = (px * gx + pz * gz) / (gx * gx + gz * gz);
  return t >= 0 && t <= 1;
}

const prev = { x: 0, z: 0, ok: false };
const cur = { x: 0, z: 0 };

export function resetLap() {
  lap.running = false;
  prev.ok = false;
}

// Advance the timer with the car's latest position. Returns a finished lap, if any.
export function stepLap(now: number): LapResult | null {
  carLocal(ZONE, cur);
  if (!prev.ok) {
    prev.x = cur.x;
    prev.z = cur.z;
    prev.ok = true;
    return null;
  }
  let result: LapResult | null = null;
  // A jump (teleport) is not driving.
  if (Math.hypot(cur.x - prev.x, cur.z - prev.z) < 3) {
    if (lap.running && now - lap.t0 > MAX_LAP) lap.running = false;
    for (let i = 0; i < GATES.length; i++) {
      if (!crosses(GATES[i], prev.x, prev.z, cur.x, cur.z)) continue;
      if (i === 0) {
        // Driving left along the far straight is anticlockwise.
        const dir: 1 | -1 = cur.x < prev.x ? 1 : -1;
        if (lap.running && lap.next === 0 && dir === lap.dir) {
          const ms = now - lap.t0;
          const best = lap.best === null || ms < lap.best;
          lap.last = ms;
          lap.laps++;
          if (best) {
            lap.best = ms;
            saveBest(ms);
          }
          result = { ms, best };
        }
        lap.running = true;
        lap.dir = dir;
        lap.next = dir === 1 ? 1 : 3;
        lap.t0 = now;
      } else if (lap.running && i === lap.next) {
        lap.next = (lap.next + lap.dir + 4) % 4;
      }
    }
  }
  prev.x = cur.x;
  prev.z = cur.z;
  return result;
}

export const formatLap = (ms: number) => (ms / 1000).toFixed(1);
