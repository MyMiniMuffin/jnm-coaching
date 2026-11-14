import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTALL_COOLDOWN_MS, isAndroidWeb, shouldShowInstallPrompt } from '../src/lib/installPrompt.js';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const NOW = 1_800_000_000_000;

const eligible = {
    userAgent: ANDROID,
    maxTouchPoints: 5,
    isNative: false,
    isStandalone: false,
    hasDeferredPrompt: true,
    now: NOW,
    dismissedAt: null,
    installedFlag: false,
    shownThisSession: false,
    engaged: true,
};
const show = (overrides = {}) => shouldShowInstallPrompt({ ...eligible, ...overrides });

test('shows on Android web with deferred prompt after engagement', () => {
    assert.equal(show(), true);
});

test('never shows on iOS, iPadOS with Mac UA or desktop', () => {
    assert.equal(show({ userAgent: IPHONE }), false);
    assert.equal(show({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 }), false);
    assert.equal(show({ userAgent: DESKTOP, maxTouchPoints: 0 }), false);
    assert.equal(isAndroidWeb(IPAD_AS_MAC, 5), false);
});

test('never shows in a native shell or when standalone', () => {
    assert.equal(show({ isNative: true }), false);
    assert.equal(show({ isStandalone: true }), false);
});

test('requires the deferred beforeinstallprompt event', () => {
    assert.equal(show({ hasDeferredPrompt: false }), false);
});

test('respects the 14 day cooldown after dismissal', () => {
    assert.equal(show({ dismissedAt: NOW - 1000 }), false);
    assert.equal(show({ dismissedAt: NOW - INSTALL_COOLDOWN_MS + 1 }), false);
    assert.equal(show({ dismissedAt: NOW - INSTALL_COOLDOWN_MS }), true);
    assert.equal(show({ dismissedAt: NOW - INSTALL_COOLDOWN_MS - 1000 }), true);
});

test('stays hidden once installed or already shown this session', () => {
    assert.equal(show({ installedFlag: true }), false);
    assert.equal(show({ shownThisSession: true }), false);
});

test('waits for engagement and for other dialogs to close', () => {
    assert.equal(show({ engaged: false }), false);
    assert.equal(show({ modalOpen: true }), false);
});

test('ignores invalid stored timestamps', () => {
    assert.equal(show({ dismissedAt: 'abc' }), true);
    assert.equal(show({ dismissedAt: null }), true);
});
