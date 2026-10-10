import { useEffect } from 'react';
import { useRapier } from '@react-three/rapier';
import { INSPECT, screenToWorld, yawForScreenDir } from '../../config/world.ts';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { events } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';

declare global {
  interface Window {
    __campusDev?: { place: (lx: number, lz: number, yawDeg: number) => string; night: () => boolean; set: (k: string, v: unknown) => void };
  }
}

// TEMPORARY (dev only, ?inspect): window.__campusDev.place(localX, localZ, screenHeadingDeg).
export function DevHook() {
  const { world } = useRapier();
  useEffect(() => {
    if (!INSPECT) return;
    window.__campusDev = {
      place(lx, lz, deg) {
        let body: ReturnType<typeof world.getRigidBody> | null = null;
        world.forEachRigidBody((b) => {
          if (b.isDynamic() && b.mass() > 100) body = b;
        });
        if (!body) return 'no car';
        const b = body as ReturnType<typeof world.getRigidBody>;
        const [cu, cv] = ZONE_BY_ID.campus.center;
        const u = cu + lx;
        const v = cv - lz;
        const [x, z] = screenToWorld(u, v);
        const a = (deg * Math.PI) / 180;
        const yaw = yawForScreenDir(Math.cos(a), Math.sin(a));
        b.setTranslation({ x, y: 1.4, z }, true);
        b.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
        events.emit('teleported', { x, z, yaw });
        return `ok u=${u} v=${v}`;
      },
      night() {
        useStore.getState().toggleNight();
        return useStore.getState().night;
      },
      set(k, v) {
        useStore.setState({ [k]: v } as never);
      },
    };
  }, [world]);
  return null;
}
