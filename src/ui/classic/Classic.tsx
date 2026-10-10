import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../../state/store.ts';
import { ClassicView } from './ClassicView.tsx';
import { closeClassic, useClassicRoute } from './route.ts';

const print = () => window.print();

// The pre-rendered page shows the classic view at #classic, or at one of its sections (#cv-...)
// when a contents link was followed before the scripts ran.
const LOAD_HASH = typeof window === 'undefined' ? '' : window.location.hash;
const LOADED_IN_CLASSIC = LOAD_HASH === '#classic' || LOAD_HASH.startsWith('#cv-');

// Opens over the world (C, the toolbar, the card or #classic), or is the whole site without
// WebGL. Printing from the world (Cmd/Ctrl+P) also prints this page, not the canvas.
export function Classic() {
  const open = useStore((s) => s.classicOpen);
  const webgl = useStore((s) => s.webgl);
  const [printing, setPrinting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Loaded in the classic view: the pre-rendered page was already on screen, so no fade-in (it
  // would flash the card underneath while React takes over). Later openings fade in.
  const fadeIn = useRef(!LOADED_IN_CLASSIC);
  const wasOpen = useRef(open);
  if (wasOpen.current && !open) fadeIn.current = true;
  wasOpen.current = open;
  const jumpTo = useRef<string | null>(null);
  useClassicRoute();

  // Loaded at a section: open the classic view there (before the first paint, so the card never
  // shows), and keep #classic as the route.
  useLayoutEffect(() => {
    if (!LOAD_HASH.startsWith('#cv-')) return;
    jumpTo.current = LOAD_HASH.slice(1);
    window.history.replaceState(window.history.state, '', '#classic');
    useStore.getState().setClassicOpen(true);
  }, []);
  useEffect(() => {
    if (!open || !jumpTo.current) return;
    document.getElementById(jumpTo.current)?.scrollIntoView({ block: 'start' });
    jumpTo.current = null;
  }, [open]);

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

  if (open) return <ClassicView mode={webgl ? 'overlay' : 'standalone'} enter={fadeIn.current} onClose={closeClassic} onPrint={print} headingRef={headingRef} />;
  if (printing) return <ClassicView mode="print" />;
  return null;
}
