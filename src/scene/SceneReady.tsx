import { useEffect } from 'react';
import { useStore } from '../state/store.ts';

// Rendered as the last child inside the scene's <Suspense>: its effect only runs once every
// suspending sibling (rapier init, GLBs, fonts, textures) has resolved.
export function SceneReady() {
  useEffect(() => {
    const s = useStore.getState();
    s.setProgress(100);
    if (s.phase === 'boot') s.setPhase('ready');
    window.__ready = true;
  }, []);
  return null;
}
