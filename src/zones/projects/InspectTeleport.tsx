import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { INSPECT, params, yawForScreenDir } from '../../config/world.ts';
import { car } from '../../state/car.ts';
import { events } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { worldX, worldZ } from './frame.ts';

// Harness aid, only with ?inspect: ?inspect&pfgo=x,z[,du,dv] puts the car at zone-local (x, z)
// facing screen direction (du, dv) once driving starts; &pfzoom=N sets the camera distance.
export function InspectTeleport() {
  const { world } = useRapier();
  const dom = useThree((s) => s.gl.domElement);
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !INSPECT || useStore.getState().phase !== 'play' || !car.ready) return;
    done.current = true;
    const go = params.get('pfgo');
    const zoom = Number(params.get('pfzoom'));
    if (zoom) dom.dispatchEvent(new WheelEvent('wheel', { deltaY: Math.log(zoom / 24) / 0.0015 }));
    if (!go) return;
    const [lx, lz, du = 1, dv = 0] = go.split(',').map(Number);
    let chassis = null;
    world.forEachRigidBody((b) => {
      const t = b.translation();
      if (Math.hypot(t.x - car.x, t.y - car.y, t.z - car.z) < 0.05) chassis = b;
    });
    if (!chassis) return;
    const body = chassis as { setTranslation: (v: object, w: boolean) => void; setRotation: (q: object, w: boolean) => void; setLinvel: (v: object, w: boolean) => void; setAngvel: (v: object, w: boolean) => void };
    const x = worldX(lx, lz);
    const z = worldZ(lx, lz);
    const yaw = yawForScreenDir(du, dv);
    body.setTranslation({ x, y: 1.4, z }, true);
    body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    events.emit('teleported', { x, z, yaw });
  });
  return null;
}
