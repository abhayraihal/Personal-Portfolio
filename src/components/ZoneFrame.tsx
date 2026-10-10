import type { ReactNode } from 'react';
import { ZONE_BY_ID } from '../config/layout.ts';
import type { ZoneId } from '../config/layout.ts';
import { FACE_CAMERA_Y, screenToWorld } from '../config/world.ts';

// A zone's coordinate frame: origin at the zone centre on the ground, local +X = screen right,
// local -Z = screen up (away from the camera), local +Z = towards the camera. Unrotated text and
// boards inside it face the camera. Rigid bodies inside it inherit this transform when they mount.
export function ZoneFrame({ zone, children }: { zone: ZoneId; children: ReactNode }) {
  const [u, v] = ZONE_BY_ID[zone].center;
  const [x, z] = screenToWorld(u, v);
  return (
    <group name={`zone-${zone}`} position={[x, 0, z]} rotation={[0, FACE_CAMERA_Y, 0]}>
      {children}
    </group>
  );
}
