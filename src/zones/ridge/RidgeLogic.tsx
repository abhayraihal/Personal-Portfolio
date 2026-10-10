import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DEG, INSPECT } from '../../config/world.ts';
import { codeforces, contests, rankFor } from '../../data/codeforces.ts';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import type { CameraOverride, RidgeReadout } from '../../state/store.ts';
import { FOOT_U, MILESTONES, ROAD_V, S_END, S_SUMMIT, SUMMIT_Y, contestAt, deckY, hwAt, monthYear, sContest } from './profile.ts';
import { RANK_SHADE } from './geometry.ts';
import { gateFlash } from './Gates.tsx';
import { selfLight } from './materials.ts';

declare global {
  interface Window {
    __ridge?: RidgeReadout; // ?inspect only: the last readout sent to the store
  }
}

// Side-on framing while the car is on the ridge, so the road reads like a chart. Narrow (portrait)
// screens get a longer distance so about 20 m of road stays in view.
const OVERRIDE: CameraOverride = { id: 'ridge', elevation: 25 * DEG, distance: 34, blend: 1.2 };
const overrideDistance = (aspect: number) => Math.min(58, Math.max(34, 34 * Math.sqrt(1.6 / aspect)));
const CONFETTI = [RANK_SHADE.Newbie, RANK_SHADE.Pupil, RANK_SHADE.Specialist, RANK_SHADE.Expert, '#ffffff'];
const GATE_S = MILESTONES.map((m) => sContest(m.index));

// Works out whether the car is on the ridge road and which contest it is over, then drives the
// camera override, the readout strip, the gates and the summit celebration.
export function RidgeLogic() {
  const st = useRef({ on: false, offFor: 0, index: -1, lastS: 0, summit: false, gates: MILESTONES.map(() => false) });

  useEffect(
    () => () => {
      const s = useStore.getState();
      s.clearCameraOverride('ridge');
      if (st.current.on) s.setRidge(null);
    },
    [],
  );

  useEffect(() => {
    selfLight.night = useStore.getState().night;
    return useStore.subscribe((s) => {
      selfLight.night = s.night;
    });
  }, []);

  useFrame((state, delta) => {
    const r = st.current;
    const store = useStore.getState();
    let inside = false;
    let along = 0;
    if (car.ready && store.phase === 'play') {
      along = FOOT_U - car.u; // distance along the road (see profile.ts)
      const z = ROAD_V - car.v;
      // Enter a little way up the ramp, leave once back on the approach road.
      if (along > (r.on ? -1 : 1) && along < S_END + 1) {
        const sc = Math.min(Math.max(along, 0), S_END);
        inside = Math.abs(z) < hwAt(sc) + 0.4 && car.y > deckY(sc) + 0.3;
      }
    }
    r.offFor = inside ? 0 : r.offFor + delta;
    const on = inside || (r.on && r.offFor < 0.4);

    if (!on) {
      if (r.on) {
        r.on = false;
        r.index = -1;
        r.summit = false;
        r.gates.fill(false);
        store.clearCameraOverride('ridge');
        store.setRidge(null);
        if (INSPECT) window.__ridge = null;
      }
      return;
    }
    if (!r.on) {
      r.on = true;
      r.lastS = along;
    }

    const current = store.cameraOverride?.id === 'ridge' ? store.cameraOverride : null;
    if (store.reducedMotion) {
      if (current) store.clearCameraOverride('ridge');
    } else {
      const distance = overrideDistance(state.size.width / Math.max(1, state.size.height));
      if (!current || Math.abs((current.distance ?? 0) - distance) > 1) store.setCameraOverride({ ...OVERRIDE, distance });
    }

    const i = contestAt(along);
    if (i !== r.index) {
      r.index = i;
      const c = contests[i];
      const rank = rankFor(c.newRating);
      const readout = { index: i, name: c.name, date: c.date, rating: c.newRating, rank: rank.name, color: rank.color };
      store.setRidge(readout);
      if (INSPECT) window.__ridge = readout;
    }

    for (let k = 0; k < GATE_S.length; k++) {
      if (r.gates[k] || r.lastS >= GATE_S[k] || along < GATE_S[k]) continue;
      const m = MILESTONES[k];
      r.gates[k] = true;
      gateFlash[k] = 1;
      playSound('coin');
      store.announce(`${m.name} in ${monthYear(contests[m.index].date)}`);
    }
    r.lastS = along;

    if (!r.summit && along > S_SUMMIT + 1.5 && car.y > SUMMIT_Y + 0.3) {
      r.summit = true;
      store.toast(`Summit: ${codeforces.maxRating}`, 'win');
      store.announce(`Summit: max rating ${codeforces.maxRating}, ${codeforces.rank}`);
      playSound('win');
      events.emit('confetti', { x: car.x, y: car.y + 1.2, z: car.z, colors: CONFETTI, count: store.quality === 'low' ? 60 : 140 });
    }
  });

  return null;
}
