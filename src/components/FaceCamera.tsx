import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Euler, Quaternion } from 'three';
import type { Group } from 'three';
import { FACE_CAMERA_Y } from '../config/world.ts';

const _q = new Quaternion();
const _e = new Euler();

// Turns its children so their +Z faces the fixed camera, whatever the parent's yaw. Static parents
// only: it measures the parent once on mount. Inside a <ZoneFrame> children already face the
// camera, so this is only needed under extra rotations.
export function FaceCamera({ children, position }: { children: ReactNode; position?: [number, number, number] }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g?.parent) return;
    g.parent.updateWorldMatrix(true, false);
    g.parent.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    g.rotation.y = FACE_CAMERA_Y - _e.y;
  }, []);
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}
