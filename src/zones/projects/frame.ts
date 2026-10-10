// Zone-local helpers for the projects garage. Local frame (see <ZoneFrame>): origin at the zone
// centre, +X = screen right, -Z = screen up (away from the camera), +Z = towards the camera.
import { ZONE_BY_ID } from '../../config/layout.ts';
import { FACE_CAMERA_Y, screenToWorld } from '../../config/world.ts';
import { car } from '../../state/car.ts';

export const ZONE_ID = 'projects' as const;
export const ZONE = ZONE_BY_ID[ZONE_ID];
export const [CU, CV] = ZONE.center;
export const [ORIGIN_X, ORIGIN_Z] = screenToWorld(CU, CV);
export const ZONE_RADIUS = ZONE.area.kind === 'circle' ? ZONE.area.r : 28;

const COS = Math.cos(FACE_CAMERA_Y);
const SIN = Math.sin(FACE_CAMERA_Y);

// Zone-local (x, z) to world (x, z), split in two so per-frame code allocates nothing.
export const worldX = (lx: number, lz: number) => ORIGIN_X + lx * COS + lz * SIN;
export const worldZ = (lx: number, lz: number) => ORIGIN_Z - lx * SIN + lz * COS;

// World yaw (about +Y) for a zone-local yaw.
export const worldYaw = (localYaw: number) => localYaw + FACE_CAMERA_Y;

// The car in zone-local coordinates.
export const carX = () => car.u - CU;
export const carZ = () => -(car.v - CV);

// True when the car is near enough for the zone's animations to matter (it is on screen or about
// to be). Toys skip their per-frame work otherwise.
export function carNearZone(margin = 30): boolean {
  const dx = car.u - CU;
  const dv = car.v - CV;
  const r = ZONE_RADIUS + margin;
  return car.ready && dx * dx + dv * dv < r * r;
}

// World (x, z) back to zone-local; the inverse of worldX / worldZ.
export const localX = (wx: number, wz: number) => (wx - ORIGIN_X) * COS - (wz - ORIGIN_Z) * SIN;
export const localZ = (wx: number, wz: number) => (wx - ORIGIN_X) * SIN + (wz - ORIGIN_Z) * COS;
