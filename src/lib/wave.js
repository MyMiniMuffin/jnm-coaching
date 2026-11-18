// Delte hjelpere for «Distortion Waves»-overgangen (src/vendor/distortion-waves).
// Biblioteket hentes som eget chunk og ligger aldri i app-oppstarten.

// Fargene er appens egne tokens (tailwind.config.mjs og :root i src/index.css).
const TOKENS = {
    accent: '#246568',
    accentMuted: '#83AFAC',
    reportGood: '#527062',
    reportTraining: '#526B85',
    success: '#546B3E',
    accentHover: '#1B5053',
};

const toRgb = (hex) => {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

// Ett konstant objekt: kontrolleren leser fargene på nytt bare når objektet byttes.
export const JNM_WAVE_PALETTE = {
    colors: [
        TOKENS.accent,
        TOKENS.accentMuted,
        TOKENS.reportGood,
        TOKENS.reportTraining,
        TOKENS.success,
        TOKENS.accentHover,
    ].map(toRgb),
    ahead: toRgb(TOKENS.accentMuted),
    behind: toRgb(TOKENS.accentHover),
};

let controllerPromise = null;

// Henter kontrolleren én gang. Svarer null hvis chunken ikke lar seg laste,
// slik at kalleren kan gå rett til sluttilstanden uten bølge.
export function loadWaveController() {
    if (!controllerPromise) {
        controllerPromise = import('../vendor/distortion-waves/controller')
            .then((module) => module.WaveController)
            .catch(() => null);
    }
    return controllerPromise;
}

// Starter importen når nettleseren er ledig, så den ikke konkurrerer med oppstart.
export function preloadWaveController() {
    if (controllerPromise || typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => { loadWaveController(); }, { timeout: 4000 });
    } else {
        window.setTimeout(loadWaveController, 1);
    }
}

// Bunnen av en sticky topplinje i viewport (0 hvis den ikke er synlig).
export function stickyHeaderBottom(selector) {
    if (typeof document === 'undefined') return 0;
    const header = document.querySelector(selector);
    if (!header) return 0;
    return Math.max(0, header.getBoundingClientRect().bottom);
}

// Etter bølgen byttes den lange skjemavisningen mot den vanlige, kortere.
// Denne flytter siden slik at elementet står på samme sted i viewport som før.
// Er dokumentet blitt for kort til det, holdes høyden oppe med min-height på body.
// Returnerer en funksjon som slipper høyden igjen. Den slippes også av seg selv ved
// første scroll-hendelse der den ikke lenger trengs (brukeren har scrollet opp).
export function keepInPlace(element, before) {
    if (!element || !before) return () => {};
    const delta = element.getBoundingClientRect().top - before.top;
    if (Math.abs(delta) < 0.5) return () => {};

    const target = Math.max(0, window.scrollY + delta);
    const root = document.documentElement;
    const missing = target + window.innerHeight - root.scrollHeight;
    const body = document.body;
    const previousMinHeight = body.style.minHeight;
    let release = () => {};
    if (missing > 0) {
        body.style.minHeight = `${body.offsetHeight + missing}px`;
        const naturalHeight = root.scrollHeight - missing;
        const onScroll = () => {
            // Trengs så lenge bunnen av viewport er under dokumentets naturlige bunn.
            if (window.scrollY + window.innerHeight <= naturalHeight) release();
        };
        release = () => {
            window.removeEventListener('scroll', onScroll);
            body.style.minHeight = previousMinHeight;
            release = () => {};
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }
    window.scrollBy({ top: delta, left: 0, behavior: 'instant' });
    return () => release();
}
