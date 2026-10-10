import { DEBUG, INSPECT } from '../config/world.ts';
import { events } from '../state/events.ts';

// ?debug or ?inspect only: window.__vehicle lets the screenshot harness flip the car, honk, read
// the recovery state and see which sound and impact events fired (with --eval).
export type VehicleDebug = {
  flip: (mode?: 'side' | 'roof' | 'nose') => void;
  honk: () => void;
  hop: (speed?: number) => void;
  push: (vx: number, vy: number, vz: number) => void;
  state: () => Record<string, unknown>;
  night: (on: boolean) => void;
  camera: (o: { azimuth?: number; elevation?: number; distance?: number; target?: [number, number, number]; blend?: number } | null) => void;
  log?: { t: number; type: string; name?: string; strength?: number }[];
};

declare global {
  interface Window {
    __vehicle?: VehicleDebug;
  }
}

export const VEHICLE_DEBUG = DEBUG || INSPECT;

export function exposeVehicleDebug(api: VehicleDebug): () => void {
  if (!VEHICLE_DEBUG || typeof window === 'undefined') return () => {};
  const log: NonNullable<VehicleDebug['log']> = [];
  const push = (e: (typeof log)[number]) => {
    log.push(e);
    if (log.length > 200) log.shift();
  };
  const offSound = events.on('sound', ({ name }) => push({ t: Math.round(performance.now()), type: 'sound', name }));
  const offImpact = events.on('impact', ({ strength, material }) => push({ t: Math.round(performance.now()), type: 'impact', name: material, strength: +strength.toFixed(2) }));
  window.__vehicle = { ...api, log };
  return () => {
    offSound();
    offImpact();
    if (window.__vehicle?.flip === api.flip) delete window.__vehicle;
  };
}
