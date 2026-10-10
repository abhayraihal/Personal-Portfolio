import { create } from 'zustand';
import type { ZoneId } from '../config/layout.ts';
import type { PanelId } from '../data/profile.ts';

// App-wide state. Lives in the entry chunk (no three.js), so the HTML UI can use it before the 3D
// chunk arrives. Per-frame data (car position, speed) is NOT here: see state/car.ts.

export type Phase =
  | 'boot' // HTML card only, 3D chunk loading
  | 'ready' // 3D scene mounted and idle behind the card; Start is enabled
  | 'intro' // Start pressed: camera glides down to the car
  | 'play'; // driving

export type Quality = 'high' | 'low';

// What Enter / the interact button does right now.
export type Action =
  | { kind: 'panel'; panel: PanelId }
  | { kind: 'link'; url: string }
  | { kind: 'run'; run: () => void };

export type Focus = { id: string; label: string; action: Action };

export type CameraOverride = {
  id: string; // owner, so only the owner clears it
  azimuth?: number; // radians, same convention as CAMERA.azimuth
  elevation?: number;
  distance?: number; // landscape metres; the camera rig scales it for tall screens like its follow distance
  target?: [number, number, number]; // world point to look at instead of the car
  blend?: number; // seconds to ease in (default 1)
};

export type Toast = { id: number; text: string; tone?: 'info' | 'zone' | 'win' };

export type RidgeReadout = { index: number; name: string; date: string; rating: number; rank: string; color: string } | null;

export type TouchInput = { throttle: number; steer: number; brake: boolean; boost: boolean };

type State = {
  phase: Phase;
  progress: number; // 0..100, asset loading
  webgl: boolean; // false when WebGL2 is unavailable: the UI shows the classic view only
  setPhase: (p: Phase) => void;
  setProgress: (p: number) => void;
  setWebgl: (ok: boolean) => void;
  start: () => void; // Start button / first key: intro (or play with reduced motion)

  classicOpen: boolean;
  setClassicOpen: (open: boolean) => void;
  panel: PanelId | null;
  openPanel: (id: PanelId) => void;
  closePanel: () => void;

  zone: ZoneId | null; // zone the car is in
  setZone: (z: ZoneId | null) => void;
  visited: ZoneId[];
  focus: Focus | null; // interactable the car is parked on
  setFocus: (f: Focus | null) => void;
  clearFocus: (id: string) => void; // clears only if `id` owns the focus
  interact: () => void; // Enter / E / tap

  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  announcement: string; // aria-live text
  announce: (text: string) => void;

  sound: boolean;
  toggleSound: () => void;
  night: boolean;
  toggleNight: () => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
  reducedMotion: boolean;
  setReducedMotion: (r: boolean) => void;

  touch: TouchInput;
  setTouch: (t: Partial<TouchInput>) => void;

  cameraOverride: CameraOverride | null;
  setCameraOverride: (o: CameraOverride | null) => void;
  clearCameraOverride: (id: string) => void;

  ridge: RidgeReadout;
  setRidge: (r: RidgeReadout) => void;
  goals: number;
  addGoal: () => void;

  // Teleport requests are consumed by the vehicle (it owns the rigid body).
  teleportRequest: { zone: ZoneId; seq: number } | null;
  teleport: (zone: ZoneId) => void;
};

const stored = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: settings just don't persist
  }
};

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

let toastSeq = 0;
let teleportSeq = 0;

export const useStore = create<State>()((set, get) => ({
  phase: 'boot',
  progress: 0,
  webgl: true,
  setPhase: (phase) => set({ phase }),
  setProgress: (progress) => set({ progress }),
  setWebgl: (webgl) => set({ webgl }),
  start: () => {
    const { phase, reducedMotion } = get();
    if (phase !== 'ready') return;
    set({ phase: reducedMotion ? 'play' : 'intro' });
  },

  classicOpen: typeof window !== 'undefined' && (window.location.hash === '#classic' || new URLSearchParams(window.location.search).has('classic')),
  setClassicOpen: (classicOpen) => set({ classicOpen }),
  panel: null,
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),

  zone: null,
  setZone: (zone) => {
    if (zone === get().zone) return;
    const visited = zone && !get().visited.includes(zone) ? [...get().visited, zone] : get().visited;
    set({ zone, visited });
  },
  visited: [],
  focus: null,
  setFocus: (focus) => set({ focus }),
  clearFocus: (id) => {
    if (get().focus?.id === id) set({ focus: null });
  },
  interact: () => {
    const { focus } = get();
    if (!focus) return;
    const a = focus.action;
    if (a.kind === 'panel') set({ panel: a.panel });
    else if (a.kind === 'link') window.open(a.url, '_blank', 'noopener');
    else a.run();
  },

  toasts: [],
  toast: (text, tone = 'info') => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts.slice(-2), { id, text, tone }] });
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  announcement: '',
  announce: (text) => set({ announcement: text === get().announcement.replace(/\u200b$/, '') && !get().announcement.endsWith('\u200b') ? `${text}\u200b` : text }),

  sound: stored('sound', 'off') === 'on',
  toggleSound: () => {
    const sound = !get().sound;
    store('sound', sound ? 'on' : 'off');
    set({ sound });
  },
  night: false,
  toggleNight: () => set({ night: !get().night }),
  quality: (stored('quality', coarsePointer ? 'low' : 'high') as Quality),
  setQuality: (quality) => {
    store('quality', quality);
    set({ quality });
  },
  reducedMotion: !!prefersReducedMotion,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  touch: { throttle: 0, steer: 0, brake: false, boost: false },
  setTouch: (t) => set({ touch: { ...get().touch, ...t } }),

  cameraOverride: null,
  setCameraOverride: (cameraOverride) => set({ cameraOverride }),
  clearCameraOverride: (id) => {
    if (get().cameraOverride?.id === id) set({ cameraOverride: null });
  },

  ridge: null,
  setRidge: (ridge) => set({ ridge }),
  goals: Number(stored('goals', '0')) || 0,
  addGoal: () => {
    const goals = get().goals + 1;
    store('goals', String(goals));
    set({ goals });
  },

  teleportRequest: null,
  teleport: (zone) => set({ teleportRequest: { zone, seq: ++teleportSeq } }),
}));
