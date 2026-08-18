const PATTERNS = {
    tap: 10,
    save: 12,
    toggle: 8,
    confirm: [8, 40, 12],
};

const canVibrate = () =>
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const haptic = (kind = 'tap') => {
    if (!canVibrate() || prefersReducedMotion()) return;
    const pattern = PATTERNS[kind] ?? kind;
    try {
        navigator.vibrate(pattern);
    } catch {
        // iOS and unsupported browsers no-op
    }
};
