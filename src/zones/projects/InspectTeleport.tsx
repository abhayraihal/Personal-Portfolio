import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { INSPECT, params, yawForScreenDir } from '../../config/world.ts';
import { car } from '../../state/car.ts';
import { events } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { worldX, worldZ } from './frame.ts';

// Screenshot-harness aid, only with ?inspect. Once driving starts:
//   pfgo=x,z[,du,dv]  puts the car at zone-local (x, z) facing screen direction (du, dv)
//   pftour=x,z;x,z    visits each point in turn, pfstep ms apart (default 1200)
//   pfzoom=N          sets the camera distance
//   pfnight, pflow, pfreduced  switch on night, low quality or reduced motion
type Stop = [number, number, number, number];

const parse = (s: string): Stop => {
  const [x, z, du = 1, dv = 0] = s.split(',').map(Number);
  return [x, z, du, dv];
};

export function InspectTeleport() {
  const { world } = useRapier();
  const dom = useThree((s) => s.gl.domElement);
  const st = useRef<{ started: boolean; stops: Stop[]; next: number; at: number }>({ started: false, stops: [], next: 0, at: 0 });

  const place = ([lx, lz, du, dv]: Stop) => {
    let chassis: RapierRigidBody | null = null;
    world.forEachRigidBody((b) => {
      const t = b.translation();
      if (Math.hypot(t.x - car.x, t.y - car.y, t.z - car.z) < 0.05) chassis = b as RapierRigidBody;
    });
    const body = chassis as RapierRigidBody | null;
    if (!body) return;
    const x = worldX(lx, lz);
    const z = worldZ(lx, lz);
    const yaw = yawForScreenDir(du, dv);
    body.setTranslation({ x, y: 1.4, z }, true);
    body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    events.emit('teleported', { x, z, yaw });
  };

  useFrame(() => {
    const s = st.current;
    if (!INSPECT || useStore.getState().phase !== 'play' || !car.ready) return;
    const now = performance.now();
    if (!s.started) {
      s.started = true;
      const zoom = Number(params.get('pfzoom'));
      if (zoom) dom.dispatchEvent(new WheelEvent('wheel', { deltaY: Math.log(zoom / 24) / 0.0015 }));
      const store = useStore.getState();
      if (params.has('pfnight') && !store.night) store.toggleNight();
      if (params.has('pflow')) store.setQuality('low');
      if (params.has('pfreduced')) store.setReducedMotion(true);
      const go = params.get('pfgo');
      const tour = params.get('pftour');
      s.stops = tour ? tour.split(';').map(parse) : go ? [parse(go)] : [];
      s.at = now;
    }
    if (s.next < s.stops.length && now >= s.at) {
      place(s.stops[s.next++]);
      s.at = now + (Number(params.get('pfstep')) || 1200);
    }
  });
  return null;
}
