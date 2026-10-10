import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { zoneAt } from '../config/layout.ts';
import { car } from '../state/car.ts';
import { playSound } from '../state/events.ts';
import { useStore } from '../state/store.ts';

// Works out which zone the car is in a few times a second and tells the UI.
export function ZoneTracker() {
  const acc = useRef(0);
  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.2 || !car.ready) return;
    acc.current = 0;
    const s = useStore.getState();
    if (s.phase !== 'play') return;
    const zone = zoneAt(car.u, car.v);
    const id = zone?.id ?? null;
    if (id === s.zone) return;
    s.setZone(id);
    if (zone) {
      s.toast(zone.title, 'zone');
      s.announce(`${zone.title}: ${zone.subtitle}`);
      playSound('zone');
    }
  });
  return null;
}
