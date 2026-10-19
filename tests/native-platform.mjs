import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';
import { apiFetch, getApiUrl } from '../src/lib/platform.js';

test('native API URLs require HTTPS and retain query parameters', () => {
    assert.equal(getApiUrl('/.netlify/functions/data?id=42'), 'https://jnmcoaching.no/.netlify/functions/data?id=42');
    assert.throws(() => getApiUrl('/.netlify/functions/auth', 'http://example.com'));
    assert.throws(() => getApiUrl('/.netlify/functions/auth', 'https://user:pass@example.com'));
    assert.throws(() => getApiUrl('/.netlify/functions/auth', 'https://example.com/path'));
    assert.throws(() => getApiUrl('https://example.com'));
});

test('browser requests retain same origin and existing fetch options', async (t) => {
    t.mock.method(Capacitor, 'isNativePlatform', () => false);
    const response = new Response('[]');
    t.mock.method(globalThis, 'fetch', async (path, options) => {
        assert.equal(path, '/.netlify/functions/users');
        assert.equal(options.cache, 'no-store');
        return response;
    });
    assert.equal(await apiFetch('/.netlify/functions/users', { cache: 'no-store' }), response);
});

test('native requests send JWT and JSON to production and preserve auth failures', async (t) => {
    t.mock.method(Capacitor, 'isNativePlatform', () => true);
    // Capacitor's web transport exercises the native request options in Node.
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, 'https://jnmcoaching.no/.netlify/functions/auth');
        assert.equal(options.headers.Authorization, 'Bearer test');
        assert.equal(options.headers['Cache-Control'], 'no-cache');
        assert.deepEqual(JSON.parse(options.body), { username: 'demo' });
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    });
    const response = await apiFetch('/.netlify/functions/auth', {
        method: 'POST', headers: { Authorization: 'Bearer test' },
        body: JSON.stringify({ username: 'demo' }), cache: 'no-store'
    });
    assert.equal(response.ok, false);
    assert.equal(response.status, 401);
    assert.deepEqual(JSON.parse(await response.text()), { error: 'Unauthorized' });
});
