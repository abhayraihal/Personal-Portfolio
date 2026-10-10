// Pad-to-toy signals: a bay's pad flips `parked`, the toy reads it in useFrame.
export type ToySignal = { parked: boolean; changedAt: number };

export const scanSignal: ToySignal = { parked: false, changedAt: 0 };
export const astSignal: ToySignal = { parked: false, changedAt: 0 };

export function setParked(s: ToySignal, parked: boolean) {
  s.parked = parked;
  s.changedAt = performance.now() / 1000;
}
