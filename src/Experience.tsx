import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, useGLTF, useTexture } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Confetti } from './components/Confetti.tsx';
import { modelUrl } from './components/Model.tsx';
import { MODELS } from './config/models.ts';
import type { ModelName } from './config/models.ts';
import { panels, profile, projects } from './data/profile.ts';
import { CAMERA, DEBUG, INSPECT } from './config/world.ts';
import { CameraRig } from './scene/CameraRig.tsx';
import { DebugExpose } from './scene/DebugExpose.tsx';
import { ProgressBridge } from './scene/ProgressBridge.tsx';
import { SceneReady } from './scene/SceneReady.tsx';
import { SunLight } from './scene/SunLight.tsx';
import { ZoneTracker } from './scene/ZoneTracker.tsx';
import { useStore } from './state/store.ts';
import { KEYMAP } from './vehicle/controls.ts';
import { PHYSICS_DT } from './vehicle/tuning.ts';
import { Vehicle } from './vehicle/Vehicle.tsx';
import { World } from './world/World.tsx';
import { AmazonZone } from './zones/amazon/index.tsx';
import { CampusZone } from './zones/campus/index.tsx';
import { CareerZone } from './zones/career/index.tsx';
import { HubZone } from './zones/hub/index.tsx';
import { ProjectsZone } from './zones/projects/index.tsx';
import { RidgeZone } from './zones/ridge/index.tsx';
import { SportsZone } from './zones/sports/index.tsx';

const ZONE_MODULES = [
  ['hub', HubZone],
  ['career', CareerZone],
  ['amazon', AmazonZone],
  ['projects', ProjectsZone],
  ['ridge', RidgeZone],
  ['campus', CampusZone],
  ['sports', SportsZone],
] as const;

// Start every model and picture download at once instead of zone by zone as each one suspends.
for (const name of Object.keys(MODELS) as ModelName[]) useGLTF.preload(modelUrl(name), false);
const images = new Set([profile.photo.src, profile.campusPhoto.src, ...projects.flatMap((p) => (p.image ? [p.image] : [])), ...Object.values(panels).flatMap((p) => (p.image ? [p.image.src] : []))]);
for (const url of images) useTexture.preload(url);

const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

// Falls back to the classic view if the GPU drops the WebGL context.
function onContextLost() {
  const s = useStore.getState();
  s.setWebgl(false);
  s.setClassicOpen(true);
}

// Everything that needs three, R3F, drei or rapier. Loaded lazily from App.tsx so the HTML card
// paints before ~1.2 MB (gzip) of 3D code arrives.
export default function Experience() {
  const quality = useStore((s) => s.quality);
  const paused = useStore((s) => s.classicOpen);
  // Phones render the scene behind the start card once instead of every frame, to save battery.
  const idle = useStore((s) => s.phase === 'boot' || s.phase === 'ready');
  return (
    <KeyboardControls map={KEYMAP}>
      <Canvas
        className="scene"
        shadows="percentage"
        dpr={quality === 'low' ? [1, 1.25] : [1, 1.5]}
        camera={{ fov: CAMERA.fov, near: 0.5, far: 600, position: [0, 60, 60] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        frameloop={paused ? 'never' : coarse && idle ? 'demand' : 'always'}
        onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', onContextLost)}
        aria-hidden="true"
      >
        <ProgressBridge />
        {INSPECT && <DebugExpose />}
        <Suspense fallback={null}>
          {/* updatePriority -50: step physics before every priority-0 useFrame (camera, wheels). */}
          <Physics timeStep={PHYSICS_DT} interpolate updateLoop="follow" updatePriority={-50} debug={DEBUG} paused={paused}>
            <ErrorBoundary name="world">
              <World />
            </ErrorBoundary>
            <Vehicle />
            {ZONE_MODULES.map(([id, Zone]) => (
              <ErrorBoundary key={id} name={`zone:${id}`}>
                <Zone />
              </ErrorBoundary>
            ))}
          </Physics>
          <CameraRig />
          <SunLight />
          <ZoneTracker />
          <Confetti />
          <SceneReady />
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
