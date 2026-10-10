import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { playSound } from '../../state/events.ts';
import { useStore } from '../../state/store.ts';
import { openClassic } from '../classic/route.ts';
import { ClassicIcon, HelpIcon, MoonIcon, SettingsIcon, SoundOffIcon, SoundOnIcon, SunIcon } from '../icons.tsx';
import { blurAfterPointer } from '../lib.ts';
import { useUi } from '../uiStore.ts';

type ToolButtonProps = {
  label: string; // accessible name, stays the same when toggled
  tip: string; // visible tooltip, may describe the state
  shortcut?: string;
  pressed?: boolean;
  expanded?: boolean;
  id?: string;
  onClick: () => void;
  children: ReactNode;
};

function ToolButton({ label, tip, shortcut, pressed, expanded, id, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      id={id}
      className="iconbtn toolbtn has-tip"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-keyshortcuts={shortcut}
      onClick={(e) => {
        onClick();
        playSound('click');
        blurAfterPointer(e);
      }}
    >
      {children}
      <span className="tip" aria-hidden="true">
        {tip}
        {shortcut && <kbd className="key">{shortcut}</kbd>}
      </span>
    </button>
  );
}

const toggleSound = () => useStore.getState().toggleSound();
const toggleNight = () => useStore.getState().toggleNight();
const openHelp = () => useUi.getState().setHelp(true);
const toggleSettings = () => useUi.getState().setSettings(!useUi.getState().settings);

function Settings() {
  const quality = useStore((s) => s.quality);
  const reduced = useStore((s) => s.reducedMotion);
  const ref = useRef<HTMLDivElement>(null);

  // Focus moves into the popover and back to the gear when it closes (if it was still inside).
  useLayoutEffect(() => {
    const root = ref.current;
    root?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    return () => {
      if (root?.contains(document.activeElement)) document.getElementById('settings-button')?.focus({ preventScroll: true });
    };
  }, []);

  // Opening a panel (Enter on a pad) closes it too.
  useEffect(() => useStore.subscribe((s, prev) => {
    if (s.panel && !prev.panel) useUi.getState().setSettings(false);
  }), []);

  // A press anywhere outside the popover (except on the gear, which toggles it) closes it.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && !ref.current?.contains(t) && !document.getElementById('settings-button')?.contains(t)) useUi.getState().setSettings(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);

  return (
    <div className="popover" role="dialog" aria-labelledby="settings-title" ref={ref}>
      <p className="popover__title" id="settings-title">
        Settings
      </p>
      <div className="setting">
        <span className="setting__label" id="quality-label">
          Graphics
        </span>
        <div className="seg" role="group" aria-labelledby="quality-label">
          {(['high', 'low'] as const).map((q) => (
            <button
              key={q}
              type="button"
              className="seg__btn"
              aria-pressed={quality === q}
              onClick={(e) => {
                useStore.getState().setQuality(q);
                playSound('click');
                blurAfterPointer(e);
              }}
            >
              {q === 'high' ? 'High' : 'Low'}
            </button>
          ))}
        </div>
        <p className="setting__note">Low renders fewer effects at a lower resolution. Try it if driving stutters.</p>
      </div>
      <div className="setting">
        <div className="setting__row">
          <span className="setting__label" id="motion-label">
            Reduced motion
          </span>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={reduced}
            aria-labelledby="motion-label"
            onClick={(e) => {
              const store = useStore.getState();
              store.setReducedMotion(!store.reducedMotion);
              playSound('click');
              blurAfterPointer(e);
            }}
          >
            <span className="switch__thumb" />
          </button>
        </div>
        <p className="setting__note">Skips the camera glide, confetti and most animation.</p>
      </div>
    </div>
  );
}

export function Toolbar() {
  const sound = useStore((s) => s.sound);
  const night = useStore((s) => s.night);
  const settings = useUi((s) => s.settings);
  return (
    <div className="toolbar" role="group" aria-label="Site controls">
      <ToolButton label="Classic view" tip="Classic view" shortcut="C" onClick={openClassic}>
        <ClassicIcon />
      </ToolButton>
      <ToolButton label="Sound" tip={sound ? 'Sound on' : 'Sound off'} shortcut="M" pressed={sound} onClick={toggleSound}>
        {sound ? <SoundOnIcon /> : <SoundOffIcon />}
      </ToolButton>
      <ToolButton label="Night" tip={night ? 'Night' : 'Day'} shortcut="N" pressed={night} onClick={toggleNight}>
        {night ? <MoonIcon /> : <SunIcon />}
      </ToolButton>
      <ToolButton label="Help" tip="Controls" shortcut="?" onClick={openHelp}>
        <HelpIcon />
      </ToolButton>
      <ToolButton id="settings-button" label="Settings" tip="Settings" expanded={settings} onClick={toggleSettings}>
        <SettingsIcon />
      </ToolButton>
      {settings && <Settings />}
    </div>
  );
}
