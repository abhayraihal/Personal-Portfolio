import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

declare global {
  interface Window {
    __three?: { scene: unknown; gl: unknown; camera: unknown };
  }
}

// ?inspect only: lets the harness inspect the scene graph with --eval.
export function DebugExpose() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    window.__three = { scene, gl, camera };
  }, [scene, gl, camera]);
  return null;
}
