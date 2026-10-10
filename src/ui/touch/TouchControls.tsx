import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { carActions } from '../../state/car.ts';
import { useStore } from '../../state/store.ts';
import { COARSE, useMediaQuery } from '../lib.ts';
import { useUi } from '../uiStore.ts';

// Touch driving: a floating joystick wherever the left thumb lands (left 45% of the screen), hold
// buttons for brake and boost, and a horn. Writes store.touch, which the vehicle adds to the
// keyboard. Up is forward, left is steer > 0. Only this layer blocks page scroll and zoom
// (touch-action).

const RADIUS = 56; // px of knob travel for full throttle or full lock
const DEAD = 0.12; // fraction of the radius that does nothing

const RELEASED = { throttle: 0, steer: 0, brake: false, boost: false };

function shape(v: number): number {
  const a = Math.abs(v);
  if (a < DEAD) return 0;
  return Math.sign(v) * Math.min(1, (a - DEAD) / (1 - DEAD));
}

function Joystick() {
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const st = useRef({ id: -1, x: 0, y: 0, throttle: 0, steer: 0 });

  const send = (throttle: number, steer: number, force = false) => {
    const s = st.current;
    if (!force && Math.abs(throttle - s.throttle) < 0.01 && Math.abs(steer - s.steer) < 0.01) return;
    s.throttle = throttle;
    s.steer = steer;
    useStore.getState().setTouch({ throttle, steer });
  };

  const release = (e: PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (e.pointerId !== s.id) return;
    s.id = -1;
    const base = baseRef.current;
    if (base) {
      base.dataset.active = 'false';
      base.style.left = '';
      base.style.top = '';
    }
    if (knobRef.current) knobRef.current.style.transform = '';
    send(0, 0, true);
  };

  return (
    <div
      className="joy-zone"
      ref={zoneRef}
      onPointerDown={(e) => {
        const s = st.current;
        const zone = zoneRef.current;
        const base = baseRef.current;
        if (s.id !== -1 || !zone || !base) return;
        e.preventDefault();
        if (useUi.getState().map) useUi.getState().setMap(false, false); // the map would sit under the thumb
        zone.setPointerCapture(e.pointerId);
        const r = zone.getBoundingClientRect();
        s.id = e.pointerId;
        s.x = e.clientX;
        s.y = e.clientY;
        base.style.left = `${e.clientX - r.left}px`;
        base.style.top = `${e.clientY - r.top}px`;
        base.dataset.active = 'true';
        useUi.getState().countDriveInput();
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (e.pointerId !== s.id) return;
        let dx = e.clientX - s.x;
        let dy = e.clientY - s.y;
        const len = Math.hypot(dx, dy);
        if (len > RADIUS) {
          dx *= RADIUS / len;
          dy *= RADIUS / len;
        }
        if (knobRef.current) knobRef.current.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        send(shape(-dy / RADIUS), shape(-dx / RADIUS));
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="joy" ref={baseRef} data-active="false" aria-hidden="true">
        <div className="joy__ring" />
        <div className="joy__knob" ref={knobRef} />
      </div>
    </div>
  );
}

function HoldButton({ name, label }: { name: 'brake' | 'boost'; label: string }) {
  const [down, setDown] = useState(false);
  const set = (on: boolean) => {
    setDown(on);
    useStore.getState().setTouch(name === 'brake' ? { brake: on } : { boost: on });
  };
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`touch-btn touch-btn--${name}`}
      data-down={down || undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
        useUi.getState().countDriveInput();
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

// A tap, not a hold: one honk per press (the vehicle adds its own cooldown).
function HornButton() {
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      tabIndex={-1}
      className="touch-btn touch-btn--horn"
      data-down={down || undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        carActions.honk();
      }}
      onPointerUp={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onLostPointerCapture={() => setDown(false)}
      onClick={(e) => {
        if (e.detail === 0) carActions.honk(); // activated without a pointer (switch access, screen reader)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      Horn
    </button>
  );
}

export function TouchControls() {
  const coarse = useMediaQuery(COARSE);
  const phase = useStore((s) => s.phase);
  const panel = useStore((s) => s.panel);
  const classic = useStore((s) => s.classicOpen);
  const help = useUi((s) => s.help);
  const active = coarse && phase === 'play' && panel === null && !classic && !help;

  useEffect(() => {
    if (!active) return;
    // A call, an app switch or a lost touch must never leave the throttle held.
    const reset = () => useStore.getState().setTouch(RELEASED);
    const onVisibility = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', onVisibility);
      reset();
    };
  }, [active]);

  if (!active) return null;
  return (
    <div className="touch">
      <Joystick />
      <div className="touch-btns">
        <HoldButton name="boost" label="Boost" />
        <HoldButton name="brake" label="Brake" />
        <HornButton />
      </div>
    </div>
  );
}
