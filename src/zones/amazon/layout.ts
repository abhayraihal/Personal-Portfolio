import type { PanelId } from '../../data/profile.ts';

// Plaza layout in plaza coordinates (see shared.ts: u right, v up the screen, metres from the zone
// centre at screen (0, 122)). The career road arrives from below at v = -24.

export const PLAZA_RADIUS = 25;
export const PLINTH_H = 0.36; // exhibit platforms; toys stand on top
export const PAD_COLOR = '#e47c00'; // a shade darker than COLORS.amazon so pad words read on the paving

export const OFFICE = { u: 0, v: 20.8, scale: 0.64 }; // building-office scaled to 16 m wide
export const MAIN_PAD: [number, number] = [0, 12.8];
// Camera target while parked on the overview pad: aimed 8 m up the facade so the rooftop sign fits.
export const MAIN_FRAME = { at: [0, 15.2, 8.0], fit: 17, portraitAt: [0, 14.2, 5.0] } as const;
export const TROPHY = { u: 0, v: 0, padV: -6.7 };

export type StationId = Extract<PanelId, `amazon-${string}`>;

// Camera framing while parked (see frameCamera in Station.tsx).
export type Framing = { at: readonly number[]; fit?: number; portraitAt?: readonly number[] };

export type StationDef = {
  id: StationId;
  icon: string; // painted on the pad
  center: [number, number]; // plinth centre
  size: [number, number]; // plinth width (x) and depth (z)
  pad: [number, number];
  frame: [number, number]; // camera target while parked, plaza coordinates
};

// Clockwise from the front left, in the order the panels link to each other. Pads sit on the
// middle of the promenade ring (radius 9.9), so a pad never reaches past the ring's outer edge.
export const STATIONS: StationDef[] = [
  { id: 'amazon-rewards', icon: 'Rewards', center: [-16.3, -7.6], size: [9, 6.5], pad: [-8.8, -4.5], frame: [-14.2, -4.6] },
  { id: 'amazon-oncall-agent', icon: 'Agent', center: [-17.6, 3.8], size: [8.6, 6.5], pad: [-9.5, 2.9], frame: [-15.2, 5.6] },
  { id: 'amazon-migration', icon: 'Regions', center: [-12.0, 13.8], size: [9.5, 6.5], pad: [-5.75, 8.05], frame: [-10.2, 13.4] },
  { id: 'amazon-retention', icon: 'Retention', center: [12.0, 13.8], size: [8, 6.5], pad: [5.75, 8.05], frame: [10.2, 13.4] },
  { id: 'amazon-connectors', icon: 'Connectors', center: [17.6, 3.8], size: [8.6, 6.5], pad: [9.5, 2.9], frame: [15.2, 5.6] },
  { id: 'amazon-oncall', icon: 'Oncall', center: [16.3, -7.6], size: [9, 6.5], pad: [8.8, -4.5], frame: [14.2, -4.6] },
];

// Portrait: aimed in front of the exhibit and a little right of it, so the exhibit sits above the
// prompt button and clear of the toolbar on the right edge.
export const stationFraming = (def: StationDef): Framing => ({
  at: def.frame,
  fit: def.size[0] + 1.6,
  portraitAt: [def.center[0] + 0.5, def.center[1] - 4, 0.8],
});
