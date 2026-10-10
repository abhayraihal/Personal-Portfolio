import { useEffect } from 'react';
import { useProgress } from '@react-three/drei';
import { useStore } from '../state/store.ts';

// useProgress only sees three's DefaultLoadingManager (GLTFs and textures). Rapier and fonts load
// outside it, so the scene is only "ready" when <SceneReady> mounts; progress is capped below 100.
export function ProgressBridge() {
  const progress = useProgress((s) => s.progress);
  useEffect(() => {
    const s = useStore.getState();
    if (s.phase === 'boot') s.setProgress(Math.min(progress, 96));
  }, [progress]);
  return null;
}
