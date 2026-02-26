// ============================================
// SESSION MANAGEMENT v3 - FIKSET FOR PWA
// ============================================

const SESSION_KEY = 'jnm_session';
const SESSION_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 dager

// Lagre session med all nødvendig info
export const saveSession = (userData) => {
    try {
        const sessionData = {
            user: {
                id: userData.id,
                username: userData.username,
                name: userData.name,
                role: userData.role
            },
            token: userData.token,
            expiresAt: Date.now() + SESSION_TIMEOUT_MS,
            savedAt: Date.now()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        console.log('[Session] Lagret for:', userData.username);
    } catch (e) {
        console.error('[Session] Lagringsfeil:', e);
    }
};

// Hent session - ROBUST versjon som IKKE sletter ved feil
export const getSession = () => {
    try {
        const data = localStorage.getItem(SESSION_KEY);
        if (!data) {
            console.log('[Session] Ingen session funnet');
            return null;
        }

        const session = JSON.parse(data);

        // Sjekk utløpstid
        if (session.expiresAt && Date.now() > session.expiresAt) {
            console.log('[Session] Utløpt, sletter');
            localStorage.removeItem(SESSION_KEY);
            return null;
        }

        // Returner brukerdata - håndter både gammelt og nytt format
        const user = session.user || (session.id ? session : null);
        if (user) {
            console.log('[Session] Gyldig session:', user.username);
        }
        return user;
    } catch (e) {
        console.error('[Session] Parse-feil:', e);
        // VIKTIG: Ikke slett ved parse-feil - kan være midlertidig
        return null;
    }
};

// Hent token
export const getToken = () => {
    try {
        const data = localStorage.getItem(SESSION_KEY);
        if (!data) return null;
        const session = JSON.parse(data);
        return session.token || null;
    } catch (e) {
        console.error('[Session] Token-feil:', e);
        return null;
    }
};

// Slett session - KUN ved eksplisitt utlogging
export const clearSession = () => {
    console.log('[Session] Eksplisitt sletting');
    localStorage.removeItem(SESSION_KEY);
};

// Sjekk om vi har gyldig session (for visibility change)
export const hasValidSession = () => {
    return getSession() !== null && getToken() !== null;
};
