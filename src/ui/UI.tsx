import { useEffect } from 'react';
import { INSPECT } from '../config/world.ts';
import { useStore } from '../state/store.ts';
import { Card } from './card/Card.tsx';
import { Classic } from './classic/Classic.tsx';
import { Hud } from './hud/Hud.tsx';
import { Fade, LiveRegion } from './hud/Status.tsx';
import { useGlobalKeys } from './keys.ts';
import { storage } from './lib.ts';
import { Help } from './sheet/Help.tsx';
import { PanelSheet } from './sheet/PanelSheet.tsx';
import { TouchControls } from './touch/TouchControls.tsx';
import { useUi } from './uiStore.ts';

declare global {
  interface Window {
    __ui?: { store: typeof useStore; ui: typeof useUi }; // ?inspect only, for the screenshot harness
  }
}

const MOTION_KEY = 'ui.motion';

// A reduced-motion choice made in Settings outlives the visit (the store starts from the OS setting).
function useMotionPreference() {
  useEffect(() => {
    const saved = storage.get(MOTION_KEY);
    if (saved === 'reduced' || saved === 'full') useStore.getState().setReducedMotion(saved === 'reduced');
    return useStore.subscribe((s, prev) => {
      if (s.reducedMotion !== prev.reducedMotion) storage.set(MOTION_KEY, s.reducedMotion ? 'reduced' : 'full');
    });
  }, []);
}

// Screen readers hear the interact prompt when the car stops on a pad.
function usePromptAnnouncements() {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.focus && s.focus.id !== prev.focus?.id && s.phase === 'play') s.announce(`${s.focus.label}. Press Enter or tap the button.`);
      }),
    [],
  );
}

// The HTML layer over the canvas: recruiter card, HUD, panels, help, touch controls and the
// classic view. Entry chunk only: nothing under src/ui imports three, drei or another 3D module.
export function UI() {
  const webgl = useStore((s) => s.webgl);
  const classic = useStore((s) => s.classicOpen);
  const reduced = useStore((s) => s.reducedMotion);
  const night = useStore((s) => s.night);
  useGlobalKeys();
  useMotionPreference();
  usePromptAnnouncements();

  useEffect(() => {
    if (INSPECT) window.__ui = { store: useStore, ui: useUi };
  }, []);

  return (
    <div className="ui" data-motion={reduced ? 'reduced' : 'full'} data-night={night || undefined}>
      {webgl && (
        <div className="layers" inert={classic || undefined}>
          <Card />
          <Hud />
          <TouchControls />
          <PanelSheet />
          <Help />
          <Fade />
        </div>
      )}
      <Classic />
      <LiveRegion />
    </div>
  );
}
