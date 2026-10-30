/**
 * Single shell-mode store: wide vs narrow.
 *
 * Enter wide when DUO_MEDIA_QUERY matches. Stay wide while width ≥ 700 even if
 * height collapses (on-screen keyboard). Exit only when width < 700.
 * Cold start without a media match is always narrow (no sticky memory).
 *
 * Sets html[data-shell="wide"|"narrow"] synchronously at module load so the
 * first paint and Tailwind `duo:` (attribute variant) agree with useDesktop.
 */
import { useSyncExternalStore } from 'react';
import { DUO_MEDIA_QUERY, DUO_MIN_WIDTH_PX } from './duoBreakpoint';

const ATTR = 'data-shell';
const WIDE = 'wide';
const NARROW = 'narrow';

let wide = false;
const listeners = new Set();

const mediaMatches = () => (
    typeof window !== 'undefined' && window.matchMedia(DUO_MEDIA_QUERY).matches
);

const computeWide = (previous) => {
    if (typeof window === 'undefined') return false;
    if (mediaMatches()) return true;
    if (window.innerWidth < DUO_MIN_WIDTH_PX) return false;
    return Boolean(previous);
};

const syncDom = (isWide) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(ATTR, isWide ? WIDE : NARROW);
};

const emit = () => {
    listeners.forEach((listener) => listener());
};

const setWide = (next) => {
    const changed = next !== wide;
    wide = next;
    syncDom(wide);
    if (changed) emit();
};

const recompute = () => {
    setWide(computeWide(wide));
};

export const getShellWide = () => wide;

export const subscribeShellWide = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** React binding — every consumer shares this store (no per-instance sticky). */
export const useShellWide = () => useSyncExternalStore(
    subscribeShellWide,
    getShellWide,
    () => false
);

// Synchronous init before first React render (import this module from main.jsx).
if (typeof window !== 'undefined') {
    wide = mediaMatches();
    syncDom(wide);

    const media = window.matchMedia(DUO_MEDIA_QUERY);
    const onChange = () => recompute();
    media.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
}
