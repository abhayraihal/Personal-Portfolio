import type { KeyboardControlsEntry } from '@react-three/drei';

export type ControlName = 'forward' | 'backward' | 'left' | 'right' | 'brake' | 'boost' | 'reset' | 'horn';

// drei matches event.key first, then event.code. Codes keep Shift+W working (event.key becomes "W").
export const KEYMAP: KeyboardControlsEntry<ControlName>[] = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'brake', keys: ['Space'] },
  { name: 'boost', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'reset', keys: ['KeyR'] },
  { name: 'horn', keys: ['KeyH'] },
];
