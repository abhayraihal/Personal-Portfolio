import type { PanelId } from '../../data/profile.ts';

// Plaza layout in plaza coordinates (see shared.ts: u right, v up the screen, metres from the zone
// centre at screen (0, 122)). The career road arrives from below at v = -24.

export const PLAZA_RADIUS = 25;
export const PLINTH_H = 0.36; // exhibit platforms; toys stand on top
export const PAD_COLOR = '#e47c00'; // a shade darker than COLORS.amazon so pad words read on the paving

export const OFFICE = { u: 0, v: 20.8, scale: 0.64 }; // building-office scaled to 16 m wide
export const MAIN_PAD: [number, number] = [0, 12.8];
export const MAIN_FRAME = [0, 15.2, 5.2] as const; // camera target while parked: high enough to show the rooftop sign
export const TROPHY = { u: 0, v: 0, padV: -5.9 };

export type StationId = Extract<PanelId, `amazon-${string}`>;

export type StationDef = {
  id: StationId;
  icon: string; // painted on the pad
  center: [number, number]; // plinth centre
  size: [number, number]; // plinth width (x) and depth (z)
  pad: [number, number];
  frame: [number, number]; // camera target while parked, plaza coordinates
};

// Clockwise from the front left, in the order the panels link to each other.
export const STATIONS: StationDef[] = [
  { id: 'amazon-rewards', icon: 'Rewards', center: [-16.3, -7.6], size: [9, 6.5], pad: [-9.0, -4.6], frame: [-14.2, -4.6] },
  { id: 'amazon-oncall-agent', icon: 'Agent', center: [-17.6, 3.8], size: [8.6, 6.5], pad: [-10.6, 3.2], frame: [-15.2, 5.6] },
  { id: 'amazon-migration', icon: 'Regions', center: [-12.0, 13.8], size: [9.5, 6.5], pad: [-6.0, 8.4], frame: [-10.2, 13.4] },
  { id: 'amazon-retention', icon: 'Retention', center: [12.0, 13.8], size: [8, 6.5], pad: [6.0, 8.4], frame: [10.2, 13.4] },
  { id: 'amazon-connectors', icon: 'Connectors', center: [17.6, 3.8], size: [8.6, 6.5], pad: [10.6, 3.2], frame: [15.2, 5.6] },
  { id: 'amazon-oncall', icon: 'Oncall', center: [16.3, -7.6], size: [9, 6.5], pad: [9.0, -4.6], frame: [14.2, -4.6] },
];
