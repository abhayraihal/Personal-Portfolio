import type { Mesh } from 'three';

// The troika text mesh behind <Label>. Counters set `text` and call sync() to relayout without a
// React render; they also render their latest string as the Label's children, so a re-render
// keeps it.
export type TextMesh = Mesh & { text: string; sync: (callback?: () => void) => void };

// Changes a label's text without a React render. `last` holds the string the Label renders.
export function setLabelText(mesh: TextMesh | null, last: { current: string }, text: string) {
  if (last.current === text) return;
  last.current = text;
  if (!mesh) return;
  mesh.text = text;
  mesh.sync();
}
