// Android-only "installer appen"-popup (PWA install via beforeinstallprompt).
// Ren portlogikk øverst (testbar uten nettleser), og en liten modulstore under som
// fanger hendelsen tidlig, slik at den ikke går tapt før React har montert.

export const INSTALL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const INSTALL_DISMISSED_KEY = 'jnm_install_dismissed_at';
export const INSTALL_INSTALLED_KEY = 'jnm_install_installed';
export const INSTALL_SESSION_KEY = 'jnm_install_shown';

export const isIosLike = (userAgent = '', maxTouchPoints = 0) =>
    /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

// UA brukes kun som plattformsgrense. Selve porten er beforeinstallprompt.
export const isAndroidWeb = (userAgent = '', maxTouchPoints = 0) =>
    /Android/i.test(userAgent) && !isIosLike(userAgent, maxTouchPoints);

export const shouldShowInstallPrompt = ({
    userAgent = '',
    maxTouchPoints = 0,
    isNative = false,
    isStandalone = false,
    hasDeferredPrompt = false,
    now = Date.now(),
    dismissedAt = null,
    installedFlag = false,
    shownThisSession = false,
    engaged = false,
    modalOpen = false,
} = {}) => {
    if (!isAndroidWeb(userAgent, maxTouchPoints)) return false;
    if (isNative || isStandalone) return false;
    if (!hasDeferredPrompt) return false;
    if (installedFlag || shownThisSession) return false;
    if (!engaged || modalOpen) return false;
    const dismissed = Number(dismissedAt);
    // Tidsstempel i fremtiden (klokkeavvik) er ugyldig og ignoreres.
    if (Number.isFinite(dismissed) && dismissed > 0 && dismissed <= now && now - dismissed < INSTALL_COOLDOWN_MS) return false;
    return true;
};

// --- Ankomstvern og "midt i interaksjon" (ren logikk, testbar uten nettleser) ---
export const INSTALL_ARRIVAL_GUARD_MS = 700;
export const INSTALL_SCROLL_QUIET_MS = 300;
export const INSTALL_STALE_POINTER_MS = 10000;
export const INSTALL_GESTURE_MS = 4000;

// Et trykk er "vernet" hvis det startet før popupen dukket opp eller innenfor vernevinduet.
// Alle tidsstempler er på samme klokke (performance.now() / event.timeStamp).
export const isGuardedPointer = (shownAt, pointerDownTimeStamp, guardMs = INSTALL_ARRIVAL_GUARD_MS) =>
    pointerDownTimeStamp < shownAt + guardMs;

export const isEditableElement = (el) => {
    if (!el || typeof el !== 'object') return false;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable === true;
};

const defaultClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const createArrivalGuard = ({
    guardMs = INSTALL_ARRIVAL_GUARD_MS,
    scrollQuietMs = INSTALL_SCROLL_QUIET_MS,
    now = defaultClock,
} = {}) => {
    const down = new Map(); // pointerId -> timeStamp
    let lastDownAt = null;
    let lastScrollAt = -Infinity;
    let shownAt = null;

    const pruneDowns = (t) => {
        for (const [id, at] of down) {
            if (t - at > INSTALL_STALE_POINTER_MS) down.delete(id);
        }
    };
    const onPointerDown = (event) => {
        const at = event.timeStamp ?? now();
        down.set(event.pointerId ?? 0, at);
        lastDownAt = at;
    };
    const onPointerEnd = (event) => { down.delete(event.pointerId ?? 0); };
    const onScroll = (event) => { lastScrollAt = event?.timeStamp ?? now(); };
    const onHidden = () => { down.clear(); };

    return {
        guardMs,
        onPointerDown,
        onPointerUp: onPointerEnd,
        onPointerCancel: onPointerEnd,
        onScroll,
        markShown: () => { shownAt = now(); },
        reset: () => { shownAt = null; },
        isPointerDown: () => { pruneDowns(now()); return down.size > 0; },
        // Utsett visning hvis brukeren er midt i en interaksjon.
        isMidInteraction: (activeElement = null) => {
            const t = now();
            pruneDowns(t);
            return down.size > 0 || t - lastScrollAt < scrollQuietMs || isEditableElement(activeElement);
        },
        // Skal et klikk på popupens egne knapper ignoreres? Tastaturaktivering (detail === 0)
        // påvirkes aldri av gamle pekerhendelser. Et pointerdown fra før visning teller bare
        // hvis klikket tilhører samme gest (innen INSTALL_GESTURE_MS), så det ikke sperrer senere klikk.
        shouldIgnoreClick: (event) => {
            if (shownAt === null) return false;
            if (event.detail === 0) return false;
            const until = shownAt + guardMs;
            const clickAt = event.timeStamp ?? now();
            if (isGuardedPointer(shownAt, clickAt, guardMs)) return true;
            if (lastDownAt != null && lastDownAt < until && clickAt - lastDownAt >= 0 && clickAt - lastDownAt <= INSTALL_GESTURE_MS) return true;
            pruneDowns(clickAt);
            for (const downAt of down.values()) {
                if (downAt < until) return true;
            }
            return false;
        },
        // Fanger pekerhendelser tidlig (capture), også de som startet før popupen fantes.
        attach: (target) => {
            const opts = { capture: true, passive: true };
            const onVisibility = () => {
                if (target.visibilityState === 'hidden') onHidden();
            };
            target.addEventListener('pointerdown', onPointerDown, opts);
            target.addEventListener('pointerup', onPointerEnd, opts);
            target.addEventListener('pointercancel', onPointerEnd, opts);
            target.addEventListener('scroll', onScroll, opts);
            target.addEventListener('visibilitychange', onVisibility, opts);
            return () => {
                target.removeEventListener('pointerdown', onPointerDown, opts);
                target.removeEventListener('pointerup', onPointerEnd, opts);
                target.removeEventListener('pointercancel', onPointerEnd, opts);
                target.removeEventListener('scroll', onScroll, opts);
                target.removeEventListener('visibilitychange', onVisibility, opts);
            };
        },
    };
};

const readStorage = (storage, key) => {
    try { return storage.getItem(key); } catch { return null; }
};
const writeStorage = (storage, key, value) => {
    try { storage.setItem(key, value); } catch { /* lagring kan være blokkert */ }
};

export const readInstallState = () => ({
    dismissedAt: Number(readStorage(window.localStorage, INSTALL_DISMISSED_KEY)) || null,
    installedFlag: readStorage(window.localStorage, INSTALL_INSTALLED_KEY) === '1',
    shownThisSession: readStorage(window.sessionStorage, INSTALL_SESSION_KEY) === '1',
});
export const markInstallDismissed = (now = Date.now()) => writeStorage(window.localStorage, INSTALL_DISMISSED_KEY, String(now));
export const markInstallInstalled = () => writeStorage(window.localStorage, INSTALL_INSTALLED_KEY, '1');
export const clearInstallInstalled = () => {
    try { window.localStorage.removeItem(INSTALL_INSTALLED_KEY); } catch { /* lagring kan være blokkert */ }
};
export const markInstallShown = () => writeStorage(window.sessionStorage, INSTALL_SESSION_KEY, '1');

export const detectStandalone = () => {
    try {
        return window.navigator.standalone === true
            || ['standalone', 'fullscreen', 'minimal-ui'].some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
    } catch {
        return false;
    }
};

// --- Modulstore: utsatt beforeinstallprompt-hendelse ---
let deferredEvent = null;
let version = 0;
const listeners = new Set();
let started = false;

const emit = () => {
    version += 1;
    listeners.forEach(listener => listener());
};

export const subscribeInstallPrompt = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
export const getInstallPromptVersion = () => version;
export const hasDeferredInstallPrompt = () => deferredEvent !== null;

// Hendelsen kan bare brukes én gang, så den slippes så snart den er tatt.
// Emitter bevisst ikke: kalleren skjuler dialogen eksplisitt.
export const takeDeferredInstallPrompt = () => {
    const event = deferredEvent;
    deferredEvent = null;
    return event;
};

export const startInstallPromptCapture = () => {
    if (started || typeof window === 'undefined') return;
    started = true;
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        // Ferske beforeinstallprompt betyr at Chrome anser appen som ikke installert (f.eks. avinstallert).
        clearInstallInstalled();
        deferredEvent = event;
        emit();
    });
    window.addEventListener('appinstalled', () => {
        markInstallInstalled();
        deferredEvent = null;
        emit();
    });
};
