// The ridge road as numbers: where each contest sits along the road, the deck height (the rating,
// smoothed to a drivable grade), the deck outline, the rank strata, the gates and the year marks.
// Plain math with no three.js, so a headless physics sim can import it.
import { ROADS, ZONE_BY_ID } from '../../config/layout.ts';
import { RANK_BANDS, contests, rankFor } from '../../data/codeforces.ts';

const DEG = Math.PI / 180;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Ridge frame, a group inside <ZoneFrame zone="ridge">: origin on the ground where the approach
// road ends, +x = screen right, +z = towards the camera. The road climbs along -x, so the distance
// along the road is s = -x.
const approach = ROADS.find((r) => r.id === 'ridge-approach');
const roadEnd = approach ? approach.points[approach.points.length - 1] : ([-34, 26] as [number, number]);
export const FOOT_U = roadEnd[0];
export const ROAD_V = roadEnd[1];
const [CU, CV] = ZONE_BY_ID.ridge.center;
export const FRAME_OFFSET: [number, number, number] = [FOOT_U - CU, 0, -(ROAD_V - CV)];

export const N = contests.length;
export const RAMP = 4; // m of on-ramp from the ground to contest 1
export const DS = 1.5; // m of road per contest
export const K = 0.007; // m per rating point
export const R0 = 300; // rating at ground level
export const MAX_GRADE = Math.tan(20 * DEG);
export const BASE_Y = 0.04; // the deck starts this far above the ground so it clears the road paint
export const HW = 3.6; // deck half-width along the road
export const PLAZA_HW = 7.5;
export const PLAZA_LEN = 15;
export const RAIL_INSET = 0.3; // rail centre line, inside the deck edge
export const BLUR = 3; // m, gaussian smoothing of the deck profile: crest radii stay above ~16 m

export const ratingY = (rating: number) => (rating - R0) * K;
export const sContest = (i: number) => RAMP + i * DS;
export const S_SUMMIT = sContest(N - 1);
export const S_END = S_SUMMIT + PLAZA_LEN;
export const SUMMIT_Y = ratingY(contests[N - 1].newRating);

export const monthYear = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

// First contest that reached each rank above Newbie: 'Pupil · Dec 2021'.
export type Milestone = { index: number; threshold: number; name: string; color: string; label: string };
export const MILESTONES: Milestone[] = RANK_BANDS.slice(1).flatMap(([threshold, name, color]) => {
  const index = contests.findIndex((c) => c.newRating >= threshold);
  return index < 0 ? [] : [{ index, threshold, name, color, label: `${name} · ${monthYear(contests[index].date)}` }];
});

// First contest of each calendar year.
export const YEARS = contests.flatMap((c, i) => (i === 0 || c.date.slice(0, 4) !== contests[i - 1].date.slice(0, 4) ? [{ year: c.date.slice(0, 4), index: i }] : []));

// Horizontal strata on the camera-facing side: one per 200 rating points, coloured by rank.
export type Stratum = { y0: number; y1: number; rating: number; band: string; color: string; odd: boolean };
export const STRATA: Stratum[] = (() => {
  const out: Stratum[] = [];
  const top = Math.max(...contests.map((c) => c.newRating)) + 200;
  const edges = new Set<number>([R0]);
  for (let r = 400; r < top; r += 200) edges.add(r);
  for (const [t] of RANK_BANDS) if (t > R0 && t < top) edges.add(t);
  const sorted = [...edges].toSorted((a, b) => a - b);
  sorted.forEach((r, k) => {
    const next = sorted[k + 1] ?? top;
    const { name, color } = rankFor(r);
    out.push({ y0: k === 0 ? -0.2 : ratingY(r), y1: ratingY(next), rating: r, band: name, color, odd: Math.floor(r / 200) % 2 === 1 });
  });
  return out;
})();

// --- Deck profile -------------------------------------------------------------------------------

// Weighted least-squares fit of the contest heights under a grade limit (Dykstra's alternating
// projections). The first contest and the rank milestones are weighted up, milestones also get a
// floor so the gate stands above its band line after smoothing, and the summit is pinned.
function solveCoarse(floors: Map<number, number>): Float64Array {
  const h = contests.map((c) => ratingY(c.newRating));
  const w = h.map((_, i) => (i === N - 1 ? 1e6 : i === 0 ? 25 : floors.has(i) ? 10 : 1));
  const p = Float64Array.from(h);
  const lim = MAX_GRADE * DS;
  const pairInc = new Float64Array((N - 1) * 2);
  const floorInc = new Float64Array(N);
  let rampInc = 0;
  for (let it = 0; it < 400; it++) {  // converged to 0.1 mm by ~120
    for (let i = 0; i < N - 1; i++) {
      const a = p[i] + pairInc[i * 2];
      const b = p[i + 1] + pairInc[i * 2 + 1];
      let pa = a;
      let pb = b;
      const d = b - a;
      if (Math.abs(d) > lim) {
        const e = (Math.abs(d) - lim) * Math.sign(d);
        const wa = w[i];
        const wb = w[i + 1];
        pa = a + (e * wb) / (wa + wb);
        pb = b - (e * wa) / (wa + wb);
      }
      pairInc[i * 2] = a - pa;
      pairInc[i * 2 + 1] = b - pb;
      p[i] = pa;
      p[i + 1] = pb;
    }
    {
      const y = p[0] + rampInc;
      const proj = Math.min(BASE_Y + MAX_GRADE * RAMP, Math.max(BASE_Y - MAX_GRADE * RAMP, y));
      rampInc = y - proj;
      p[0] = proj;
    }
    for (const [i, f] of floors) {
      const y = p[i] + floorInc[i];
      const proj = Math.max(f, y);
      floorInc[i] = y - proj;
      p[i] = proj;
    }
    p[N - 1] = SUMMIT_Y;
  }
  return p;
}

export const PROFILE_DS = 0.25;
export const PROFILE_S0 = -3;
const PROFILE_S1 = S_END + 3;
export const PROFILE_COUNT = Math.round((PROFILE_S1 - PROFILE_S0) / PROFILE_DS) + 1;

function buildProfile(coarse: Float64Array): Float64Array {
  const lin = new Float64Array(PROFILE_COUNT);
  for (let k = 0; k < PROFILE_COUNT; k++) {
    const s = PROFILE_S0 + k * PROFILE_DS;
    if (s <= 0) lin[k] = BASE_Y;
    else if (s <= RAMP) lin[k] = BASE_Y + ((coarse[0] - BASE_Y) * s) / RAMP;
    else if (s >= S_SUMMIT) lin[k] = SUMMIT_Y;
    else {
      const i = Math.min(N - 2, Math.floor((s - RAMP) / DS));
      const t = (s - sContest(i)) / DS;
      lin[k] = coarse[i] + (coarse[i + 1] - coarse[i]) * t;
    }
  }
  // A gaussian blur keeps the grade limit (it averages slopes) and rounds the crests.
  const r = Math.ceil((3 * BLUR) / PROFILE_DS);
  const kernel: number[] = [];
  let sum = 0;
  for (let q = -r; q <= r; q++) {
    const v = Math.exp(-0.5 * ((q * PROFILE_DS) / BLUR) ** 2);
    kernel.push(v);
    sum += v;
  }
  const out = new Float64Array(PROFILE_COUNT);
  for (let k = 0; k < PROFILE_COUNT; k++) {
    let acc = 0;
    for (let q = -r; q <= r; q++) acc += lin[Math.max(0, Math.min(PROFILE_COUNT - 1, k + q))] * kernel[q + r];
    out[k] = acc / sum;
  }
  // The plaza is exactly flat once the crest rounding has died out.
  for (let k = 0; k < PROFILE_COUNT; k++) if (PROFILE_S0 + k * PROFILE_DS >= S_SUMMIT + 3 * BLUR) out[k] = SUMMIT_Y;
  return out;
}

const sample = (arr: Float64Array, s: number) => {
  const f = (s - PROFILE_S0) / PROFILE_DS;
  const k = Math.max(0, Math.min(PROFILE_COUNT - 2, Math.floor(f)));
  const t = Math.max(0, Math.min(1, f - k));
  return arr[k] + (arr[k + 1] - arr[k]) * t;
};

// Milestone floors: start just above the band line and raise any that the blur pulled under it.
const MILESTONE_CLEARANCE = 0.06;
export const DECK: Float64Array = (() => {
  const floors = new Map<number, number>();
  for (const m of MILESTONES) floors.set(m.index, ratingY(m.threshold) + MILESTONE_CLEARANCE);
  let prof = buildProfile(solveCoarse(floors));
  for (let round = 0; round < 8; round++) {
    let ok = true;
    for (const m of MILESTONES) {
      const need = ratingY(m.threshold) + MILESTONE_CLEARANCE - sample(prof, sContest(m.index));
      if (need > 0.005) {
        ok = false;
        floors.set(m.index, (floors.get(m.index) ?? 0) + need + 0.01);
      }
    }
    if (ok) break;
    prof = buildProfile(solveCoarse(floors));
  }
  return prof;
})();

// Deck height at a distance s along the road.
export const deckY = (s: number) => sample(DECK, s);

// Deck half-width: a funnel at the foot that catches cars arriving off-centre, the road, a flared
// mouth into the summit plaza, and chamfered far corners.
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const MOUTH_HW = 5.4;
export const MOUTH_S1 = 8;
// Long enough that a car coming down off the plaza is steered into the road, not stopped.
export const FLARE_S0 = S_SUMMIT - 3;
export const FLARE_S1 = S_SUMMIT + 5;
export const CHAMFER = 3;
export function hwAt(s: number): number {
  if (s < MOUTH_S1) return HW + (MOUTH_HW - HW) * (1 - smooth(s / MOUTH_S1));
  if (s < FLARE_S0) return HW;
  if (s < FLARE_S1) return HW + (PLAZA_HW - HW) * smooth((s - FLARE_S0) / (FLARE_S1 - FLARE_S0));
  if (s < S_END - CHAMFER) return PLAZA_HW;
  return PLAZA_HW - Math.min(CHAMFER, s - (S_END - CHAMFER));
}

// Contest under a point s along the road (clamped to the first and the last).
export const contestAt = (s: number) => Math.max(0, Math.min(N - 1, Math.round((s - RAMP) / DS)));

export const SUMMIT = {
  y: SUMMIT_Y,
  s: S_SUMMIT + 8.5, // centre of the turnaround circle, where the plaza is level
};
