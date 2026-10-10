import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Link } from '../data/profile.ts';

// Small helpers shared by the HTML UI. Nothing here may import three, drei or another 3D module:
// this file is part of the entry chunk.

export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // private mode: the setting just doesn't persist
    }
  },
};

export const COARSE = '(pointer: coarse)';
export const WIDE = '(min-width: 1000px)';
// Phones, tablets and narrow windows: the map sits under the contact chip and zone arrivals show
// at the top centre. Matches the media query of the same layout in hud.css.
export const COMPACT = '(max-width: 640px), (pointer: coarse)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

// Anchor attributes for a profile link: mail and phone links stay in the tab, the rest open a new one.
export function linkProps(link: Link): { href: string; target?: string; rel?: string } {
  if (link.kind === 'mail' || link.kind === 'phone') return { href: link.url };
  return { href: link.url, target: '_blank', rel: 'noopener noreferrer' };
}

// 'https://github.com/abhayraihal/scan2scope' -> 'github.com/abhayraihal/scan2scope' (print view).
export function shortUrl(url: string): string {
  return url.replace(/^mailto:/, '').replace(/^tel:/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// '2021-12-11' -> '11 Dec 2021'
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// '2021-12-11' -> 'December 2021'
export function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

// Keys typed into a text field are never shortcuts.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file', 'image'].includes(target.type);
  }
  return false;
}

// Elements that already do something with Enter (links, buttons, form controls, ARIA widgets).
export function handlesEnter(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('a[href], button, input, select, textarea, summary, [role="button"], [role="switch"], [role="radio"], [role="link"]');
}

// A button keeps focus after a mouse click, so the next Space (brake) would press it again.
// Keyboard clicks have detail 0 and keep their focus.
export function blurAfterPointer(e: { detail: number; currentTarget: HTMLElement }): void {
  if (e.detail > 0) e.currentTarget.blur();
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Keeps Tab inside `ref` while active, focuses `initial` (or the container) on activation and
// gives focus back to whatever had it before on deactivation.
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, initial?: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initial?.current ?? root).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (!items.length) {
        root.focus({ preventScroll: true });
        return;
      }
      const at = document.activeElement;
      const index = items.indexOf(at as HTMLElement);
      let next: HTMLElement | undefined;
      if (index >= 0) {
        next = items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length];
      } else if (at && root.contains(at)) {
        // Focus is on the container or a heading with tabIndex -1: step from its place in the document.
        const after = items.filter((el) => at.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        const before = items.filter((el) => at.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
        next = e.shiftKey ? (before.at(-1) ?? items.at(-1)) : (after[0] ?? items[0]);
      } else {
        next = e.shiftKey ? items.at(-1) : items[0];
      }
      next?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previous && previous.isConnected && previous !== document.body) previous.focus({ preventScroll: true });
    };
  }, [active, ref, initial]);
}

export type Presence<T> = { item: T; leaving: boolean };

// Keeps items that left `list` around for `ms` with leaving = true, in their old places, so they
// can animate out. Derived during render (React's pattern for state that follows a prop).
export function usePresence<T extends { id: number | string }>(list: T[], ms: number): Presence<T>[] {
  const [state, setState] = useState(() => ({ list, items: list.map((item) => ({ item, leaving: false })) }));
  if (state.list !== list) {
    const live = new Map(list.map((t) => [t.id, t]));
    const items: Presence<T>[] = state.items.map((p) => {
      const now = live.get(p.item.id);
      return now ? { item: now, leaving: false } : { item: p.item, leaving: true };
    });
    for (const t of list) if (!state.items.some((p) => p.item.id === t.id)) items.push({ item: t, leaving: false });
    setState({ list, items });
  }
  useEffect(() => {
    if (!state.items.some((p) => p.leaving)) return;
    const timer = window.setTimeout(() => setState((s) => ({ ...s, items: s.items.filter((p) => !p.leaving) })), ms);
    return () => window.clearTimeout(timer);
  }, [state.items, ms]);
  return state.items;
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

// White or ink text, whichever has more contrast on a '#rrggbb' background (WCAG luminance).
export function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const l = 0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / 0.0693; // ink #23262d has luminance 0.0193
  return onWhite >= onInk ? '#ffffff' : '#23262d';
}
