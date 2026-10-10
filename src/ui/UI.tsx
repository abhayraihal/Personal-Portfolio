import { useEffect } from 'react';
import { ZONES } from '../config/layout.ts';
import { jobs, panels, profile } from '../data/profile.ts';
import { useStore } from '../state/store.ts';

// PLACEHOLDER UI (spine). The UI module replaces this with the recruiter card, HUD, minimap,
// panels, classic view, touch controls and settings.
export function UI() {
  const phase = useStore((s) => s.phase);
  const progress = useStore((s) => s.progress);
  const focus = useStore((s) => s.focus);
  const panel = useStore((s) => s.panel);
  const toasts = useStore((s) => s.toasts);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.repeat) return;
      if (s.phase === 'ready' && (e.code === 'Enter' || e.code === 'KeyW' || e.code === 'ArrowUp')) s.start();
      else if (e.code === 'Escape') s.closePanel();
      else if (s.phase === 'play' && (e.code === 'Enter' || e.code === 'KeyE')) {
        if (s.panel) s.closePanel();
        else if (s.focus) s.interact();
      } else if (s.phase === 'play') {
        const z = ZONES.find((zone) => `Digit${zone.key}` === e.code);
        if (z) s.teleport(z.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const p = panel ? panels[panel] : null;
  return (
    <div className="ui">
      {(phase === 'boot' || phase === 'ready') && (
        <div className="card">
          <h1>{profile.name}</h1>
          <p>{profile.roleLine}</p>
          <ul>{jobs.map((j) => <li key={j.company}>{j.company} · {j.role} · {j.dates}</li>)}</ul>
          <button className="start" disabled={phase !== 'ready'} onClick={() => useStore.getState().start()}>
            {phase === 'ready' ? 'Start driving' : `Loading ${Math.round(progress)}%`}
          </button>
        </div>
      )}
      {focus && !panel && <div className="prompt">Enter: {focus.label}</div>}
      {p && (
        <div className="panel" role="dialog" aria-label={p.title}>
          <button onClick={() => useStore.getState().closePanel()}>Close</button>
          <h2>{p.title}</h2>
          {p.body?.map((b, i) => <p key={i}>{b}</p>)}
          {p.bullets && <ul>{p.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        </div>
      )}
      <div className="toasts">{toasts.map((t) => <div key={t.id}>{t.text}</div>)}</div>
    </div>
  );
}
