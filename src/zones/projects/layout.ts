// Where everything in the projects garage sits, in zone-local metres (see frame.ts).
// Two rows of three bays face the camera. The entrance road continues as a boulevard between the
// rows; the back row is reached from the boulevard, the front row from the lane nearest the camera.
// At the far end the boulevard turns up the right lane onto the 2022 street, which runs along a
// third row of bays for the four 2022 projects.
import { moreProjects, projects } from '../../data/profile.ts';
import type { PanelId, Project } from '../../data/profile.ts';
import type { PosterArt } from './posters.ts';

export type Row = 'back' | 'front' | 'y2022';

export type Bay = {
  project: Project;
  row: Row;
  x: number;
  fit: 'cover' | 'contain'; // how the screenshot fills the billboard frame
  floor: string; // painted bay floor
  floorW?: number; // painted floor width (default FLOOR_W)
  backing?: string; // colour behind a 'contain' image (default white)
  cropTop?: number; // share of the image height cut off the top (a window title bar)
  art?: PosterArt; // drawn poster when the project has no screenshot
};

// Billboard face, lectern centre and pad centre (z) for each row.
export const ROWS: Record<Row, { board: number; lectern: number; pad: number }> = {
  back: { board: -16, lectern: -12.4, pad: -8.4 },
  // 9.5 m clears the boulevard: a 5 m board hides about 5 m of ground behind it at 45 degrees.
  front: { board: 9.5, lectern: 13.1, pad: 17.1 },
  y2022: { board: -41, lectern: -37.4, pad: -33.4 },
};

export const BAY_X = [-14, 0, 14];
export const FLOOR_W = 9.2;

const byPanel = (id: PanelId): Project => {
  const p = [...projects, ...moreProjects].find((q) => q.panel === id);
  if (!p) throw new Error(`profile.ts has no project ${id}`);
  return p;
};

// The 2022 row is a bay, a toy, a bay, a toy... across the whole zone, so its floors are a little
// narrower than the others (the lectern still fits with 0.6 m to spare).
export const BAYS: Bay[] = [
  { project: byPanel('project-scan2scope'), row: 'back', x: BAY_X[0], fit: 'contain', floor: '#efd9a7' },
  { project: byPanel('project-self-driving-car'), row: 'back', x: BAY_X[1], fit: 'cover', floor: '#c9d9ee' },
  { project: byPanel('project-rule-engine'), row: 'back', x: BAY_X[2], fit: 'cover', floor: '#dccfee' },
  { project: byPanel('project-trip-planner'), row: 'front', x: BAY_X[0], fit: 'cover', floor: '#cfe6c4', art: 'map' },
  { project: byPanel('project-weather'), row: 'front', x: BAY_X[1], fit: 'cover', floor: '#c6e3ee', art: 'weather' },
  { project: byPanel('project-tower-defense'), row: 'front', x: BAY_X[2], fit: 'cover', floor: '#f2cfd6' },
  { project: byPanel('project-space-shooters'), row: 'y2022', x: -25.6, fit: 'contain', backing: '#22206b', cropTop: 0.052, floor: '#d9d3f2', floorW: 8.6 },
  { project: byPanel('project-hit-the-ball'), row: 'y2022', x: -11.2, fit: 'contain', backing: '#141414', cropTop: 0.05, floor: '#f4d9c6', floorW: 8.6 },
  { project: byPanel('project-lightsout'), row: 'y2022', x: 3.0, fit: 'contain', backing: '#000000', floor: '#e4d6ef', floorW: 8.6 },
  { project: byPanel('project-covid'), row: 'y2022', x: 19.2, fit: 'cover', floor: '#cfe5dd', floorW: 8.6, art: 'covid' },
];

export const bayFor = (id: PanelId): Bay => {
  const b = BAYS.find((q) => q.project.panel === id);
  if (!b) throw new Error(`no bay for ${id}`);
  return b;
};

// Billboard image area (metres). Posters are drawn at the same aspect.
export const IMAGE_W = 6.0;
export const IMAGE_H = 3.5;

// Entrance at the start of the boulevard. The entrance pad sits 5.6 m behind the teleport point
// (zone-local -20, 0): a teleport lands the car beside the ring and no prompt pops up on arrival.
export const ENTRANCE = { x: -25.6, z: 0 };

// Road surfaces inside the garage: the boulevard, the lane up the right side and the 2022 street.
// Each is a rectangle; Plaza.tsx joins them into one surface with rounded corners.
export const BOULEVARD = { x0: -27.5, x1: 32, z0: -4, z1: 4 };
export const LANE = { x0: 25, x1: 32, z0: -22, z1: -4 };
export const STREET = { x0: -29.6, x1: 32, z0: -29, z1: -22 };

// Paved ground of the 2022 row, joined to the round plaza.
export const BACK_SLAB = { x0: -29.3, x1: 33.3, z0: -50.3, z1: -17 };

// The four 2022 toys, one beside each bay (zone-local).
export const TOYS_2022 = {
  shooters: { x: -18.4, z: -39.6 },
  ball: { x: -4.1, z: -38.6 },
  cinema: { x: 11.1, z: 0 }, // parts are placed on their own z (see DriveInToy)
  covid: { x: 28.75, z: -44.6 },
};
