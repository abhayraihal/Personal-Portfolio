// Tiny typed event bus for one-off happenings that several modules react to (sound, confetti, toasts).

export type SoundName =
  | 'click' | 'open' | 'close' | 'pad' | 'zone' | 'goal' | 'win' | 'horn' | 'teleport' | 'coin' | 'whoosh' | 'thud' | 'splash';

export type Events = {
  // Something hit something. strength is roughly the closing speed in m/s.
  impact: { strength: number; x: number; y: number; z: number; material?: 'wood' | 'metal' | 'stone' | 'soft' };
  confetti: { x: number; y: number; z: number; colors?: string[]; count?: number };
  sound: { name: SoundName; volume?: number };
  // The car was moved by a teleport or reset; listeners can snap cameras or reset state.
  teleported: { x: number; z: number; yaw: number };
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

const handlers = new Map<keyof Events, Set<(payload: never) => void>>();

export const events = {
  on<K extends keyof Events>(type: K, fn: Handler<K>): () => void {
    let set = handlers.get(type);
    if (!set) handlers.set(type, (set = new Set()));
    set.add(fn as (payload: never) => void);
    return () => {
      set.delete(fn as (payload: never) => void);
    };
  },
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    handlers.get(type)?.forEach((fn) => (fn as Handler<K>)(payload));
  },
};

export const playSound = (name: SoundName, volume?: number) => events.emit('sound', { name, volume });
