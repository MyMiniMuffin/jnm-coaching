import React, { useCallback, useEffect, useRef } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { NAV_ITEMS, APP_ICON } from '../lib/config';
import { haptic } from '../lib/haptic';
import { useVisualViewportVars } from '../lib/visualViewport';
import { hasNativeRail, onNativeRailAction, postNativeRailState } from '../lib/nativeRail';

const stopTouchBubble = (event) => {
    event.stopPropagation();
};

const NavButton = React.memo(({ item, isActive, onClick, variant }) => {
    const Icon = item.icon;
    if (variant === 'sidebar') {
        return (
            <button
                type="button"
                onClick={() => onClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                        ? 'bg-white text-accent-hover font-semibold shadow-sm ring-1 ring-surface-200'
                        : 'text-ink-muted font-medium hover:bg-white/70 hover:text-ink'
                }`}
            >
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                {item.label}
            </button>
        );
    }

    if (variant === 'rail') {
        return (
            <button
                type="button"
                onClick={() => onClick(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`app-rail-btn rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                        ? 'bg-white text-accent-hover shadow-sm ring-1 ring-surface-200/70'
                        : 'text-ink-muted hover:bg-white/60 hover:text-ink'
                }`}
            >
                <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onClick(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={`relative z-10 flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[44px] rounded-xl transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isActive ? 'text-accent-hover' : 'text-ink-muted'}`}
        >
            <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
            <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
        </button>
    );
});

/**
 * shell: 'narrow' | 'wide' | 'rail'
 * onBack: optional handler for Duo rail top pill (drill-downs)
 */
const Navigation = React.memo(({ activeTab, setActiveTab, shell = 'narrow', onBack = null }) => {
    const isWide = shell === 'wide';
    const isRail = shell === 'rail';
    const showBack = isRail && typeof onBack === 'function';
    const railRef = useRef(null);
    useVisualViewportVars(railRef, isRail);

    const handleTabClick = useCallback((id) => {
        if (id !== activeTab) haptic('tap');
        setActiveTab(id);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, [activeTab, setActiveTab]);

    const handleBack = useCallback(() => {
        if (typeof onBack !== 'function') return;
        haptic('tap');
        onBack();
    }, [onBack]);

    // iPhone Duo: the native app draws the rail (Liquid Glass). The DOM rail stays
    // as the fallback for browsers and non-Duo devices, where no handler exists.
    const nativeRail = isRail && hasNativeRail();
    const backRef = useRef(handleBack);
    backRef.current = handleBack;

    useEffect(() => {
        if (!hasNativeRail()) return undefined;
        return onNativeRailAction(({ action, id }) => {
            if (!isRail) return;
            if (action === 'back') {
                backRef.current();
            } else if (action === 'select' && NAV_ITEMS.some((item) => item.id === id)) {
                // Native already played the haptic.
                setActiveTab(id);
                window.scrollTo({ top: 0, behavior: 'auto' });
            }
        });
    }, [isRail, setActiveTab]);

    useEffect(() => {
        if (!hasNativeRail()) return undefined;
        postNativeRailState({ visible: isRail, activeId: activeTab, showBack, items: NAV_ITEMS });
        return undefined;
    }, [isRail, activeTab, showBack]);

    // Hide the native rail when this navigation unmounts (screens without nav).
    useEffect(() => () => {
        postNativeRailState({ visible: false, activeId: '', showBack: false, items: NAV_ITEMS });
    }, []);

    const activeIndex = NAV_ITEMS.findIndex(item => item.id === activeTab);
    const pillStyle = { transform: `translateX(${activeIndex * 100}%)` };

    return (
        <>
            {/* Desktop / iPad left sidebar — unchanged for non-Duo wide */}
            <aside
                className={`app-sidebar ${isWide ? 'flex' : 'hidden'}`}
                aria-label="Hovednavigasjon"
                data-testid="app-sidebar"
            >
                <div className="flex items-center gap-3 px-5 pt-6 pb-5">
                    <img src={APP_ICON} alt="" className="h-10 w-10 rounded-lg" />
                    <div>
                        <p className="font-display text-[1.35rem] leading-none text-ink">JNM</p>
                        <p className="mt-1 text-xs text-ink-muted">Coaching</p>
                    </div>
                </div>
                <nav className="flex flex-1 flex-col gap-1 px-3">
                    {NAV_ITEMS.map((item) => (
                        <NavButton
                            key={item.id}
                            item={item}
                            isActive={activeTab === item.id}
                            onClick={handleTabClick}
                            variant="sidebar"
                        />
                    ))}
                </nav>
            </aside>

            {/* iPhone Duo floating right rail */}
            <div
                ref={railRef}
                className={`app-rail ${isRail && !nativeRail ? 'flex' : 'hidden'}`}
                data-native={nativeRail ? 'true' : undefined}
                data-testid="app-rail"
                role="navigation"
                aria-label="Duo-navigasjon"
            >
                <div
                    className="app-rail-inner"
                    data-swipe-ignore="true"
                    data-testid="app-rail-inner"
                    onTouchStart={stopTouchBubble}
                    onTouchMove={stopTouchBubble}
                    onTouchEnd={stopTouchBubble}
                    onTouchCancel={stopTouchBubble}
                >
                    {showBack && (
                        <div className="app-rail-pill app-rail-back-pill" data-testid="app-rail-back-pill">
                            <button
                                type="button"
                                onClick={handleBack}
                                aria-label="Tilbake"
                                data-testid="app-rail-back"
                                className="app-rail-btn rounded-full text-ink transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                                <CaretLeft size={24} />
                            </button>
                        </div>
                    )}
                    <nav className="app-rail-pill app-rail-tabs" aria-label="Hovednavigasjon">
                        {NAV_ITEMS.map((item) => (
                            <NavButton
                                key={item.id}
                                item={item}
                                isActive={activeTab === item.id}
                                onClick={handleTabClick}
                                variant="rail"
                            />
                        ))}
                    </nav>
                </div>
            </div>

            {/* Phone bottom nav — all non-Duo phones */}
            <nav
                className={`mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-surface-200/80 ${isWide || isRail ? 'hidden' : ''}`}
                aria-label="Hovednavigasjon"
                data-testid="mobile-bottom-nav"
            >
                <div className="relative grid grid-cols-5 h-[4.35rem] max-w-md sm:max-w-3xl mx-auto px-1.5">
                    <div className="absolute inset-x-1.5 top-2.5 bottom-2.5 pointer-events-none">
                        <div className="h-full w-1/5 rounded-xl nav-pill" style={pillStyle} />
                    </div>
                    {NAV_ITEMS.map((item) => (
                        <NavButton key={item.id} item={item} isActive={activeTab === item.id} onClick={handleTabClick} />
                    ))}
                </div>
                <div className="safe-area-pb" />
            </nav>
        </>
    );
});

export default Navigation;
