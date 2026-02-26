import React, { useCallback } from 'react';
import { NAV_ITEMS } from '../lib/config';

const Navigation = React.memo(({ activeTab, setActiveTab }) => {
    const handleTabClick = useCallback((id) => {
        setActiveTab(id);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [setActiveTab]);

    return (
        <div className="fixed bottom-0 left-0 right-0 glass-nav z-50 border-t border-surface-200">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleTabClick(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all active:scale-90 ${isActive ? 'text-ink' : 'text-ink-faint'}`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                            <span className={`text-[10px] font-medium ${isActive ? 'text-ink' : 'text-ink-faint'}`}>{item.label}</span>
                        </button>
                    );
                })}
            </div>
            {/* Safe area spacer for iPhone home indicator */}
            <div className="safe-area-pb" />
        </div>
    );
});

export default Navigation;
