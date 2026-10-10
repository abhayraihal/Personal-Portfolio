import { Suspense, lazy } from 'react';
import { AudioSystem } from './audio/AudioSystem.tsx';
import { useStore } from './state/store.ts';
import { UI } from './ui/UI.tsx';

// The entry chunk is React + the HTML UI only; the 3D scene is a separate lazy chunk.
const Experience = lazy(() => import('./Experience.tsx'));

export function App() {
  const webgl = useStore((s) => s.webgl);
  return (
    <>
      {webgl && (
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      )}
      <UI />
      <AudioSystem />
    </>
  );
}
