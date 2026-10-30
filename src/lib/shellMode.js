/**
 * Single shell-mode store: narrow | wide | rail.
 *
 * - Duo device (`html[data-device="duo"]`, `?device=duo`, or session override): always `rail`
 * - Else enter `wide` when DUO_MEDIA_QUERY matches; stay wide while width ≥ 700
 *   (keyboard shrink); exit when width < 700; cold start without match = `narrow`
 *
 * Sets html[data-shell] synchronously at module load so first paint, Tailwind
 * `duo:` (wide | rail≥700), and React hooks agree.
 *
 * Device override uses sessionStorage only (never localStorage) so a shared
 * `?device=duo` link cannot permanently lock production users into rail.
 */
import { useSyncExternalStore } from 'react';
import { DUO_MEDIA_QUERY, DUO_MIN_WIDTH_PX } from './duoBreakpoint';

const ATTR = 'data-shell';
const DEVICE_ATTR = 'data-device';
const DEVICE_STORAGE_KEY = 'jnm_device_override';

export const SHELL_NARROW = 'narrow';
export const SHELL_WIDE = 'wide';
export const SHELL_RAIL = 'rail';

let shell = SHELL_NARROW;
let wideSticky = false;
const listeners = new Set();

const mediaMatches = () => (
    typeof window !== 'undefined' && window.matchMedia(DUO_MEDIA_QUERY).matches
);

/**
 * Dev/test override: `?device=duo|phone` writes sessionStorage for the tab only.
 * Never persists to localStorage. Reading sessionStorage lets SPA navigations
 * keep the override without locking other visits after the tab closes.
 */
export const readDeviceOverride = () => {
    if (typeof window === 'undefined') return null;
    try {
        const param = new URLSearchParams(window.location.search).get('device');
        if (param === 'duo' || param === 'phone') {
            try { window.sessionStorage.setItem(DEVICE_STORAGE_KEY, param); } catch { /* private */ }
            // Migrate away from any legacy localStorage lock.
            try { window.localStorage.removeItem(DEVICE_STORAGE_KEY); } catch { /* private */ }
            return param;
        }
        const stored = window.sessionStorage.getItem(DEVICE_STORAGE_KEY);
        if (stored === 'duo' || stored === 'phone') return stored;
    } catch { /* ignore */ }
    return null;
};

export const isDuoDevice = () => {
    if (typeof document === 'undefined') return false;
    const override = readDeviceOverride();
    if (override === 'duo') return true;
    if (override === 'phone') return false;
    return document.documentElement.getAttribute(DEVICE_ATTR) === 'duo';
};

const computeWideSticky = (previous) => {
    if (typeof window === 'undefined') return false;
    if (mediaMatches()) return true;
    if (window.innerWidth < DUO_MIN_WIDTH_PX) return false;
    return Boolean(previous);
};

const computeShell = (sticky) => {
    if (isDuoDevice()) return SHELL_RAIL;
    return sticky ? SHELL_WIDE : SHELL_NARROW;
};

const syncDom = (nextShell) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(ATTR, nextShell);
    const override = readDeviceOverride();
    if (override === 'phone') {
        document.documentElement.removeAttribute(DEVICE_ATTR);
    } else if (isDuoDevice()) {
        document.documentElement.setAttribute(DEVICE_ATTR, 'duo');
    }
};

const emit = () => {
    listeners.forEach((listener) => listener());
};

const apply = (nextSticky) => {
    const nextShell = computeShell(nextSticky);
    const changed = nextSticky !== wideSticky || nextShell !== shell;
    wideSticky = nextSticky;
    shell = nextShell;
    syncDom(shell);
    if (changed) emit();
};

const recompute = () => {
    apply(computeWideSticky(wideSticky));
};

export const getShellMode = () => shell;
/** True only for left-sidebar wide — not Duo rail (390 closed must not look like desktop). */
export const getShellWide = () => shell === SHELL_WIDE;
export const getShellRail = () => shell === SHELL_RAIL;

export const subscribeShellWide = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useShellMode = () => useSyncExternalStore(
    subscribeShellWide,
    getShellMode,
    () => SHELL_NARROW
);

/** True for left-sidebar wide shell only. */
export const useShellWide = () => useSyncExternalStore(
    subscribeShellWide,
    getShellWide,
    () => false
);

export const useShellRail = () => useSyncExternalStore(
    subscribeShellWide,
    getShellRail,
    () => false
);

// Synchronous init before first React render (import from main.jsx).
if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(DEVICE_STORAGE_KEY); } catch { /* private */ }
    readDeviceOverride();
    wideSticky = mediaMatches();
    shell = computeShell(wideSticky);
    syncDom(shell);

    const media = window.matchMedia(DUO_MEDIA_QUERY);
    const onChange = () => recompute();
    media.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);

    // Native WKUserScript (or late injection) may set data-device after module load.
    const mo = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === DEVICE_ATTR) {
                recompute();
                break;
            }
        }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: [DEVICE_ATTR] });

    import.meta.hot?.dispose(() => {
        media.removeEventListener('change', onChange);
        window.removeEventListener('resize', onChange);
        mo.disconnect();
        listeners.clear();
    });
}
