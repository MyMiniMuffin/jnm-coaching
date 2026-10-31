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

/**
 * Pure shell resolution (unit-tested). Duo → always rail; else sticky wide / narrow.
 * Native `data-device="duo"` / `?device=duo` feed `isDuo`; non-Duo phones must stay narrow
 * at phone viewports (no sticky).
 */
export const resolveShell = ({ isDuo, wideSticky }) => {
    if (isDuo) return SHELL_RAIL;
    return wideSticky ? SHELL_WIDE : SHELL_NARROW;
};

const computeShell = (sticky) => resolveShell({
    isDuo: isDuoDevice(),
    wideSticky: sticky,
});

/**
 * Write attributes only when they change. The MutationObserver below watches
 * data-device, and setAttribute fires a mutation even for the same value — an
 * unconditional write made every Duo resize (fold/unfold) loop forever via
 * recompute → syncDom → mutation → recompute, freezing WKWebView.
 */
const syncDom = (nextShell) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (root.getAttribute(ATTR) !== nextShell) root.setAttribute(ATTR, nextShell);
    const override = readDeviceOverride();
    if (override === 'phone') {
        if (root.hasAttribute(DEVICE_ATTR)) root.removeAttribute(DEVICE_ATTR);
    } else if (isDuoDevice() && root.getAttribute(DEVICE_ATTR) !== 'duo') {
        root.setAttribute(DEVICE_ATTR, 'duo');
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
