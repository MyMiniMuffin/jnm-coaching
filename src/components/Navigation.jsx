import React, { useCallback, useMemo } from 'react';
import { NAV_ITEMS } from '../lib/config';

// Memoized knapp — unngår at alle knapper re-rendres ved tab-bytte
const NavButton = React.memo(({ item, isActive, onClick }) => {
    const Icon = item.icon;
    return (
        <button
            onClick={() => onClick(item.id)}
            className={`relative z-10 flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] transition-colors duration-200 active:scale-90 ${isActive ? 'text-ink' : 'text-ink-faint'}`}
        >
            <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
            <span className={`text-[10px] ${isActive ? 'font-semibold text-ink' : 'font-medium text-ink-faint'}`}>{item.label}</span>
        </button>
    );
});

const Navigation = React.memo(({ activeTab, setActiveTab }) => {
    const activeIndex = NAV_ITEMS.findIndex(item => item.id === activeTab);

    const handleTabClick = useCallback((id) => {
        setActiveTab(id);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [setActiveTab]);

    const pillStyle = useMemo(() => ({
        transform: `translateX(${activeIndex * 100}%)`,
        width: `${100 / NAV_ITEMS.length}%`
    }), [activeIndex]);

    return (
        <div className="fixed bottom-0 left-0 right-0 glass-nav z-50 border-t border-surface-200">
            <div className="relative grid grid-cols-5 h-16 max-w-md mx-auto">
                {/* Glidende pill-indikator */}
                <div
                    className="absolute top-2 bottom-2 rounded-xl bg-surface-100 nav-pill pointer-events-none"
                    style={pillStyle}
                />

                {NAV_ITEMS.map((item) => (
                    <NavButton key={item.id} item={item} isActive={activeTab === item.id} onClick={handleTabClick} />
                ))}
            </div>
            <div className="safe-area-pb" />
        </div>
    );
});

export default Navigation;
