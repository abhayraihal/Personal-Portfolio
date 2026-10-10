import { create } from 'zustand';
import { storage } from './lib.ts';

// State that only the HTML UI cares about. App-wide state (phase, panel, sound...) is in
// state/store.ts.

const MAP_KEY = 'ui.map';
const HINT_KEY = 'ui.hint';

type UiState = {
  help: boolean;
  setHelp: (open: boolean) => void;
  settings: boolean;
  setSettings: (open: boolean) => void;
  // Minimap expanded? null until the visitor chooses, then the default depends on the device.
  // remember = false for automatic collapses (after a pick on a phone, Esc), which last the visit.
  map: boolean | null;
  setMap: (open: boolean, remember?: boolean) => void;
  fade: boolean; // teleport fade overlay
  setFade: (on: boolean) => void;
  // First-time controls hint: counts driving inputs until it fades.
  hintDone: boolean;
  driveInputs: number;
  countDriveInput: () => void;
  finishHint: () => void;
};

const savedMap = storage.get(MAP_KEY);

export const useUi = create<UiState>()((set, get) => ({
  help: false,
  setHelp: (help) => set({ help, settings: false }),
  settings: false,
  setSettings: (settings) => set({ settings }),
  map: savedMap === 'open' ? true : savedMap === 'closed' ? false : null,
  setMap: (map, remember = true) => {
    if (remember) storage.set(MAP_KEY, map ? 'open' : 'closed');
    set({ map });
  },
  fade: false,
  setFade: (fade) => set({ fade }),
  hintDone: storage.get(HINT_KEY) === 'done',
  driveInputs: 0,
  countDriveInput: () => {
    if (!get().hintDone) set({ driveInputs: get().driveInputs + 1 });
  },
  finishHint: () => {
    storage.set(HINT_KEY, 'done');
    set({ hintDone: true });
  },
}));
