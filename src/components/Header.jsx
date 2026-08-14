import React from 'react';
import { Briefcase, User, LogOut, ChevronLeft } from 'lucide-react';

const Header = React.memo(({ user, viewingClient, onLogout, onClearClient }) => (
    <header className="sticky top-0 z-40 border-b border-surface-200/80 bg-surface-50/94 backdrop-blur-xl">
        <div className="safe-area-pt" />
        {viewingClient ? (
            /* Coach viewing a client — standard back-nav pattern */
            <div className="flex items-center max-w-md mx-auto px-3 py-3 gap-2">
                <button
                    type="button"
                    onClick={onClearClient}
                    aria-label="Tilbake til klientliste"
                    className="flex items-center gap-0.5 px-2.5 py-2 rounded-lg text-accent hover:bg-surface-100 transition-colors shrink-0"
                >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                    <span className="text-sm font-medium">Klienter</span>
                </button>
                <div className="flex-1 text-center min-w-0">
                    <p className="font-semibold text-ink truncate leading-tight">{viewingClient.name}</p>
                    <p className="text-[11px] text-ink-muted">@{viewingClient.username}</p>
                </div>
                <div className="w-[80px]" />
            </div>
        ) : (
            <div className="flex justify-between items-center max-w-md mx-auto px-5 py-3">
                <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{user.name}</p>
                    <span className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                        {user.role === 'coach' ? <Briefcase size={12} /> : <User size={12} />}
                        {user.role === 'coach' ? 'Coach' : 'Utøver'}
                    </span>
                </div>
                <button type="button" onClick={onLogout} aria-label="Logg ut" className="text-ink-faint hover:text-ink p-2.5 rounded-lg hover:bg-surface-100 transition-colors">
                    <LogOut size={20} />
                </button>
            </div>
        )}
    </header>
));

export default Header;
