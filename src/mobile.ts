import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { PHONE_Q, useStore } from './store';

/** True on phones (narrow screen, or a coarse-pointer device in landscape). Same query the CSS uses. */
export function useIsPhone() {
  const [v, setV] = useState(() => matchMedia(PHONE_Q).matches);
  useEffect(() => {
    const m = matchMedia(PHONE_Q), f = () => setV(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return v;
}
export const isTouch = () => matchMedia('(pointer: coarse)').matches;

/** Mirrors visualViewport into --vvh / --vvtop so the app shrinks above the soft keyboard (iOS doesn't resize the layout viewport). */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport, r = document.documentElement;
    const f = () => {
      r.style.setProperty('--vvh', `${vv?.height ?? innerHeight}px`);
      r.style.setProperty('--vvtop', `${vv?.offsetTop ?? 0}px`);
    };
    f();
    vv?.addEventListener('resize', f); vv?.addEventListener('scroll', f); addEventListener('resize', f);
    return () => { vv?.removeEventListener('resize', f); vv?.removeEventListener('scroll', f); removeEventListener('resize', f); };
  }, []);
}
/** Visible height as React state (used for the Theme Studio sheet geometry). */
export function useVvHeight() {
  const [h, setH] = useState(() => window.visualViewport?.height ?? innerHeight);
  useEffect(() => {
    const vv = window.visualViewport, f = () => setH(vv?.height ?? innerHeight);
    vv?.addEventListener('resize', f); addEventListener('resize', f);
    return () => { vv?.removeEventListener('resize', f); removeEventListener('resize', f); };
  }, []);
  return h;
}

// ---- editor focus (tiny external store): drives the format bar and body.editing ----
let focused = false;
const subs = new Set<() => void>();
export function setEditorFocused(v: boolean) {
  if (focused === v) return;
  focused = v; document.body.classList.toggle('editing', v); subs.forEach((f) => f());
}
export const useEditorFocused = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => focused);

// ---- swipe gestures (pointer events, only attached to the top bar / status bar) ----
interface SwipeCbs { left?: () => void; right?: () => void; up?: () => void; down?: () => void }
// gesture state lives at module level: the status bar re-renders every second, which would otherwise reset a swipe in progress
let sx = 0, sy = 0, t = 0, on = false;
export function swipe(cb: SwipeCbs) {
  return {
    className: 'swipe',
    onPointerDown: (e: RPointerEvent) => { sx = e.clientX; sy = e.clientY; t = Date.now(); on = true; },
    onPointerCancel: () => { on = false; },
    onPointerUp: (e: RPointerEvent) => {
      if (!on) return; on = false;
      const dx = e.clientX - sx, dy = e.clientY - sy, ax = Math.abs(dx), ay = Math.abs(dy);
      if (Date.now() - t > 700) return;
      if (ax > 60 && ax > ay * 1.5) (dx < 0 ? cb.left : cb.right)?.();
      else if (ay > 40 && ay > ax * 1.5) (dy < 0 ? cb.up : cb.down)?.();
    },
  };
}
/** Swipe left → Preview, right → Edit, up → Theme Studio. */
export const useBarSwipe = () => swipe({
  left: () => useStore.getState().setMode('preview'),
  right: () => useStore.getState().setMode('focus'),
  up: () => useStore.setState({ studioOpen: true }),
});
