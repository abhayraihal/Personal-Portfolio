import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from '../../components/Label.tsx';
import { car } from '../../state/car.ts';
import { events, playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { paint, paintMaterial } from '../career/kit/paint.ts';
import type { Part } from '../career/kit/paint.ts';
import { flatGeometry, fixWinding, loopBand, loopPoints } from './geom.ts';
import type { Loop } from './geom.ts';
import { formatLap, lap, resetLap, stepLap } from './lap.ts';
import { TRACK, TRACK_R_OUT } from './plan.ts';

// The running track around the pitch: four terracotta lanes with white lines, a start line with a
// chequered strip across the far straight, and lane numbers. Flat paint only; the car drives on the
// valley floor. The lap timer itself is in lap.ts.

const LOOP: Loop = { x: TRACK.x, z: TRACK.z, straight: TRACK.straight };
const RED = '#c8553d';
const INFIELD = '#7dbb5f';
const VERGE = '#cdbfa0';
const WHITE = '#f6f3ec';
const Y = 0.024;

// The infield inside the inner kerb, as one fan of triangles from the loop's spine.
function infield(r: number, y: number) {
  const pts = loopPoints(LOOP, r, 56);
  const tris: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    tris.push(LOOP.x, LOOP.z, ...a, ...b);
  }
  fixWinding(tris);
  return flatGeometry(tris, y);
}

function trackGeometry() {
  const parts: Part[] = [
    { geo: infield(TRACK.rIn + 0.05, 0.014), color: INFIELD },
    { geo: flatGeometry(loopBand(LOOP, TRACK.rIn, TRACK_R_OUT, 56), Y), color: RED },
    { geo: flatGeometry(loopBand(LOOP, TRACK_R_OUT, TRACK_R_OUT + 0.7, 56), 0.014), color: VERGE },
  ];
  for (let i = 0; i <= TRACK.lanes; i++) {
    const r = TRACK.rIn + i * TRACK.lane;
    const w = i === 0 ? 0.2 : i === TRACK.lanes ? 0.14 : 0.08;
    parts.push({ geo: flatGeometry(loopBand(LOOP, r - (i === 0 ? 0 : w / 2), r + (i === 0 ? w : w / 2), 56), Y + 0.004), color: WHITE });
  }
  // Start line and a chequered strip just past it (runners go left along the far straight).
  const z0 = TRACK.z - TRACK_R_OUT;
  const z1 = TRACK.z - TRACK.rIn;
  const quad = (x0: number, za: number, x1: number, zb: number, y: number, color: string) => {
    const tris = [x0, za, x1, za, x0, zb, x0, zb, x1, za, x1, zb];
    fixWinding(tris);
    parts.push({ geo: flatGeometry(tris, y), color });
  };
  quad(TRACK.startX - 0.13, z0, TRACK.startX + 0.13, z1, Y + 0.006, WHITE);
  const sq = TRACK.lane / 4;
  const cx = TRACK.startX - 0.25;
  quad(cx - sq * 2, z0, cx, z1, Y + 0.006, WHITE);
  for (let k = 0; k < TRACK.lanes * 4; k++) {
    for (let c = 0; c < 2; c++) {
      if ((k + c) % 2) continue;
      const za = z0 + k * sq;
      quad(cx - sq * (c + 1), za, cx - sq * c, za + sq, Y + 0.009, '#2a2d34');
    }
  }
  return paint(parts);
}

// Lane numbers, one label: lines stack towards +z (the camera), lane 1 is the inside lane.
const LANE_TEXT = Array.from({ length: TRACK.lanes }, (_, i) => String(TRACK.lanes - i)).join('\n');
const NUMBER_SIZE = 0.62;

export function Track() {
  const geometry = useMemo(trackGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => events.on('teleported', () => resetLap()), []);
  useEffect(() => resetLap, []);

  useFrame(() => {
    if (!car.ready) return;
    const wasRunning = lap.running;
    const res = stepLap(performance.now());
    if (!wasRunning && lap.running) playSound('click', 0.6);
    if (!res) return;
    const s = useStore.getState();
    const t = formatLap(res.ms);
    if (res.best) {
      s.toast(`New best lap: ${t} s`, 'win');
      s.announce(`New best lap, ${t} seconds.`);
      playSound('win');
      events.emit('confetti', { x: car.x, y: car.y + 1.4, z: car.z, count: 80 });
    } else {
      s.toast(`Lap: ${t} s`);
      s.announce(`Lap time ${t} seconds.`);
      playSound('coin');
    }
  });

  const zMid = TRACK.z - TRACK.rIn - (TRACK.lanes * TRACK.lane) / 2;
  return (
    <group>
      <mesh geometry={geometry} material={paintMaterial} receiveShadow />
      <Label flat font="display" size={NUMBER_SIZE} lineHeight={TRACK.lane / NUMBER_SIZE} color={WHITE} position={[TRACK.startX + 1.3, Y + 0.01, zMid]}
        fillOpacity={0.92}>
        {LANE_TEXT}
      </Label>
    </group>
  );
}
