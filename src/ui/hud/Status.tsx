import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { SPAWN, ZONES, zoneAt } from '../../config/layout.ts';
import { contests } from '../../data/codeforces.ts';
import { useStore } from '../../state/store.ts';
import type { Toast } from '../../state/store.ts';
import { ExternalIcon } from '../icons.tsx';
import { COARSE, blurAfterPointer, formatDate, textOn, useMediaQuery, usePresence } from '../lib.ts';
import { useUi } from '../uiStore.ts';

const TOAST_EXIT_MS = 260;
// The car starts in this zone. Its arrival toast right after Start would only cover the view the
// camera glides down to, so the first one is skipped (the live region still announces it).
const SPAWN_TITLE = zoneAt(SPAWN.u, SPAWN.v)?.title;

function ToastView({ toast, leaving }: { toast: Toast; leaving: boolean }) {
  const zone = toast.tone === 'zone' ? ZONES.find((z) => z.title === toast.text) : undefined;
  if (zone) {
    return (
      <div className="toast toast--zone" data-leaving={leaving || undefined} style={{ '--zone': zone.color, '--zone-text': textOn(zone.color) } as CSSProperties}>
        <span className="toast__key" aria-hidden="true">
          {zone.key}
        </span>
        <span className="toast__text">
          <span className="toast__title">{zone.title}</span>
          <span className="toast__sub">{zone.subtitle}</span>
        </span>
      </div>
    );
  }
  return (
    <div className={`toast toast--${toast.tone ?? 'info'}`} data-leaving={leaving || undefined}>
      <span className="toast__title">{toast.text}</span>
    </div>
  );
}

// Zone arrivals and wins, top centre. Screen readers get these through the live region
// (store.announce), so the stack itself is not live.
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const skip = useRef<number | null | undefined>(undefined); // id of the skipped toast, once known
  if (skip.current === undefined) {
    const first = toasts.find((t) => t.tone === 'zone');
    if (first) skip.current = first.text === SPAWN_TITLE ? first.id : null;
  }
  const hidden = skip.current;
  const shown = useMemo(() => (hidden == null ? toasts : toasts.filter((t) => t.id !== hidden)), [toasts, hidden]);
  const items = usePresence(shown, TOAST_EXIT_MS);
  return (
    <div className="toasts">
      {items.map(({ item, leaving }) => (
        <ToastView key={item.id} toast={item} leaving={leaving} />
      ))}
    </div>
  );
}

// Contest readout while the car is on the rating ridge.
export function RidgeStrip() {
  const ridge = useStore((s) => s.ridge);
  if (!ridge) return null;
  const contest = contests[ridge.index];
  const delta = contest && contest.oldRating > 0 ? contest.newRating - contest.oldRating : null;
  return (
    <div className="ridge">
      <span className="ridge__count">
        Contest {ridge.index + 1} of {contests.length}
      </span>
      <span className="ridge__main">
        <span className="ridge__name">{ridge.name}</span>
        <span className="ridge__date">{formatDate(ridge.date)}</span>
      </span>
      <span className="ridge__rating">
        <strong>{ridge.rating}</strong>
        {delta !== null && (
          <span className="ridge__delta" data-sign={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}>
            {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '0'}
          </span>
        )}
      </span>
      <span className="ridge__rank" style={{ '--rank': ridge.color } as CSSProperties}>
        <span className="ridge__swatch" aria-hidden="true" />
        {ridge.rank}
      </span>
    </div>
  );
}

// "Enter: <label>" while the car is parked on a pad. Also a button: click or tap to interact.
export function Prompt() {
  const focus = useStore((s) => s.focus);
  const panel = useStore((s) => s.panel);
  const phase = useStore((s) => s.phase);
  if (!focus || panel || phase !== 'play') return null;
  const external = focus.action.kind === 'link';
  return (
    <button
      type="button"
      className="prompt"
      aria-label={external ? `${focus.label}, opens in a new tab` : focus.label}
      onClick={(e) => {
        useStore.getState().interact();
        blurAfterPointer(e);
      }}
    >
      <kbd className="key prompt__key">Enter</kbd>
      <span className="prompt__label">{focus.label}</span>
      {external && <ExternalIcon />}
    </button>
  );
}

const HINT_INPUTS = 4; // driving inputs before the first-time hint fades

export function ControlsHint() {
  const phase = useStore((s) => s.phase);
  const done = useUi((s) => s.hintDone);
  const inputs = useUi((s) => s.driveInputs);
  const coarse = useMediaQuery(COARSE);
  const show = phase === 'play' && !done;
  const fading = inputs >= HINT_INPUTS;

  useEffect(() => {
    if (!show || !fading) return;
    const t = window.setTimeout(() => useUi.getState().finishHint(), 700);
    return () => window.clearTimeout(t);
  }, [show, fading]);

  if (!show) return null;
  return (
    <div className="hint" data-leaving={fading || undefined}>
      {coarse ? (
        <>
          <span className="hint__item">
            <span className="hint__stick" aria-hidden="true" />
            Drag on the left to drive
          </span>
          <span className="hint__item">Hold Brake or Boost</span>
          <span className="hint__item">Stop on a ring, then tap the button</span>
        </>
      ) : (
        <>
          <span className="hint__item">
            <span className="hint__keys" aria-hidden="true">
              <kbd className="key">W</kbd>
              <kbd className="key">A</kbd>
              <kbd className="key">S</kbd>
              <kbd className="key">D</kbd>
            </span>
            <span className="sr-only">W A S D</span> or arrow keys to drive
          </span>
          <span className="hint__item">
            <kbd className="key">Space</kbd> brake
          </span>
          <span className="hint__item">
            <kbd className="key">Shift</kbd> boost
          </span>
          <span className="hint__item">
            Stop on a ring, then <kbd className="key">Enter</kbd>
          </span>
        </>
      )}
    </div>
  );
}

// Covers the screen for a moment while the car teleports.
export function Fade() {
  const on = useUi((s) => s.fade);
  return <div className="fade" data-on={on} aria-hidden="true" />;
}

export function LiveRegion() {
  const text = useStore((s) => s.announcement);
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {text}
    </p>
  );
}
