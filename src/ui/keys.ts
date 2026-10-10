import { useEffect } from 'react';
import { ZONES } from '../config/layout.ts';
import { playSound } from '../state/events.ts';
import { useStore } from '../state/store.ts';
import { closeClassic, toggleClassic } from './classic/route.ts';
import { COARSE, handlesEnter, isTypingTarget } from './lib.ts';
import { teleportTo } from './teleport.ts';
import { useUi } from './uiStore.ts';

// Site-wide shortcuts. Driving keys (W A S D, arrows, Space, Shift) and R / H belong to the
// vehicle: they are only counted for the first-time hint, never handled or prevented here.

const DRIVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

// The letter as typed (so AZERTY users press the key with C on it), falling back to the physical
// key for non-Latin layouts.
function letter(e: KeyboardEvent): string {
  if (e.key.length === 1 && /[a-z]/i.test(e.key)) return e.key.toLowerCase();
  return e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : '';
}

function digit(e: KeyboardEvent): string {
  if (/^[1-9]$/.test(e.key)) return e.key;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  return m ? m[1] : '';
}

// Closes the top-most layer: classic view, settings, help, panel, then the phone map.
export function closeTopLayer(): boolean {
  const s = useStore.getState();
  const ui = useUi.getState();
  if (s.classicOpen) {
    if (!s.webgl) return false;
    closeClassic();
    return true;
  }
  if (ui.settings) {
    ui.setSettings(false);
    return true;
  }
  if (ui.help) {
    ui.setHelp(false);
    return true;
  }
  if (s.panel) {
    s.closePanel();
    return true;
  }
  if (ui.map && window.matchMedia?.(COARSE).matches) {
    ui.setMap(false);
    return true;
  }
  return false;
}

export function useGlobalKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const s = useStore.getState();
      const ui = useUi.getState();

      if (e.key === 'Escape') {
        if (closeTopLayer()) e.preventDefault();
        return;
      }
      if (DRIVE_CODES.has(e.code)) {
        if (!e.repeat && s.phase === 'play' && !s.panel && !s.classicOpen) ui.countDriveInput();
        return;
      }
      if (e.repeat) return;

      const l = letter(e);
      if (e.key === 'Enter' || l === 'e') {
        if (e.key === 'Enter' && handlesEnter(e.target)) return; // the focused link or button does its own thing
        if (s.classicOpen) return;
        e.preventDefault();
        if (ui.help) ui.setHelp(false);
        else if (s.phase === 'ready') s.start();
        else if (s.phase !== 'play') return;
        else if (s.panel) s.closePanel();
        else if (s.focus) s.interact();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        if (!s.classicOpen) ui.setHelp(!ui.help);
        return;
      }
      if (l === 'c') {
        e.preventDefault();
        ui.setSettings(false);
        toggleClassic();
        return;
      }
      if (l === 'm') {
        s.toggleSound();
        playSound('click');
        return;
      }
      if (l === 'n') {
        if (!s.classicOpen) s.toggleNight();
        return;
      }
      const d = digit(e);
      if (d && s.phase === 'play' && !s.classicOpen && !ui.help) {
        const zone = ZONES.find((z) => z.key === d);
        if (zone) {
          e.preventDefault();
          teleportTo(zone.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
