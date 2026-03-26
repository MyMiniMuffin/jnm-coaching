import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';

// --- SWIPE HOOK ---
export const useSwipe = (onSwipeLeft, onSwipeRight, options = {}) => {
    const { threshold = 50, enabled = true } = options;
    const touchStart = React.useRef(null);
    const touchEnd = React.useRef(null);

    const onTouchStart = useCallback((e) => {
        if (!enabled) return;
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
    }, [enabled]);

    const onTouchMove = useCallback((e) => {
        if (!enabled) return;
        touchEnd.current = e.targetTouches[0].clientX;
    }, [enabled]);

    const onTouchEnd = useCallback(() => {
        if (!enabled || !touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > threshold;
        const isRightSwipe = distance < -threshold;

        if (isLeftSwipe && onSwipeLeft) onSwipeLeft();
        if (isRightSwipe && onSwipeRight) onSwipeRight();

        touchStart.current = null;
        touchEnd.current = null;
    }, [enabled, threshold, onSwipeLeft, onSwipeRight]);

    return { onTouchStart, onTouchMove, onTouchEnd };
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
        if (!pulling || !startY.current || refreshing) return;
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
                    <Loader2 size={16} className={refreshing ? 'animate-spin' : ''} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
                    {refreshing ? 'Oppdaterer...' : pullDistance >= threshold ? 'Slipp for å oppdatere' : 'Dra ned...'}
                </div>
            </div>
        );
    }, [pullDistance, refreshing, threshold]);

    return {
        containerRef,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd
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
