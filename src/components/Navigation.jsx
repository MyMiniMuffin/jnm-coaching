import React, { useCallback } from 'react';
import { NAV_ITEMS, APP_ICON } from '../lib/config';

const NavButton = React.memo(({ item, isActive, onClick, variant }) => {
    const Icon = item.icon;
    if (variant === 'sidebar') {
        return (
            <button
                type="button"
                onClick={() => onClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                        ? 'bg-white text-ink font-semibold shadow-sm'
                        : 'text-ink-muted font-medium hover:bg-white/70 hover:text-ink'
                }`}
            >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.75} />
                {item.label}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onClick(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={`relative z-10 flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[44px] rounded-xl transition-all duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isActive ? 'text-ink -translate-y-0.5' : 'text-ink-muted'}`}
        >
            <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
            <span className={`text-[10px] ${isActive ? 'font-semibold text-ink' : 'font-medium text-ink-muted'}`}>{item.label}</span>
        </button>
    );
});

const Navigation = React.memo(({ activeTab, setActiveTab }) => {
    const handleTabClick = useCallback((id) => {
        setActiveTab(id);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, [setActiveTab]);

    const activeIndex = NAV_ITEMS.findIndex(item => item.id === activeTab);
    const pillStyle = {
        transform: `translateX(${activeIndex * 100}%)`,
        width: `${100 / NAV_ITEMS.length}%`
    };

    return (
        <>
            <aside className="app-sidebar hidden lg:flex" aria-label="Hovednavigasjon">
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

            <nav className="fixed bottom-0 left-0 right-0 glass-nav z-50 border-t border-surface-200/80 lg:hidden" aria-label="Hovednavigasjon">
                <div className="relative grid grid-cols-5 h-[4.35rem] max-w-md mx-auto px-1.5">
                    <div
                        className="absolute top-2.5 bottom-2.5 rounded-xl bg-surface-100 nav-pill pointer-events-none"
                        style={pillStyle}
                    />
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
