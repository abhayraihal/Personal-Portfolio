import { create } from 'zustand';

// Lives in the entry chunk. The 3D chunk writes loader progress here, so the overlay never has to
// import drei or three.
type GameState = {
  ready: boolean;
  progress: number;
  loading: boolean;
  setReady: (ready: boolean) => void;
  setProgress: (progress: number, loading: boolean) => void;
};

export const useGame = create<GameState>()((set) => ({
  ready: false,
  progress: 0,
  loading: false,
  setReady: (ready) => set({ ready }),
  setProgress: (progress, loading) => set({ progress, loading }),
}));
