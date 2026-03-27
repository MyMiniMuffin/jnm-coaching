import { getToken } from './session';

// --- CACHE LAYER (med localStorage for persistent cache) ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutter
const CACHE_PREFIX = 'jnm_cache_';

export const cache = {
    store: {},

    // Last inn fra localStorage ved oppstart
    init: () => {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
            keys.forEach(key => {
                const item = JSON.parse(localStorage.getItem(key));
                if (item && Date.now() - item.timestamp < CACHE_TTL) {
                    cache.store[key.replace(CACHE_PREFIX, '')] = item;
                } else {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            // localStorage ikke tilgjengelig, fortsett uten
        }
    },

    get: (key) => {
        const item = cache.store[key];
        if (!item) return null;

        // Sjekk om cache har utløpt
        const now = Date.now();
        if (now - item.timestamp > CACHE_TTL) {
            delete cache.store[key];
            try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {}
            return null;
        }

        return item.data;
    },

    set: (key, data) => {
        const item = {
            data,
            timestamp: Date.now()
        };
        cache.store[key] = item;

        // Lagre til localStorage for persistent cache
        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
        } catch (e) {
            // localStorage full eller ikke tilgjengelig
        }
    },

    invalidate: (key) => {
        // Slett spesifikk cache-nøkkel
        delete cache.store[key];
        try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {}
    },
    invalidateAll: () => {
        // Slett all cache
        Object.keys(cache.store).forEach(key => {
            delete cache.store[key];
            try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {}
        });
    }
};

// Initialiser cache fra localStorage
cache.init();

// --- DEBOUNCE UTILITY ---
export const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

// ============================================
// API LAYER v3 - FIKSET: Ingen auto-logout
// ============================================

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

export const api = {
    getUsers: async (useCache = false) => {
        if (useCache) {
            const cached = cache.get('users-list');
            if (cached) return { authError: false, data: cached, fromCache: true };
        }
        try {
            const res = await fetch('/.netlify/functions/users', {
                headers: getAuthHeaders()
            });
            if (res.status === 401) {
                console.warn('[API] 401 ved getUsers - returnerer authError');
                return { authError: true, data: [] };
            }
            if (!res.ok) throw new Error('Kunne ikke hente brukere');
            const data = await res.json();
            cache.set('users-list', data);
            return { authError: false, data };
        } catch (e) {
            console.error('[API] getUsers feil:', e);
            // Fallback til cache ved nettverksfeil
            const cached = cache.get('users-list');
            if (cached) return { authError: false, data: cached, fromCache: true };
            return { authError: false, data: [], networkError: true };
        }
    },
    createUser: async (newUser) => {
        console.log('[API] Oppretter ny bruker:', newUser.name);
        const res = await fetch('/.netlify/functions/users', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newUser)
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved createUser');
            return { authError: true };
        }
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('[API] Feil ved opprettelse:', errorData);
            throw new Error(errorData.error || 'Feil ved opprettelse');
        }
        const result = await res.json();
        console.log('[API] Bruker opprettet suksessfullt');
        return { authError: false, data: result };
    },
    deleteUser: async (userId) => {
        const res = await fetch('/.netlify/functions/users', {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: userId })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved deleteUser');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Feil ved sletting');
        return { authError: false, data: await res.json() };
    },
    archiveUser: async (userId, archive) => {
        const res = await fetch('/.netlify/functions/users', {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: userId, is_archived: archive })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved archiveUser');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Feil ved arkivering');
        return { authError: false, data: await res.json() };
    },
    getUserData: async (userId, useCache = true) => {
        const cacheKey = `user-data-${userId}`;

        // Sjekk cache først
        if (useCache) {
            const cached = cache.get(cacheKey);
            if (cached) return { authError: false, data: cached };
        }

        try {
            const res = await fetch(`/.netlify/functions/data?id=${userId}`, {
                headers: getAuthHeaders()
            });
            if (res.status === 401) {
                console.warn('[API] 401 ved getUserData');
                return { authError: true };
            }
            if (!res.ok) throw new Error('Feil ved henting av data');

            const data = await res.json();
            cache.set(cacheKey, data);
            return { authError: false, data };
        } catch (e) {
            console.error('[API] getUserData feil:', e);
            return { authError: false, networkError: true };
        }
    },
    saveUserData: async (userId, data) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'plan_update', data })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved saveUserData');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Lagring feilet');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false, data };
    },
    submitCheckin: async (userId, entry) => {
        const payload = JSON.stringify({ userId, type: 'new_checkin', data: entry });
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: payload
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved submitCheckin');
            return { authError: true };
        }
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Innsending feilet');
        }
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    deleteCheckin: async (userId, checkinId) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'delete_checkin', data: { checkinId } })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved deleteCheckin');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Sletting feilet');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    markCheckinsRead: async (userId) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'mark_checkins_read', data: {} })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved markCheckinsRead');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Kunne ikke markere som lest');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    createPeriod: async (userId, name, startingWeight, goalWeight = null) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'create_period', data: { name, startingWeight, goalWeight } })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved createPeriod');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Kunne ikke opprette periode');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    endPeriod: async (userId, periodId) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'end_period', data: { periodId } })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved endPeriod');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Kunne ikke avslutte periode');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    updatePeriod: async (userId, periodId, updates) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'update_period', data: { periodId, ...updates } })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved updatePeriod');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Kunne ikke oppdatere periode');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    addGalleryImage: async (userId, imageUrl, label, date, weight) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'add_gallery_image', data: { imageUrl, label, date, weight } })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved addGalleryImage');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Kunne ikke legge til bilde');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    deleteGalleryImage: async (userId, imageId) => {
        const res = await fetch('/.netlify/functions/data', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, type: 'delete_gallery_image', data: { imageId } })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved deleteGalleryImage');
            return { authError: true };
        }
        if (!res.ok) throw new Error('Kunne ikke slette bilde');
        cache.invalidate(`user-data-${userId}`);
        return { authError: false };
    },
    uploadImage: async (base64Image) => {
        const res = await fetch('/.netlify/functions/upload', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ image: base64Image })
        });
        if (res.status === 401) {
            console.warn('[API] 401 ved uploadImage');
            return { authError: true };
        }
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Opplasting feilet');
        }
        return { authError: false, data: await res.json() };
    },
    login: async (username, password) => {
        const res = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error('Login feilet');
        return await res.json();
    }
};
