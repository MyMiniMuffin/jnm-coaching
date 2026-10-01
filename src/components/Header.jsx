import React from 'react';
import { LogOut, ChevronLeft, WifiOff } from 'lucide-react';

const Header = React.memo(({ user, viewingClient, onLogout, onClearClient, isOffline = false }) => (
    <header className="sticky top-0 z-40 border-b border-surface-200/80 bg-surface-50">
        <div className="safe-area-pt" />
        {isOffline && (
            <div className="bg-warning text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2">
                <WifiOff size={14} /> Ingen nettilkobling — viser lagrede data
            </div>
        )}
        {viewingClient ? (
            <div className="header-inner flex items-center px-3 py-3 gap-2 lg:px-0 lg:py-4">
                <button
                    type="button"
                    onClick={onClearClient}
                    aria-label="Tilbake til klientliste"
                    className="flex min-h-11 items-center gap-0.5 rounded-lg px-2.5 py-2 text-accent transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
                >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                    <span className="text-sm font-medium">Klienter</span>
                </button>
                <div className="flex-1 text-center min-w-0 lg:text-left">
                    <p className="font-semibold text-ink truncate leading-6">{viewingClient.name}</p>
                    <p className="text-[11px] leading-4 text-ink-muted">@{viewingClient.username}</p>
                </div>
                <button
                    type="button"
                    onClick={onLogout}
                    aria-label="Logg ut"
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
                >
                    <LogOut size={20} />
                </button>
            </div>
        ) : (
            <div className="header-inner flex justify-between items-center px-5 py-3 lg:px-0 lg:py-4">
                <p className="font-semibold text-ink truncate min-w-0">{user.name}</p>
                <button type="button" onClick={onLogout} aria-label="Logg ut" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0">
                    <LogOut size={20} />
                </button>
            </div>
        )}
    </header>
));

export default Header;
