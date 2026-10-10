import { useEffect } from 'react';
import { ZONE_BY_ID } from '../../config/layout.ts';
import { INSPECT, screenToWorld } from '../../config/world.ts';
import { useStore } from '../../state/store.ts';
import { MAIN_FRAME, STATIONS, stationFraming } from './layout.ts';
import { inspectClocks } from './shared.ts';
import { frameCamera } from './Station.tsx';

// ?inspect only: lets the screenshot harness frame the camera on a plaza point and start a toy
// without driving there, e.g. --eval "__amazon.play('amazon-retention')". play() uses the same
// framing as parking on the pad.

type AmazonInspect = {
  look: (u: number, v: number, distance?: number, y?: number) => void;
  play: (id: string) => void;
  office: () => void;
  leave: (id: string) => void;
  phase: (id: string) => string | undefined;
  release: () => void;
  set: (patch: { night?: boolean; reducedMotion?: boolean; quality?: 'high' | 'low' }) => void;
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
      play(id) {
        const s = STATIONS.find((d) => d.id === id);
        if (s) {
          useStore.getState().clearCameraOverride(CAM);
          frameCamera(CAM, stationFraming(s));
        }
        inspectClocks.get(id)?.enter();
      },
      office: () => {
        useStore.getState().clearCameraOverride(CAM);
        frameCamera(CAM, MAIN_FRAME);
      },
      leave: (id) => inspectClocks.get(id)?.leave(),
      phase: (id) => inspectClocks.get(id)?.phase,
      release: () => useStore.getState().clearCameraOverride(CAM),
      set(patch) {
        const s = useStore.getState();
        if (patch.night !== undefined && patch.night !== s.night) s.toggleNight();
        if (patch.reducedMotion !== undefined) s.setReducedMotion(patch.reducedMotion);
        if (patch.quality) s.setQuality(patch.quality);
      },
    };
    return () => {
      delete window.__amazon;
    };
  }, []);
}
