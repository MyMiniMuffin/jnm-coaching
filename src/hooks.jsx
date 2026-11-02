import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { DUO_MEDIA_QUERY } from './lib/duoBreakpoint';
import { useShellMode, useShellWide, useShellRail } from './lib/shellMode';

// --- SWIPE HOOK ---
const DEFAULT_SWIPE_IGNORE = 'input, textarea, select, [contenteditable="true"], [role="slider"], [role="dialog"], [data-swipe-ignore="true"]';
const DIRECTION_LOCK_DISTANCE = 10;
const CLICK_SUPPRESS_MS = 400;

/** True when the touch starts inside something that scrolls horizontally on its own. */
const isInsideHorizontalScroller = (target, boundary) => {
    let el = target instanceof Element ? target : target?.parentElement;
    while (el && el !== boundary && el !== document.body) {
        if (el.scrollWidth > el.clientWidth + 1) {
            const overflowX = window.getComputedStyle(el).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll') return true;
        }
        el = el.parentElement;
    }
    return false;
};

/**
 * Horizontal swipe detection tuned for iOS WKWebView:
 * - direction lock after ~10px, so vertical scrolling never turns into a tab change
 * - start/end read from changedTouches, so quick flicks without touchmove still count
 * - release velocity from the last samples (not average), so short flicks register
 * - swipes may start on buttons/cards; the click that follows a swipe is swallowed
 */
export const useSwipe = (onSwipeLeft, onSwipeRight, options = {}) => {
    const {
        threshold = 64,
        velocityThreshold = 0.35,
        enabled = true,
        onEdgeSwipe,
        ignoreSelector = DEFAULT_SWIPE_IGNORE
    } = options;
    const gesture = React.useRef(null);
    const callbacks = React.useRef({ onSwipeLeft, onSwipeRight, onEdgeSwipe });
    callbacks.current = { onSwipeLeft, onSwipeRight, onEdgeSwipe };
    const suppressClickUntil = React.useRef(0);

    useEffect(() => {
        const swallowClick = (event) => {
            if (Date.now() < suppressClickUntil.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressClickUntil.current = 0;
            }
        };
        document.addEventListener('click', swallowClick, true);
        return () => document.removeEventListener('click', swallowClick, true);
    }, []);

    const reset = useCallback(() => { gesture.current = null; }, []);

    const onTouchStart = useCallback((e) => {
        gesture.current = null;
        if (!enabled || e.touches.length !== 1) return;
        const target = e.target;
        if (ignoreSelector && target?.closest?.(ignoreSelector)) return;
        if (typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]')) return;
        if (isInsideHorizontalScroller(target, e.currentTarget)) return;
        const touch = e.touches[0];
        const now = Date.now();
        gesture.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastT: now,
            velocity: 0,
            lock: null
        };
    }, [enabled, ignoreSelector]);

    const onTouchMove = useCallback((e) => {
        const g = gesture.current;
        if (!g) return;
        if (e.touches.length !== 1) { gesture.current = null; return; }
        const touch = e.touches[0];
        const dx = touch.clientX - g.startX;
        const dy = touch.clientY - g.startY;
        if (!g.lock && Math.max(Math.abs(dx), Math.abs(dy)) > DIRECTION_LOCK_DISTANCE) {
            g.lock = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
        }
        if (g.lock === 'y') { gesture.current = null; return; }
        const now = Date.now();
        const dt = now - g.lastT;
        if (dt > 0) {
            const instant = (touch.clientX - g.lastX) / dt;
            g.velocity = g.velocity * 0.4 + instant * 0.6;
            g.lastX = touch.clientX;
            g.lastT = now;
        }
    }, []);

    const onTouchEnd = useCallback((e) => {
        const g = gesture.current;
        gesture.current = null;
        if (!enabled || !g) return;
        const touch = e.changedTouches?.[0];
        if (!touch) return;
        const dx = touch.clientX - g.startX;
        const dy = touch.clientY - g.startY;
        const absX = Math.abs(dx);
        if (absX < Math.abs(dy) * 1.4) return;
        // Ignore a stale velocity if the finger paused before lifting.
        const releaseVelocity = Date.now() - g.lastT > 80 ? 0 : g.velocity;
        const flick = absX > threshold * 0.45 && Math.abs(releaseVelocity) > velocityThreshold
            && Math.sign(releaseVelocity) === Math.sign(dx);
        if (absX < threshold && !flick) return;

        const isLeftSwipe = dx < 0;
        const { onSwipeLeft: left, onSwipeRight: right, onEdgeSwipe: edge } = callbacks.current;
        const payload = { distance: -dx, velocity: Math.abs(releaseVelocity) };
        const handler = isLeftSwipe ? left : right;
        const handled = handler ? handler(payload) !== false : false;
        suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS;
        if (!handled && edge) edge(isLeftSwipe ? 'left' : 'right');
    }, [enabled, threshold, velocityThreshold]);

    return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset };
};

// --- PULL TO REFRESH HOOK ---
export const usePullToRefresh = (onRefresh, options = {}) => {
    const { threshold = 80, enabled = true } = options;
    const [pulling, setPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startY = React.useRef(null);
    const containerRef = React.useRef(null);

    const handleTouchStart = useCallback((e) => {
        if (!enabled || refreshing) return;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop <= 0) {
            startY.current = e.touches[0].clientY;
            setPulling(true);
        }
    }, [enabled, refreshing]);

    const handleTouchMove = useCallback((e) => {
        if (!pulling || startY.current === null || refreshing) return;
        const currentY = e.touches[0].clientY;
        const distance = Math.max(0, (currentY - startY.current) * 0.5);
        setPullDistance(Math.min(distance, threshold * 1.5));
    }, [pulling, refreshing, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (!pulling) return;

        if (pullDistance >= threshold && onRefresh) {
            setRefreshing(true);
            try {
                await onRefresh();
            } finally {
                setRefreshing(false);
            }
        }

        setPulling(false);
        setPullDistance(0);
        startY.current = null;
    }, [pulling, pullDistance, threshold, onRefresh]);

    const handleTouchCancel = useCallback(() => {
        setPulling(false);
        setPullDistance(0);
        startY.current = null;
    }, []);

    const pullIndicator = useMemo(() => {
        if (pullDistance <= 0 && !refreshing) return null;

        return (
            <div
                className="fixed left-0 right-0 flex justify-center z-50 transition-transform duration-200"
                style={{
                    top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
                    transform: `translateY(${refreshing ? 20 : pullDistance - 40}px)`,
                    opacity: refreshing ? 1 : Math.min(pullDistance / threshold, 1)
                }}
            >
                <div className={`bg-ink text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg ${refreshing ? 'animate-pulse' : ''}`}>
                    <CircleNotch size={16} className={refreshing ? 'animate-spin' : ''} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
                    {refreshing ? 'Oppdaterer…' : pullDistance >= threshold ? 'Slipp for å oppdatere' : 'Dra ned…'}
                </div>
            </div>
        );
    }, [pullDistance, refreshing, threshold]);

    return {
        containerRef,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchCancel
        },
        pullIndicator,
        refreshing
    };
};

// --- Online/offline status hook ---
export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

/** Entry media for wide shell (see shellMode sticky rules). */
export const DESKTOP_QUERY = DUO_MEDIA_QUERY;

/**
 * True for left-sidebar wide shell only.
 * Duo rail (including 390 closed) is NOT desktop — use useShellRail / useShellMode.
 */
export const useDesktop = () => useShellWide();

export { useShellMode, useShellWide, useShellRail };

// --- Fokus-trapping hook for modaler ---
export const useFocusTrap = (active = true) => {
    const ref = React.useRef(null);

    useEffect(() => {
        if (!active || !ref.current) return;
        const element = ref.current;

        // Flytt fokus til modal
        const previouslyFocused = document.activeElement;
        const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) focusable[0].focus();

        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;
            const focusableEls = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusableEls.length === 0) return;
            const first = focusableEls[0];
            const last = focusableEls[focusableEls.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus();
            }
        };
    }, [active]);

    return ref;
};

// --- Escape-tast hook for modaler ---
export const useEscapeKey = (onClose, active = true) => {
    useEffect(() => {
        if (!active) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose, active]);
};
