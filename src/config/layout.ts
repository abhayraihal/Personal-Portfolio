// World layout in SCREEN coordinates: u = metres to the right on screen, v = metres up the screen
// (away from the camera). Use screenToWorld() for world (x, z). A zone's 3D content is built in its
// own frame via <ZoneFrame>: origin at the zone centre, local +X = screen right, local -Z = screen up.
import type { PanelId } from '../data/profile.ts';
import { screenToWorld } from './world.ts';

export type ZoneId = 'hub' | 'career' | 'amazon' | 'projects' | 'ridge' | 'campus' | 'sports';

export type Area =
  | { kind: 'circle'; u: number; v: number; r: number }
  | { kind: 'rect'; u0: number; v0: number; u1: number; v1: number };

export type Respawn = { u: number; v: number; du: number; dv: number };

export type ZoneDef = {
  id: ZoneId;
  key: string; // hotkey that teleports here
  title: string;
  subtitle: string;
  color: string;
  center: [number, number];
  area: Area;
  respawn: Respawn;
  panel: PanelId; // opened with Enter when no pad is focused
};

const circle = (u: number, v: number, r: number): Area => ({ kind: 'circle', u, v, r });
const rect = (u0: number, v0: number, u1: number, v1: number): Area => ({ kind: 'rect', u0, v0, u1, v1 });

export const ZONES: ZoneDef[] = [
  {
    id: 'hub', key: '1', title: 'Start', subtitle: 'Name, skills and contact', color: '#e2557f',
    center: [0, 6], area: circle(0, 6, 26), respawn: { u: 0, v: -8, du: 0, dv: 1 }, panel: 'about',
  },
  {
    id: 'career', key: '2', title: 'Career road', subtitle: 'Razorpay and LimeRoad', color: '#3395ff',
    center: [0, 66], area: rect(-16, 36, 16, 97), respawn: { u: 0, v: 38, du: 0, dv: 1 }, panel: 'career',
  },
  {
    id: 'amazon', key: '3', title: 'Amazon', subtitle: 'SDE, May 2025 – now', color: '#ff9900',
    center: [0, 122], area: circle(0, 122, 26), respawn: { u: 0, v: 106, du: 0, dv: 1 }, panel: 'amazon',
  },
  {
    id: 'projects', key: '4', title: 'Projects', subtitle: 'Things I built', color: '#7c5cff',
    center: [80, 26], area: rect(50, -4, 114, 78), respawn: { u: 60, v: 26, du: 1, dv: 0 }, panel: 'projects',
  },
  {
    id: 'ridge', key: '5', title: 'Rating ridge', subtitle: 'Codeforces, 2021 – 2025', color: '#2b59c3',
    center: [-104, 30], area: rect(-182, 8, -22, 56), respawn: { u: -26, v: 26, du: -1, dv: 0 }, panel: 'codeforces',
  },
  {
    id: 'campus', key: '6', title: 'IIT Mandi', subtitle: 'B.Tech, research, hackathons', color: '#2f6b55',
    center: [-58, -50], area: circle(-58, -50, 30), respawn: { u: -52, v: -40.5, du: -1, dv: 0 }, panel: 'education',
  },
  {
    id: 'sports', key: '7', title: 'Sports park', subtitle: 'Sports, gaming and typing', color: '#4caf50',
    center: [52, -46], area: rect(26, -90, 114, -14), respawn: { u: 40, v: -36, du: 1, dv: -1 }, panel: 'sports',
  },
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<ZoneId, ZoneDef>;

export function inArea(a: Area, u: number, v: number): boolean {
  if (a.kind === 'circle') return (u - a.u) ** 2 + (v - a.v) ** 2 <= a.r * a.r;
  return u >= a.u0 && u <= a.u1 && v >= a.v0 && v <= a.v1;
}

export function zoneAt(u: number, v: number): ZoneDef | null {
  // Smaller zones first so the hub never swallows a neighbour at its edge.
  for (const z of ZONES) if (z.id !== 'hub' && inArea(z.area, u, v)) return z;
  return inArea(ZONE_BY_ID.hub.area, u, v) ? ZONE_BY_ID.hub : null;
}

// Point in a zone's local frame (see <ZoneFrame>) for a screen-space point.
export function toZoneLocal(zone: ZoneId, u: number, v: number): [number, number] {
  const [cu, cv] = ZONE_BY_ID[zone].center;
  return [u - cu, -(v - cv)];
}

export function zoneWorldCenter(zone: ZoneId): [number, number] {
  const [u, v] = ZONE_BY_ID[zone].center;
  return screenToWorld(u, v);
}

export type Road = { id: string; points: [number, number][]; width: number; kind: 'asphalt' | 'dirt' };

// Drawn by the world module. Zone modules may add paths and plazas inside their own areas.
export const ROADS: Road[] = [
  { id: 'hub-spine', points: [[0, -16], [0, 18]], width: 8, kind: 'asphalt' },
  { id: 'career', points: [[0, 34], [0, 98]], width: 9, kind: 'asphalt' },
  { id: 'projects', points: [[8, 26], [54, 26]], width: 8, kind: 'asphalt' },
  { id: 'ridge-approach', points: [[-8, 26], [-34, 26]], width: 8, kind: 'asphalt' },
  { id: 'campus', points: [[-6, -6], [-38, -34]], width: 7, kind: 'dirt' },
  { id: 'sports', points: [[6, -6], [34, -30]], width: 7, kind: 'dirt' },
];

// Roundabout joining hub-spine, career, projects and ridge-approach.
export const ROUNDABOUT = { u: 0, v: 26, r: 8, width: 7 };

// A mountain stream; the world module draws it and the bridge where it crosses the campus road.
export const STREAM = {
  points: [[-215, -4], [-130, -8], [-70, -12], [-32, -20], [-18, -50], [-12, -95], [-20, -130]] as [number, number][],
  width: 7,
  bridges: [{ u: -29.2, v: -26.1, along: [-30, -26] as [number, number] }],
};

// Drivable area (screen space). The world module puts hills and invisible walls along the edge.
export const BOUNDS = { u0: -192, u1: 118, v0: -92, v1: 158 };

export const SPAWN = ZONE_BY_ID.hub.respawn;
