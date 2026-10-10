import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useStore } from '../../state/store.ts';
import { openClassic } from '../classic/route.ts';
import { CardView } from './CardView.tsx';

const SLOW_MS = 10_000; // after this long without a scene, point at the classic view

const onClassic = (e: MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  openClassic();
};
const onStart = () => useStore.getState().start();

// The recruiter card over the idle scene. On Start it shrinks into the contact chip (top left):
// the card scales down so its photo lands on the chip's photo, then fades as the chip fades in.
export function Card() {
  const phase = useStore((s) => s.phase);
  const progress = useStore((s) => s.progress);
  const started = phase === 'intro' || phase === 'play';
  const [gone, setGone] = useState(started);
  const [slow, setSlow] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (phase !== 'boot') return;
    const t = window.setTimeout(() => setSlow(true), Math.max(0, SLOW_MS - performance.now()));
    return () => window.clearTimeout(t);
  }, [phase]);

  useLayoutEffect(() => {
    if (!started || gone) return;
    const card = cardRef.current;
    if (!card || typeof card.animate !== 'function') {
      setGone(true);
      return;
    }
    const reduced = useStore.getState().reducedMotion;
    const from = photoRef.current?.getBoundingClientRect();
    const to = document.querySelector('.chip__photo')?.getBoundingClientRect();
    let anim: Animation;
    if (reduced || !from || !to || from.width === 0) {
      anim = card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 150 : 240, fill: 'forwards' });
    } else {
      const box = card.getBoundingClientRect();
      const s = to.width / from.width;
      const tx = to.left - box.left - s * (from.left - box.left);
      const ty = to.top - box.top - s * (from.top - box.top);
      const end = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
      card.style.transformOrigin = '0 0';
      anim = card.animate(
        [
          { transform: 'none', opacity: 1, easing: 'cubic-bezier(0.6, 0, 0.3, 1)' },
          { transform: end, opacity: 0.9, offset: 0.72 },
          { transform: end, opacity: 0 },
        ],
        { duration: 660, fill: 'forwards' },
      );
    }
    anim.onfinish = () => setGone(true);
    return () => {
      anim.onfinish = null;
    };
  }, [started, gone]);

  if (gone) return null;
  return (
    <div className="card-layer" inert={started || undefined}>
      <CardView phase={phase} progress={progress} slow={slow && phase === 'boot'} onStart={onStart} onClassic={onClassic} cardRef={cardRef} photoRef={photoRef} />
    </div>
  );
}
