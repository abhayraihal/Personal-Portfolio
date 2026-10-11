// Pad-to-toy signals: a bay's pad flips `parked`, the toy reads it in useFrame.
export type ToySignal = { parked: boolean; changedAt: number };

const signal = (): ToySignal => ({ parked: false, changedAt: 0 });

export const scanSignal = signal();
export const astSignal = signal();
export const shootersSignal = signal();
export const ballSignal = signal();
export const cinemaSignal = signal();
export const covidSignal = signal();

export function setParked(s: ToySignal, parked: boolean) {
  s.parked = parked;
  s.changedAt = performance.now() / 1000;
}
