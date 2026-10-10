import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { panels } from '../../data/profile.ts';
import type { PanelId } from '../../data/profile.ts';
import { useStore } from '../../state/store.ts';
import { CloseIcon } from '../icons.tsx';
import { useFocusTrap } from '../lib.ts';
import { useUi } from '../uiStore.ts';
import { PanelContent } from './PanelContent.tsx';

const EXIT_MS = 220; // matches the sheet-out animation in sheet.css

const close = () => useStore.getState().closePanel();
const open = (id: PanelId) => useStore.getState().openPanel(id);

// The reading panel: a sheet on the right on desktop, a bottom sheet on phones. Modal: focus is
// trapped inside and the HUD is inert. Esc, Enter, the close button or the backdrop close it.
export function PanelSheet() {
  const id = useStore((s) => s.panel);
  const last = useRef<PanelId | null>(id);
  if (id) last.current = id;
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const sheetRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Help and the classic view can open on top of a panel; they take the focus until they close.
  const help = useUi((s) => s.help);
  const classic = useStore((s) => s.classicOpen);
  useFocusTrap(sheetRef, id !== null && !help && !classic, titleRef);

  // Keep the last panel on screen while it animates out.
  useEffect(() => {
    if (id) return;
    const t = window.setTimeout(() => {
      last.current = null;
      rerender();
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [id]);

  // "Next" swaps the content in place: back to the top, focus on the new title. The button that
  // was pressed is gone by now, so focus has usually dropped to <body>.
  const prevId = useRef<PanelId | null>(id);
  useLayoutEffect(() => {
    const prev = prevId.current;
    prevId.current = id;
    if (!id || !prev || prev === id) return;
    bodyRef.current?.scrollTo({ top: 0 });
    const active = document.activeElement;
    if (!active || active === document.body || sheetRef.current?.contains(active)) titleRef.current?.focus({ preventScroll: true });
  }, [id]);

  const shown = id ?? last.current;
  if (!shown) return null;
  const panel = panels[shown];
  const closing = id === null;
  return (
    <div className="sheet-layer" data-state={closing ? 'closing' : 'open'} inert={closing || undefined}>
      <div className="sheet-backdrop" onClick={close} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={sheetRef} tabIndex={-1}>
        <header className="sheet__head">
          <span className="sheet__grip" aria-hidden="true" />
          {panel.kicker && <p className="sheet__kicker">{panel.kicker}</p>}
          <h2 className="sheet__title" id="sheet-title" tabIndex={-1} ref={titleRef}>
            {panel.title}
          </h2>
          <button type="button" className="iconbtn sheet__close" aria-label="Close" aria-keyshortcuts="Escape" onClick={close}>
            <CloseIcon />
          </button>
        </header>
        <div className="sheet__body" ref={bodyRef}>
          <PanelContent panel={panel} onOpen={open} />
        </div>
        <footer className="sheet__foot" aria-hidden="true">
          <span className="for-fine">
            <kbd className="key">Esc</kbd> or <kbd className="key">Enter</kbd> to close
          </span>
          <span className="for-coarse">Tap outside the panel to close it</span>
        </footer>
      </section>
    </div>
  );
}
