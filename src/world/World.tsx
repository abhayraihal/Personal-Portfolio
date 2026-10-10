import { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { preloadModels } from '../components/Model.tsx';
import { BOUNDS, ZONE_BY_ID } from '../config/layout.ts';
import type { ModelName } from '../config/models.ts';
import { FACE_CAMERA_Y, INSPECT, params } from '../config/world.ts';
import { useStore } from '../state/store.ts';
import { Bridge } from './Bridge.tsx';
import { Critters } from './Critters.tsx';
import { Ground } from './Ground.tsx';
import { Hills } from './Hills.tsx';
import { Lamps } from './Lamps.tsx';
import { buildMask } from './mask.ts';
import { getPlan } from './plan.ts';
import { PrayerFlags } from './PrayerFlags.tsx';
import { QualityMonitor } from './QualityMonitor.tsx';
import { Scatter, ScatterColliders } from './Scatter.tsx';
import { Atmosphere, EnvDriver } from './Sky.tsx';
import { TrailMarkers } from './Trail.tsx';
import { Splash } from './Splash.tsx';
import { Stream } from './Stream.tsx';

// The valley: a Himalayan meadow like IIT Mandi's Kamand campus, with deodar forest, a stream,
// prayer flags and snow on the far peaks. Mounted inside <Physics>.

const MODELS_USED: ModelName[] = [
  'tree-deodar-tall', 'tree-deodar', 'tree-pine-full', 'tree-pine-cone', 'tree-pine-snow',
  'rock-grey-a', 'rock-grey-b', 'rock-grey-c', 'rocks-snowcap-large', 'rocks-snowcap-small',
  'grass-tuft', 'grass-clump', 'flowers-blue-poppy', 'flowers-tall', 'mushrooms',
  'log', 'stump', 'stones-river-flat', 'pole-prayer-flag-mast', 'banner-darchog-blue',
  'banner-darchog-red', 'banner-darchog-green', 'lamp-post-street', 'lamp-post-lantern',
];
preloadModels(MODELS_USED);

declare global {
  interface Window {
    __store?: typeof useStore;
    __tp?: (u: number, v: number, du?: number, dv?: number) => void;
  }
}

// ?night starts at night. With ?inspect (harness only): ?quality=low|high picks a tier, and the
// store plus a teleport helper are exposed on window.
function DebugHooks() {
  useEffect(() => {
    const s = useStore.getState();
    if (params.has('night') && !s.night) s.toggleNight();
    if (INSPECT) {
      const q = params.get('quality');
      if ((q === 'low' || q === 'high') && q !== s.quality) s.setQuality(q);
      window.__store = useStore;
      // Teleport the car anywhere: borrows the hub's respawn for one synchronous teleport.
      window.__tp = (u, v, du = 0, dv = 1) => {
        const hub = ZONE_BY_ID.hub;
        const saved = hub.respawn;
        hub.respawn = { u, v, du, dv };
        useStore.getState().teleport('hub');
        hub.respawn = saved;
      };
    }
  }, []);
  return null;
}

function Walls() {
  const w = BOUNDS.u1 - BOUNDS.u0;
  const h = BOUNDS.v1 - BOUNDS.v0;
  const cu = (BOUNDS.u0 + BOUNDS.u1) / 2;
  const cv = (BOUNDS.v0 + BOUNDS.v1) / 2;
  return (
    <RigidBody type="fixed" colliders={false} name="valley-walls">
      <CuboidCollider args={[w / 2, 4, 1]} position={[cu, 4, -BOUNDS.v1 - 1]} />
      <CuboidCollider args={[w / 2, 4, 1]} position={[cu, 4, -BOUNDS.v0 + 1]} />
      <CuboidCollider args={[1, 4, h / 2]} position={[BOUNDS.u0 - 1, 4, -cv]} />
      <CuboidCollider args={[1, 4, h / 2]} position={[BOUNDS.u1 + 1, 4, -cv]} />
    </RigidBody>
  );
}

export function World() {
  const quality = useStore((s) => s.quality);
  const low = quality === 'low';
  const plan = useMemo(() => getPlan(quality), [quality]);
  const mask = useMemo(() => buildMask(plan), [plan]);
  useEffect(() => () => mask.dispose(), [mask]);
  return (
    <>
      <DebugHooks />
      <EnvDriver />
      <Atmosphere />
      <RigidBody type="fixed" colliders={false} name="valley-floor">
        <CuboidCollider args={[400, 0.5, 400]} position={[0, -0.5, 0]} friction={1} />
      </RigidBody>
      <group name="valley" rotation={[0, FACE_CAMERA_Y, 0]}>
        <Ground mask={mask} low={low} />
        <Stream mask={mask} />
        <Bridge />
        <Hills mask={mask} />
        <Scatter plan={plan} />
        <PrayerFlags plan={plan} />
        <Lamps plan={plan} />
        <TrailMarkers markers={plan.markers} />
        <Critters plan={plan} low={low} />
        <ScatterColliders plan={plan} />
        <Walls />
      </group>
      <Splash />
      <QualityMonitor />
    </>
  );
}
