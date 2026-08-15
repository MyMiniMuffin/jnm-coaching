import { getToken } from './session';

// --- CACHE LAYER (med localStorage for persistent cache) ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutter
const CACHE_PREFIX = 'jnm_cache_';
const cacheVersions = new Map();
let cacheGeneration = 0;

const runWhenIdle = (callback) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout: 2000 });
        return;
    }
    setTimeout(callback, 0);
};

const persistCacheItem = (key, item, version, generation) => {
    runWhenIdle(() => {
        if (generation !== cacheGeneration || cacheVersions.get(key) !== version) return;

        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
        } catch (e) {
            // localStorage full eller ikke tilgjengelig
        }
    });
};

export const cache = {
    store: {},

    get: (key, { allowStale = false } = {}) => {
        let item = cache.store[key];
        if (!item) {
            try {
                const stored = localStorage.getItem(CACHE_PREFIX + key);
                item = stored ? JSON.parse(stored) : null;
                if (item) {
                    cache.store[key] = item;
                }
            } catch (e) {
                item = null;
            }
        }
        if (!item) return null;

        const expired = Date.now() - item.timestamp > CACHE_TTL;
        if (expired && !allowStale) return null;

        return item.data;
    },

    set: (key, data) => {
        const item = {
            data,
            timestamp: Date.now()
        };
        cache.store[key] = item;
        const version = (cacheVersions.get(key) || 0) + 1;
        cacheVersions.set(key, version);

        // Lagre persistent cache uten å blokkere neste frame.
        persistCacheItem(key, item, version, cacheGeneration);
    },

    invalidate: (key) => {
        // Slett spesifikk cache-nøkkel
        delete cache.store[key];
        cacheVersions.set(key, (cacheVersions.get(key) || 0) + 1);
        try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {}
    },
    invalidateAll: () => {
        cache.store = {};
        cacheGeneration += 1;
        cacheVersions.clear();

        // Persistent cache kan inneholde nøkler som ikke er lastet inn i minnet.
        // Fjern derfor alle app-cachede elementer direkte fra localStorage.
        try {
            const keys = [];
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
            }
            keys.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            // localStorage er ikke tilgjengelig i alle miljøer.
        }
    }
};

// --- DEBOUNCE UTILITY ---
export const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

export const getAuthHeaders = () => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const readResponseBody = async (response) => {
    const text = await response.text();
    if (!text) return undefined;

    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
};

const getErrorMessage = (body, fallback) => {
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body.error === 'string') return body.error;
    return fallback;
};

const request = async (url, {
    method = 'GET',
    body,
    auth = true,
    errorMessage = 'Forespørselen feilet',
    // 'no-store' hopper over nettleserens HTTP-cache. Brukes når kalleren eksplisitt
    // ber om ferske data, slik at Cache-Control-headerne på GET-endepunktene ikke
    // kan servere opptil ett minutt gammelt svar.
    cacheMode
} = {}) => {
    const response = await fetch(url, {
        method,
        headers: auth ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        ...(cacheMode ? { cache: cacheMode } : {}),
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });

    if (response.status === 401) {
        return { authError: true };
    }

    const data = await readResponseBody(response);
    if (!response.ok) {
        throw new Error(getErrorMessage(data, errorMessage));
    }

    return { authError: false, data };
};

const mutateUserData = async (userId, type, data, errorMessage) => {
    const result = await request('/.netlify/functions/data', {
        method: 'POST',
        body: { userId, type, data },
        errorMessage
    });

    if (!result.authError) cache.invalidate(`user-data-${userId}`);
    return result;
};

export const api = {
    getUsers: async (useCache = false) => {
        if (useCache) {
            const cached = cache.get('users-list');
            if (Array.isArray(cached)) return { authError: false, data: cached, fromCache: true };
        }
        try {
            const result = await request('/.netlify/functions/users', {
                errorMessage: 'Kunne ikke hente brukere',
                cacheMode: useCache ? undefined : 'no-store'
            });
            if (result.authError) return { ...result, data: [] };
            if (!Array.isArray(result.data)) {
                return { authError: false, data: [], networkError: true };
            }
            cache.set('users-list', result.data);
            return result;
        } catch (e) {
            console.error('[API] getUsers feil:', e);
            // Fallback til cache ved nettverksfeil
            const cached = cache.get('users-list');
            if (Array.isArray(cached)) return { authError: false, data: cached, fromCache: true };
            return { authError: false, data: [], networkError: true };
        }
    },
    createUser: (newUser) => request('/.netlify/functions/users', {
            method: 'POST',
            body: newUser,
            errorMessage: 'Feil ved opprettelse'
        }),
    deleteUser: (userId) => request('/.netlify/functions/users', {
            method: 'DELETE',
            body: { id: userId },
            errorMessage: 'Feil ved sletting'
        }),
    resetPassword: (userId, newPassword) => request('/.netlify/functions/users', {
            method: 'PATCH',
            body: { id: userId, new_password: newPassword },
            errorMessage: 'Feil ved tilbakestilling av passord'
        }),
    archiveUser: (userId, archive) => request('/.netlify/functions/users', {
            method: 'PATCH',
            body: { id: userId, is_archived: archive },
            errorMessage: 'Feil ved arkivering'
        }),
    getUserData: async (userId, useCache = true) => {
        const cacheKey = `user-data-${userId}`;

        // Sjekk cache først
        if (useCache) {
            const cached = cache.get(cacheKey);
            if (cached) return { authError: false, data: cached };
        }

        try {
            const result = await request(`/.netlify/functions/data?id=${encodeURIComponent(userId)}`, {
                errorMessage: 'Feil ved henting av data',
                // useCache=false betyr "hent ferske data" — da skal heller ikke
                // nettleserens HTTP-cache kunne svare.
                cacheMode: useCache ? undefined : 'no-store'
            });
            if (result.authError) return result;
            if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
                return { authError: false, networkError: true };
            }
            cache.set(cacheKey, result.data);
            return result;
        } catch (e) {
            console.error('[API] getUserData feil:', e);
            const cached = cache.get(cacheKey, { allowStale: true });
            if (cached) return { authError: false, data: cached, fromCache: true, networkError: true };
            return { authError: false, networkError: true };
        }
    },
    saveUserData: (userId, data) => mutateUserData(userId, 'plan_update', data, 'Lagring feilet'),
    submitCheckin: (userId, entry) => mutateUserData(userId, 'new_checkin', entry, 'Innsending feilet'),
    updateCheckin: (userId, checkinId, updates) => mutateUserData(
        userId,
        'update_checkin',
        { checkinId, ...updates },
        'Oppdatering feilet'
    ),
    deleteCheckin: (userId, checkinId) => mutateUserData(
        userId,
        'delete_checkin',
        { checkinId },
        'Sletting feilet'
    ),
    markCheckinsRead: (userId) => mutateUserData(
        userId,
        'mark_checkins_read',
        {},
        'Kunne ikke markere som lest'
    ),
    createPeriod: (userId, name, startingWeight, goalWeight = null) => mutateUserData(
        userId,
        'create_period',
        { name, startingWeight, goalWeight },
        'Kunne ikke opprette periode'
    ),
    endPeriod: (userId, periodId) => mutateUserData(
        userId,
        'end_period',
        { periodId },
        'Kunne ikke avslutte periode'
    ),
    updatePeriod: (userId, periodId, updates) => mutateUserData(
        userId,
        'update_period',
        { periodId, ...updates },
        'Kunne ikke oppdatere periode'
    ),
    addGalleryImage: (userId, imageUrl, label, date, weight) => mutateUserData(
        userId,
        'add_gallery_image',
        { imageUrl, label, date, weight },
        'Kunne ikke legge til bilde'
    ),
    deleteGalleryImage: (userId, imageId) => mutateUserData(
        userId,
        'delete_gallery_image',
        { imageId },
        'Kunne ikke slette bilde'
    ),
    uploadImage: (base64Image, userId, purpose) => request('/.netlify/functions/upload', {
            method: 'POST',
            body: { image: base64Image, userId, purpose },
            errorMessage: 'Opplasting feilet'
        }),
    savePushSubscription: (subscription) => request('/.netlify/functions/push-subscriptions', {
            method: 'POST',
            body: { subscription },
            errorMessage: 'Kunne ikke lagre push-abonnement'
        }),
    deletePushSubscription: (endpoint) => request('/.netlify/functions/push-subscriptions', {
            method: 'DELETE',
            body: { endpoint },
            errorMessage: 'Kunne ikke slette push-abonnement'
        }),
    login: async (username, password) => {
        const result = await request('/.netlify/functions/auth', {
            method: 'POST',
            body: { username, password },
            auth: false,
            errorMessage: 'Login feilet'
        });
        return result.authError ? null : result.data;
    },
};
