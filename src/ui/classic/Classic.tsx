import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../../state/store.ts';
import { ClassicView } from './ClassicView.tsx';
import { closeClassic, useClassicRoute } from './route.ts';

const print = () => window.print();

// Opens over the world (C, the toolbar, the card or #classic), or is the whole site without
// WebGL. Printing from the world (Cmd/Ctrl+P) also prints this page, not the canvas.
export function Classic() {
  const open = useStore((s) => s.classicOpen);
  const webgl = useStore((s) => s.webgl);
  const [printing, setPrinting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Loaded at #classic: the pre-rendered page was already on screen, so no fade-in (it would
  // flash the card underneath while React takes over).
  const openedAtLoad = useRef(open);
  if (!open) openedAtLoad.current = false;
  useClassicRoute();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected && previous !== document.body) previous.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const before = () => {
      if (!useStore.getState().classicOpen) flushSync(() => setPrinting(true));
    };
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  if (open) return <ClassicView mode={webgl ? 'overlay' : 'standalone'} enter={!openedAtLoad.current} onClose={closeClassic} onPrint={print} headingRef={headingRef} />;
  if (printing) return <ClassicView mode="print" />;
  return null;
}
