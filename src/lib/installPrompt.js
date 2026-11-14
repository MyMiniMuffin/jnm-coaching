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
    if (Number.isFinite(dismissed) && dismissed > 0 && now - dismissed < INSTALL_COOLDOWN_MS) return false;
    return true;
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
export const takeDeferredInstallPrompt = () => {
    const event = deferredEvent;
    deferredEvent = null;
    emit();
    return event;
};

export const startInstallPromptCapture = () => {
    if (started || typeof window === 'undefined') return;
    started = true;
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredEvent = event;
        emit();
    });
    window.addEventListener('appinstalled', () => {
        markInstallInstalled();
        deferredEvent = null;
        emit();
    });
};
