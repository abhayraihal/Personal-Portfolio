import { useEffect } from 'react';
import { useStore } from '../../state/store.ts';

// The classic view lives at #classic. Opening it pushes a history entry, so the browser's back
// button (or Android's back gesture) returns to the world instead of leaving the site.

const HASH = '#classic';

export function openClassic(): void {
  const s = useStore.getState();
  if (s.classicOpen) return;
  s.setClassicOpen(true);
  if (window.location.hash !== HASH) window.history.pushState({ classic: true }, '', HASH);
}

export function closeClassic(): void {
  const s = useStore.getState();
  if (!s.classicOpen || !s.webgl) return; // without WebGL the classic view is the whole site
  s.setClassicOpen(false);
  const state = window.history.state as { classic?: boolean } | null;
  if (state?.classic) window.history.back();
  else if (window.location.hash === HASH) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

export function toggleClassic(): void {
  if (useStore.getState().classicOpen) closeClassic();
  else openClassic();
}

// Keeps the store in step with the URL when the visitor navigates (back, forward, edited hash).
export function useClassicRoute(): void {
  useEffect(() => {
    const sync = () => {
      // #cv-... are section links inside the static (no-JavaScript) classic view.
      const want = window.location.hash === HASH || window.location.hash.startsWith('#cv-');
      const s = useStore.getState();
      if (want === s.classicOpen) return;
      if (want) s.setClassicOpen(true);
      else if (s.webgl) s.setClassicOpen(false);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
}
