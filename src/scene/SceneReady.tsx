import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../state/store.ts';

// Rendered as the last child inside the scene's <Suspense>: its effect only runs once every
// suspending sibling (rapier init, GLBs, fonts, textures) has resolved. Shaders are compiled
// (in parallel where the driver allows) before Start is enabled, so the first frames don't hitch.
export function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const s = useStore.getState();
      s.setProgress(100);
      if (s.phase === 'boot') s.setPhase('ready');
      window.__ready = true;
    };
    gl.compileAsync(scene, camera).then(finish, finish);
    const timer = setTimeout(finish, 5000);
    return () => clearTimeout(timer);
  }, [gl, scene, camera]);
  return null;
}
