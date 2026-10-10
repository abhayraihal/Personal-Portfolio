import type { ZoneId } from '../config/layout.ts';
import { useStore } from '../state/store.ts';
import { useUi } from './uiStore.ts';

// Teleport behind a short fade: fade the screen out, move the car while it's covered, fade back.
// The vehicle consumes store.teleport (it owns the rigid body); the camera snaps on 'teleported'.

const OUT_MS = 190; // matches the .fade transition in hud.css
const OUT_MS_REDUCED = 70;
const HOLD_MS = 80; // one or two frames at the new spot before fading back in

let busy = false;

export function teleportTo(zone: ZoneId): void {
  const s = useStore.getState();
  if (busy || s.phase !== 'play' || s.classicOpen) return;
  busy = true;
  if (s.panel) s.closePanel();
  useUi.getState().setFade(true);
  window.setTimeout(
    () => {
      useStore.getState().teleport(zone);
      window.setTimeout(() => {
        useUi.getState().setFade(false);
        busy = false;
      }, HOLD_MS);
    },
    s.reducedMotion ? OUT_MS_REDUCED : OUT_MS,
  );
}
