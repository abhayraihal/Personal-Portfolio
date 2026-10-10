import { useEffect, useState } from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import { useStore } from '../state/store.ts';

// Drops to the low quality tier when the frame rate stays under 40 fps for about 6 s of driving
// (or of the idle overview). It only ever steps down; the settings UI can step back up.
export function QualityMonitor() {
  const phase = useStore((s) => s.phase);
  const quality = useStore((s) => s.quality);
  const key = `${phase}|${quality}`;
  const watch = quality === 'high' && (phase === 'play' || phase === 'ready');
  const [armedKey, setArmedKey] = useState('');
  useEffect(() => {
    if (!watch) return;
    // Skip the first seconds: shader compiles and texture uploads stall frames after loading.
    const id = setTimeout(() => setArmedKey(key), phase === 'play' ? 4000 : 8000);
    return () => clearTimeout(id);
  }, [watch, key, phase]);
  if (!watch || armedKey !== key) return null;
  return (
    <PerformanceMonitor
      ms={500}
      iterations={12}
      threshold={0.8}
      bounds={() => [40, Infinity]}
      onDecline={() => {
        const s = useStore.getState();
        if (s.quality === 'high') s.setQuality('low');
      }}
    />
  );
}
