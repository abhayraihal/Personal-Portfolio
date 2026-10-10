import { useEffect } from 'react';
import { DEBUG, INSPECT } from '../config/world.ts';
import { events } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { AudioManager } from './manager.ts';

// Synthesized Web Audio: engine, impact thuds and UI sounds. Lives in the entry chunk, so nothing
// here may import three, drei or another 3D module. Renders nothing. Sound is off by default
// (store.sound); the context is only created after a user gesture once sound is on.
export function AudioSystem() {
  useEffect(() => {
    const audio = new AudioManager();
    const offSound = events.on('sound', ({ name, volume }) => audio.play(name, volume));
    const offImpact = events.on('impact', ({ strength, material }) => audio.impact(strength, material));
    const offStore = useStore.subscribe((s, prev) => {
      if (s.sound !== prev.sound) {
        if (s.sound) audio.enable();
        else audio.pause();
      }
      if (s.panel !== prev.panel) audio.play(s.panel ? 'open' : 'close');
      if (s.teleportRequest && s.teleportRequest !== prev.teleportRequest) audio.play('teleport');
    });
    // Any gesture can start (or restart) the context while sound is on.
    const onGesture = () => {
      if (useStore.getState().sound && (!audio.ctx || audio.ctx.state !== 'running')) audio.enable();
    };
    const onVisibility = () => {
      if (document.hidden) audio.pause();
      else audio.enable();
    };
    const gestures = ['pointerdown', 'keydown', 'touchend'] as const;
    for (const g of gestures) window.addEventListener(g, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    let disposed = false;
    if (DEBUG || INSPECT) {
      void import('./debug.ts').then((m) => {
        if (!disposed) m.exposeAudioDebug(audio);
      });
    }
    return () => {
      disposed = true;
      offSound();
      offImpact();
      offStore();
      for (const g of gestures) window.removeEventListener(g, onGesture, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      audio.dispose();
    };
  }, []);
  return null;
}
