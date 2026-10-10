import { Component, Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { AudioSystem } from './audio/AudioSystem.tsx';
import { useStore } from './state/store.ts';
import { UI } from './ui/UI.tsx';

// The entry chunk is React + the HTML UI only; the 3D scene is a separate lazy chunk.
const Experience = lazy(() => import('./Experience.tsx'));

// If the 3D scene fails to load or start (old GPU, blocked chunk, driver error), show the classic
// view instead of a blank page.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('3D scene failed; showing the classic view', error);
    const s = useStore.getState();
    s.setWebgl(false);
    s.setClassicOpen(true);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function App() {
  const webgl = useStore((s) => s.webgl);
  return (
    <>
      {webgl && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </SceneBoundary>
      )}
      <UI />
      <AudioSystem />
    </>
  );
}
