import { useEffect, useMemo, useState } from 'react';
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
// Decided once, when the first zone toast arrives, outside React: the zone toasts remount when
// the layout switches between phone and desktop.
const skipped = new Set<number>();
let decided = false;
useStore.subscribe((s) => {
  const first = decided ? undefined : s.toasts.find((t) => t.tone === 'zone');
  if (!first) return;
  decided = true;
  if (first.text === SPAWN_TITLE) skipped.add(first.id);
});

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

function ToastStack({ toasts, className }: { toasts: Toast[]; className: string }) {
  const items = usePresence(toasts, TOAST_EXIT_MS);
  return (
    <div className={className}>
      {items.map(({ item, leaving }) => (
        <ToastView key={item.id} toast={item} leaving={leaving} />
      ))}
    </div>
  );
}

// Zone arrivals, newest only: next to the map on desktop, at the top centre on phones (Hud picks
// the spot). Screen readers get toasts through the live region (store.announce), so the stacks
// themselves are not live.
export function ZoneToasts() {
  const toasts = useStore((s) => s.toasts);
  const shown = useMemo(() => toasts.filter((t) => t.tone === 'zone' && !skipped.has(t.id)).slice(-1), [toasts]);
  return <ToastStack toasts={shown} className="toasts toasts--zone" />;
}

// Wins and notes (a goal, the ridge summit, every project seen), top centre.
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const shown = useMemo(() => toasts.filter((t) => t.tone !== 'zone'), [toasts]);
  return <ToastStack toasts={shown} className="toasts" />;
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

// First-time controls. With a keyboard, the hub road already has them painted on it, so the hint
// waits until the car leaves the hub before any driving (a jump with 1 to 7); driving out of the
// hub counts as having read the road. On touch it shows from the start. While the interact prompt
// is up, the prompt itself covers the "stop on a ring" part.
export function ControlsHint() {
  const phase = useStore((s) => s.phase);
  const zone = useStore((s) => s.zone);
  const prompt = useStore((s) => s.focus !== null && s.panel === null);
  const done = useUi((s) => s.hintDone);
  const inputs = useUi((s) => s.driveInputs);
  const coarse = useMediaQuery(COARSE);
  const [away, setAway] = useState(false);
  const leftHub = zone !== null && zone !== 'hub';
  if (!coarse && !away && !done && leftHub && inputs === 0) setAway(true);
  const show = phase === 'play' && !done && (coarse || away);
  const fading = inputs >= HINT_INPUTS;

  useEffect(() => {
    if (!coarse && !away && !done && leftHub && inputs > 0) useUi.getState().finishHint();
  }, [coarse, away, done, leftHub, inputs]);

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
          {!prompt && <span className="hint__item">Stop on a ring, then tap the button</span>}
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
          {!prompt && (
            <span className="hint__item">
              Stop on a ring, then <kbd className="key">Enter</kbd>
            </span>
          )}
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
