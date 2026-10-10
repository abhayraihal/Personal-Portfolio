import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../../state/store.ts';
import { CloseIcon, KeyboardIcon, TouchIcon } from '../icons.tsx';
import { useFocusTrap } from '../lib.ts';
import { useUi } from '../uiStore.ts';

const close = () => useUi.getState().setHelp(false);

const k = (...keys: string[]) => keys.map((key) => <kbd className="key" key={key}>{key}</kbd>);

const KEYBOARD: [string, ReactNode][] = [
  ['Drive', <>{k('W', 'A', 'S', 'D')} or arrow keys</>],
  ['Brake', k('Space')],
  ['Boost', k('Shift')],
  ['Read about what you are parked on', <>{k('Enter')} or {k('E')}</>],
  ['Close a panel', <>{k('Esc')} or {k('Enter')}</>],
  ['Jump to a zone', <>{k('1')} to {k('7')}, or click the map</>],
  ['Reset the car', k('R')],
  ['Horn', k('H')],
  ['Zoom', 'Mouse wheel or trackpad pinch'],
  ['Classic view', k('C')],
  ['Sound on or off', k('M')],
  ['Day or night', k('N')],
  ['This list', k('?')],
];

const TOUCH: [string, ReactNode][] = [
  ['Drive', 'Drag anywhere on the left half of the screen'],
  ['Brake and boost', 'Hold the buttons at the bottom right'],
  ['Read about something', 'Stop on a ring, then tap the button that appears'],
  ['Jump to a zone', 'Open the map and tap a zone'],
  ['Zoom', 'Pinch with two fingers on the right half'],
  ['Classic view, sound, night', 'Buttons at the top right'],
];

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="help__rows">
      {rows.map(([what, how]) => (
        <div className="help__row" key={what}>
          <dt>{what}</dt>
          <dd>{how}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Help() {
  const open = useUi((s) => s.help);
  const classic = useStore((s) => s.classicOpen);
  const ref = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useFocusTrap(ref, open && !classic, titleRef);
  if (!open) return null;
  return (
    <div
      className="help-layer"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section className="help" role="dialog" aria-modal="true" aria-labelledby="help-title" ref={ref} tabIndex={-1}>
        <header className="help__head">
          <h2 className="help__title" id="help-title" tabIndex={-1} ref={titleRef}>
            Controls
          </h2>
          <button type="button" className="iconbtn" aria-label="Close" aria-keyshortcuts="Escape" onClick={close}>
            <CloseIcon />
          </button>
        </header>
        <div className="help__cols">
          <section className="help__col">
            <h3>
              <KeyboardIcon /> Keyboard
            </h3>
            <Rows rows={KEYBOARD} />
          </section>
          <section className="help__col">
            <h3>
              <TouchIcon /> Touch
            </h3>
            <Rows rows={TOUCH} />
          </section>
        </div>
        <p className="help__foot">
          Rather read than drive? Press <kbd className="key">C</kbd> for the classic view, with everything on one page.
        </p>
      </section>
    </div>
  );
}
