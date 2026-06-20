import React from 'react';
import { Briefcase, User, LogOut, ChevronLeft } from 'lucide-react';

const Header = React.memo(({ title, user, viewingClient, onLogout, onClearClient }) => (
    <header className="sticky top-0 z-40 border-b border-surface-200/80 bg-surface-50/86 backdrop-blur-xl shadow-[0_10px_30px_rgba(23,23,23,0.045)]">
        <div className="safe-area-pt" />
        {viewingClient ? (
            /* Coach viewing a client — standard back-nav pattern */
            <div className="flex items-center max-w-md mx-auto px-3 py-3 gap-2">
                <button
                    type="button"
                    onClick={onClearClient}
                    aria-label="Tilbake til klientliste"
                    className="flex items-center gap-0.5 px-2.5 py-2 rounded-xl text-accent hover:bg-white/70 hover:shadow-[0_6px_16px_rgba(23,23,23,0.06)] transition-all shrink-0"
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
            /* Normal header */
            <div className="flex justify-between items-center max-w-md mx-auto px-5 py-4">
                <div>
                    <h1 className="text-[1.72rem] font-display text-ink">{title}</h1>
                    <span className="text-sm text-ink-muted flex items-center gap-1 mt-0.5">
                        {user.role === 'coach' ? <Briefcase size={12} /> : <User size={12} />}
                        {user.name}
                    </span>
                </div>
                <button type="button" onClick={onLogout} aria-label="Logg ut" className="text-ink-faint hover:text-ink p-2.5 rounded-xl hover:bg-white/70 hover:shadow-[0_6px_16px_rgba(23,23,23,0.06)] transition-all">
                    <LogOut size={20} />
                </button>
            </div>
        )}
    </header>
));

export default Header;
