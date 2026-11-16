import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    INSTALL_ARRIVAL_GUARD_MS,
    INSTALL_GESTURE_MS,
    INSTALL_STALE_POINTER_MS,
    createArrivalGuard,
    isEditableElement,
    isGuardedPointer,
    INSTALL_COOLDOWN_MS,
    INSTALL_INSTALLED_KEY,
    hasDeferredInstallPrompt,
    isAndroidWeb,
    shouldShowInstallPrompt,
    startInstallPromptCapture,
} from '../src/lib/installPrompt.js';

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

test('ignores a dismissedAt in the future (clock skew)', () => {
    assert.equal(show({ dismissedAt: NOW + 1000 }), true);
    assert.equal(show({ dismissedAt: NOW + INSTALL_COOLDOWN_MS * 2 }), true);
});

test('a fresh beforeinstallprompt clears the stored installed flag', () => {
    const store = new Map([[INSTALL_INSTALLED_KEY, '1']]);
    const handlers = {};
    globalThis.window = {
        localStorage: {
            getItem: k => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, v),
            removeItem: k => store.delete(k),
        },
        addEventListener: (name, fn) => { handlers[name] = fn; },
    };
    try {
        startInstallPromptCapture();
        let prevented = false;
        handlers.beforeinstallprompt({ preventDefault: () => { prevented = true; } });
        assert.equal(prevented, true);
        assert.equal(store.has(INSTALL_INSTALLED_KEY), false);
        assert.equal(hasDeferredInstallPrompt(), true);
    } finally {
        delete globalThis.window;
    }
});

// --- Ankomstvern ---
const makeGuard = (guardMs = 700) => {
    const clock = { t: 1000 };
    const guard = createArrivalGuard({ guardMs, now: () => clock.t });
    return { guard, clock };
};
const click = (timeStamp, detail = 1) => ({ timeStamp, detail });

test('guard default is within 600-800ms and isGuardedPointer compares against shownAt + guardMs', () => {
    assert.ok(INSTALL_ARRIVAL_GUARD_MS >= 600 && INSTALL_ARRIVAL_GUARD_MS <= 800);
    assert.equal(isGuardedPointer(1000, 900, 700), true);
    assert.equal(isGuardedPointer(1000, 1699, 700), true);
    assert.equal(isGuardedPointer(1000, 1700, 700), false);
    assert.equal(isGuardedPointer(1000, 1000, 0), false);
});

test('click on popup buttons during the guard window is ignored', () => {
    const { guard, clock } = makeGuard();
    guard.markShown();
    clock.t = 1200;
    guard.onPointerDown({ pointerId: 1, timeStamp: 1190 });
    guard.onPointerUp({ pointerId: 1 });
    assert.equal(guard.shouldIgnoreClick(click(1200)), true);
});

test('a tap that began before the prompt appeared is ignored even after the guard window', () => {
    const { guard, clock } = makeGuard();
    guard.onPointerDown({ pointerId: 1, timeStamp: 990 });
    guard.markShown();
    clock.t = 3000; // pointerup/click lenge etter visning
    guard.onPointerUp({ pointerId: 1 });
    assert.equal(guard.shouldIgnoreClick(click(3000)), true);
});

test('a fresh tap after the guard window is accepted (explicit Ikke nå / Lukk)', () => {
    const { guard, clock } = makeGuard();
    guard.markShown();
    clock.t = 2000;
    guard.onPointerDown({ pointerId: 1, timeStamp: 1900 });
    guard.onPointerUp({ pointerId: 1 });
    assert.equal(guard.shouldIgnoreClick(click(2000)), false);
});

test('a stale pointerdown from before show does not block a click long after the guard', () => {
    const { guard, clock } = makeGuard();
    guard.onPointerDown({ pointerId: 1, timeStamp: 990 });
    guard.onPointerUp({ pointerId: 1 });
    guard.markShown();
    clock.t = 1000 + INSTALL_GESTURE_MS + 1000;
    assert.equal(guard.shouldIgnoreClick(click(clock.t)), false);
});

test('a held pointer without pointerup expires and stops postponing mid-interaction', () => {
    const { guard, clock } = makeGuard();
    guard.onPointerDown({ pointerId: 7, timeStamp: 1000 });
    clock.t = 1000 + INSTALL_STALE_POINTER_MS + 1;
    assert.equal(guard.isMidInteraction(null), false);
    assert.equal(guard.isPointerDown(), false);
});

test('keyboard activation (detail 0) is never blocked by a stale pointerdown', () => {
    const { guard, clock } = makeGuard();
    guard.onPointerDown({ pointerId: 1, timeStamp: 990 });
    guard.markShown();
    clock.t = 1100;
    assert.equal(guard.shouldIgnoreClick(click(1100, 0)), false);
});

test('guardMs 0 disables the guard for taps that start after show', () => {
    const { guard, clock } = makeGuard(0);
    guard.markShown();
    clock.t = 1001;
    guard.onPointerDown({ pointerId: 1, timeStamp: 1001 });
    assert.equal(guard.shouldIgnoreClick(click(1001)), false);
});

test('mid-interaction: pointer down, recent scroll and editable focus postpone', () => {
    const { guard, clock } = makeGuard();
    assert.equal(guard.isMidInteraction(null), false);
    guard.onPointerDown({ pointerId: 7, timeStamp: 1000 });
    assert.equal(guard.isPointerDown(), true);
    assert.equal(guard.isMidInteraction(null), true);
    guard.onPointerCancel({ pointerId: 7 });
    assert.equal(guard.isMidInteraction(null), false);
    guard.onScroll({ timeStamp: 1000 });
    clock.t = 1200;
    assert.equal(guard.isMidInteraction(null), true);
    clock.t = 1400;
    assert.equal(guard.isMidInteraction(null), false);
    assert.equal(guard.isMidInteraction({ tagName: 'INPUT' }), true);
    assert.equal(isEditableElement({ tagName: 'TEXTAREA' }), true);
    assert.equal(isEditableElement({ tagName: 'SELECT' }), true);
    assert.equal(isEditableElement({ tagName: 'DIV', isContentEditable: true }), true);
    assert.equal(isEditableElement({ tagName: 'BUTTON' }), false);
});

test('attach tracks pointer events in the capture phase on the target', () => {
    const { guard } = makeGuard();
    const calls = [];
    const target = {
        addEventListener: (name, fn, opts) => calls.push(['add', name, opts.capture]),
        removeEventListener: (name, fn, opts) => calls.push(['remove', name, opts.capture]),
    };
    const detach = guard.attach(target);
    detach();
    for (const n of ['pointerdown', 'pointerup', 'pointercancel', 'scroll', 'visibilitychange']) {
        assert.ok(calls.some(c => c[0] === 'add' && c[1] === n && c[2] === true), n);
        assert.ok(calls.some(c => c[0] === 'remove' && c[1] === n && c[2] === true), n);
    }
});

// --- Kildenivå: komponenten bruker vernet og lukker bare eksplisitt ---
const jsx = readFileSync(new URL('../src/components/InstallPrompt.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const overlayStart = jsx.indexOf('<div\n            className="install-prompt-overlay');
const overlayEnd = jsx.indexOf('<Card');
assert.ok(overlayStart !== -1 && overlayEnd > overlayStart, 'overlay markup not found');
const overlayTag = jsx.slice(overlayStart, overlayEnd);

test('overlay has no click handler (no backdrop dismiss)', () => {
    assert.ok(overlayTag.includes('data-testid="install-prompt"'));
    assert.doesNotMatch(overlayTag, /onClick|onPointer|onMouse|onTouch/);
});

test('component uses the arrival guard and guards all three buttons', () => {
    assert.match(jsx, /createArrivalGuard/);
    assert.match(jsx, /guard\.shouldIgnoreClick/);
    assert.match(jsx, /guard\.markShown\(\)/);
    assert.match(jsx, /guard\.isMidInteraction\(document\.activeElement\)/);
    assert.match(jsx, /aria-label="Lukk" onClick=\{guarded\(dismiss\)\}/);
    assert.match(jsx, /onClick=\{guarded\(dismiss\)\}>\s*Ikke nå/);
    assert.match(jsx, /onClick=\{guarded\(install\)\}/);
    assert.doesNotMatch(jsx, /\bdisabled\s*=/);
});

test('Escape stays an explicit keyboard dismiss and prefers-reduced-motion stays in CSS', () => {
    assert.match(jsx, /useEscapeKey\(dismiss, visible\)/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
