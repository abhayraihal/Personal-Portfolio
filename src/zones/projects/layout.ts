// Where everything in the projects garage sits, in zone-local metres (see frame.ts).
// Two rows of three bays face the camera. The entrance road continues as a boulevard between the
// rows; the back row is reached from the boulevard, the front row from the lane nearest the camera.
import { projects } from '../../data/profile.ts';
import type { PanelId, Project } from '../../data/profile.ts';
import type { PosterArt } from './posters.ts';

export type Row = 'back' | 'front';

export type Bay = {
  project: Project;
  row: Row;
  x: number;
  fit: 'cover' | 'contain'; // how the screenshot fills the billboard frame
  floor: string; // painted bay floor
  art?: PosterArt; // drawn poster when the project has no screenshot
};

// Billboard face, lectern centre and pad centre (z) for each row.
export const ROWS: Record<Row, { board: number; lectern: number; pad: number }> = {
  back: { board: -16, lectern: -12.4, pad: -8.4 },
  // 9.5 m clears the boulevard: a 5 m board hides about 5 m of ground behind it at 45 degrees.
  front: { board: 9.5, lectern: 13.1, pad: 17.1 },
};

export const BAY_X = [-14, 0, 14];

const byPanel = (id: PanelId): Project => {
  const p = projects.find((q) => q.panel === id);
  if (!p) throw new Error(`profile.ts has no project ${id}`);
  return p;
};

export const BAYS: Bay[] = [
  { project: byPanel('project-scan2scope'), row: 'back', x: BAY_X[0], fit: 'contain', floor: '#efd9a7' },
  { project: byPanel('project-self-driving-car'), row: 'back', x: BAY_X[1], fit: 'cover', floor: '#c9d9ee' },
  { project: byPanel('project-rule-engine'), row: 'back', x: BAY_X[2], fit: 'cover', floor: '#dccfee' },
  { project: byPanel('project-trip-planner'), row: 'front', x: BAY_X[0], fit: 'cover', floor: '#cfe6c4', art: 'map' },
  { project: byPanel('project-weather'), row: 'front', x: BAY_X[1], fit: 'cover', floor: '#c6e3ee', art: 'weather' },
  { project: byPanel('project-tower-defense'), row: 'front', x: BAY_X[2], fit: 'cover', floor: '#f2cfd6' },
];

// Billboard image area (metres). Posters are drawn at the same aspect.
export const IMAGE_W = 6.0;
export const IMAGE_H = 3.5;

// Entrance and the early-projects arcade at the far end of the boulevard. The entrance pad sits
// 5.6 m behind the teleport point (zone-local -20, 0): a teleport lands the car beside the ring and
// no prompt pops up on arrival.
export const ENTRANCE = { x: -25.6, z: 0 };
export const ARCADE = { x: 22.4, z: -3.2, padZ: 1.5 };
export const BOULEVARD = { x0: -27.5, x1: 18, z0: -4, z1: 4 };
