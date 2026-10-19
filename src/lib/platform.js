import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();

// Native builds bundle the interface locally and use the existing production API.
// The browser keeps its same-origin requests (including Netlify previews).
export const getApiUrl = (path, origin = import.meta.env?.VITE_API_ORIGIN || 'https://jnmcoaching.no') => {
    const base = new URL(origin);
    if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
        throw new Error('VITE_API_ORIGIN må være en HTTPS-adresse uten sti eller innlogging');
    }
    if (!path.startsWith('/.netlify/functions/')) throw new Error('Ugyldig API-sti');
    return new URL(path, base).href;
};

export const apiFetch = async (path, options) => {
    if (!isNativeApp()) return fetch(path, options);

    // Native HTTP avoids a cross-origin browser request from capacitor://localhost.
    // Keep the backend's existing JWT authorization and status handling.
    const result = await CapacitorHttp.request({
        url: getApiUrl(path),
        method: options.method,
        headers: {
            ...options.headers,
            ...(options.cache === 'no-store' ? { 'Cache-Control': 'no-cache' } : {})
        },
        ...(options.body === undefined ? {} : { data: JSON.parse(options.body) }),
        responseType: 'text',
        connectTimeout: 15000,
        readTimeout: 30000
    });
    return {
        status: result.status,
        ok: result.status >= 200 && result.status < 300,
        text: async () => typeof result.data === 'string' ? result.data : JSON.stringify(result.data) ?? ''
    };
};
