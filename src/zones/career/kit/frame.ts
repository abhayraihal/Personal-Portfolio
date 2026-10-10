// Zone-frame helpers shared by the career and sports zones. A zone frame (see <ZoneFrame>) has its
// origin at the zone centre, local +X = screen right and local -Z = screen up.
import { ZONE_BY_ID, toZoneLocal } from '../../../config/layout.ts';
import type { ZoneId } from '../../../config/layout.ts';
import { FACE_CAMERA_Y, SCREEN_RIGHT, SCREEN_UP, screenToWorld } from '../../../config/world.ts';
import { car } from '../../../state/car.ts';

export type V3 = [number, number, number];

// Zone-local position of the screen point (u, v), at height y.
export function at(zone: ZoneId, u: number, v: number, y = 0): V3 {
  const [x, z] = toZoneLocal(zone, u, v);
  return [x, y, z];
}

// World (x, z) of a zone-local point. Kinematic bodies need world coordinates.
export function localToWorld(zone: ZoneId, x: number, z: number): [number, number] {
  const [cu, cv] = ZONE_BY_ID[zone].center;
  return screenToWorld(cu + x, cv - z);
}

// Same as localToWorld, written into `out` (no allocation; for per-step kinematic updates).
export function localToWorldInto(zone: ZoneId, x: number, z: number, out: { x: number; z: number }) {
  const c = ZONE_BY_ID[zone].center;
  const u = c[0] + x;
  const v = c[1] - z;
  out.x = u * SCREEN_RIGHT.x + v * SCREEN_UP.x;
  out.z = u * SCREEN_RIGHT.z + v * SCREEN_UP.z;
  return out;
}

// The car's position in a zone frame, written into `out` (no allocation).
export function carLocal(zone: ZoneId, out: { x: number; z: number }): { x: number; z: number } {
  const [cu, cv] = ZONE_BY_ID[zone].center;
  out.x = car.u - cu;
  out.z = -(car.v - cv);
  return out;
}

// Rapier quaternion for a yaw about +Y given in a zone frame.
export function yawQuat(localYaw: number, out: { x: number; y: number; z: number; w: number }) {
  const half = (FACE_CAMERA_Y + localYaw) / 2;
  out.x = 0;
  out.y = Math.sin(half);
  out.z = 0;
  out.w = Math.cos(half);
  return out;
}
