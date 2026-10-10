// Career road layout in screen space (u right, v up the screen, metres). The road runs up u = 0,
// 9 m wide, from v = 34 to v = 98; the Amazon plaza starts at v = 96, so nothing here goes past 95.
import { at } from './kit/frame.ts';
import type { V3 } from './kit/frame.ts';

export const ZONE = 'career' as const;
export const ROAD_HALF = 4.5;

// Zone-local position of a screen point.
export const p = (u: number, v: number, y = 0): V3 => at(ZONE, u, v, y);

export const PLAN = {
  start: { board: [-10.1, 41.3], pad: [-9.5, 37.7] },
  razorpay: { v: 48, pad: [-10.2, 49.2], board: [-11.4, 53.8] },
  milestone: [-7.8, 60],
  limeroad: { v: 72, pad: [-10.2, 73.2], board: [-11.4, 77.8] },
  amazon: { v: 92 },
  years: [
    { year: '2023', v: 44.4 },
    { year: '2024', v: 63.4 },
    { year: '2025', v: 86.4 },
  ],
} as const;
