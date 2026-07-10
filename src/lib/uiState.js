const UI_STATE_KEY = 'jnm_ui_state';
const UI_STATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export const readUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const state = localStorage.getItem(UI_STATE_KEY);
        return state ? JSON.parse(state) : null;
    } catch (error) {
        console.error('[UI State] Kunne ikke lese lagret posisjon:', error);
        return null;
    }
};

export const saveUiState = (state) => {
    if (typeof window === 'undefined' || !state?.userId) return;
    try {
        localStorage.setItem(UI_STATE_KEY, JSON.stringify({
            ...state,
            scrollY: Math.max(0, Math.round(window.scrollY || document.documentElement.scrollTop || 0)),
            savedAt: Date.now()
        }));
    } catch (error) {
        console.error('[UI State] Kunne ikke lagre posisjon:', error);
    }
};

export const clearUiState = () => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(UI_STATE_KEY);
    } catch (error) {
        console.error('[UI State] Kunne ikke slette lagret posisjon:', error);
    }
};

export const isUiStateFresh = (state) => (
    Number.isFinite(state?.savedAt) &&
    Date.now() - state.savedAt <= UI_STATE_MAX_AGE_MS
);
