import { useEffect } from 'react';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { INSPECT, screenToWorld } from '../../config/world.ts';
import { useStore } from '../../state/store.ts';
import { STATIONS } from './layout.ts';
import type { ToyClock } from './shared.ts';

// ?inspect only: lets the screenshot harness frame the camera on a plaza point and start a toy
// without driving there, e.g. --eval "__amazon.play('amazon-retention')".
export const inspectClocks = new Map<string, ToyClock>();

type AmazonInspect = {
  look: (u: number, v: number, distance?: number, y?: number) => void;
  play: (id: string, distance?: number) => void;
  leave: (id: string) => void;
  phase: (id: string) => string | undefined;
  release: () => void;
};

declare global {
  interface Window {
    __amazon?: AmazonInspect;
  }
}

const CAM = 'amazon-inspect';

export function useInspect() {
  useEffect(() => {
    if (!INSPECT) return;
    const [cu, cv] = ZONE_BY_ID.amazon.center;
    const look = (u: number, v: number, distance?: number, y = 0.8) => {
      const [x, z] = screenToWorld(cu + u, cv + v);
      useStore.getState().setCameraOverride({ id: CAM, target: [x, y, z], distance, blend: 0.05 });
    };
    window.__amazon = {
      look,
      play(id, distance) {
        const s = STATIONS.find((d) => d.id === id);
        if (s) look(s.frame[0], s.frame[1], distance);
        inspectClocks.get(id)?.enter();
      },
      leave: (id) => inspectClocks.get(id)?.leave(),
      phase: (id) => inspectClocks.get(id)?.phase,
      release: () => useStore.getState().clearCameraOverride(CAM),
    };
    return () => {
      delete window.__amazon;
    };
  }, []);
}
