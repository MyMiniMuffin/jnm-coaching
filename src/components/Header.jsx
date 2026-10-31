import React from 'react';
import AccountMenu from './AccountMenu';
import { SignOut, CaretLeft, WifiSlash, Eye } from '@phosphor-icons/react';
import { IconButton } from './ui';

const Header = React.memo(({ user, viewingClient, onLogout, onClearClient, isOffline = false, isClientPreview = false, onToggleClientPreview, previewDisabled = false, hideClientBack = false }) => (
    <header className="app-header sticky top-0 z-40 border-b border-surface-200/80 bg-surface-50">
        <div className="app-header-top-inset" aria-hidden="true" />
        {isOffline && (
            <div className="bg-warning text-ink text-center text-sm py-2 px-4 flex items-center justify-center gap-2">
                <WifiSlash size={14} /> Ingen nettilkobling. Viser lagrede data.
            </div>
        )}
        {isClientPreview && (
            <div className="border-b border-accent/20 bg-accent/10 py-3" role="status">
                <div className="header-inner flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Eye size={16} /> Utøvervisning</p>
                        <p className="mt-1 text-xs text-ink-muted">Forhåndsvisning · Endringer og innsending er deaktivert.</p>
                    </div>
                    <button type="button" onClick={onToggleClientPreview} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        Tilbake til coach
                    </button>
                </div>
            </div>
        )}
        {viewingClient ? (
            <div className="header-inner flex items-center py-3 gap-1 lg:gap-2 duo:py-3.5 duo-lg:py-4">
                {!hideClientBack && onClearClient && (
                <button
                    type="button"
                    onClick={onClearClient}
                    aria-label="Tilbake til utøverlisten"
                    data-testid="header-client-back"
                    className="flex min-h-11 items-center gap-0.5 rounded-lg px-2.5 py-2 text-accent transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
                >
                    <CaretLeft size={20} />
                    <span className="text-sm font-medium">Utøvere</span>
                </button>
                )}
                <div className={`flex-1 min-w-0 duo:text-left ${hideClientBack ? 'text-left' : 'text-center'}`}>
                    <p className="font-semibold text-ink truncate leading-6">{viewingClient.name}</p>
                    <p className="truncate text-xs leading-4 text-ink-muted">@{viewingClient.username}</p>
                </div>
                {onToggleClientPreview && (
                    <IconButton onClick={onToggleClientPreview} disabled={previewDisabled} aria-label="Vis som utøver" title="Vis som utøver" className="shrink-0 gap-1.5 disabled:opacity-50 lg:px-3">
                        <Eye size={20} />
                        <span className="hidden text-sm font-medium duo:inline">Vis som utøver</span>
                    </IconButton>
                )}
                <AccountMenu user={isClientPreview ? null : user} />
                <IconButton onClick={onLogout} aria-label="Logg ut" className="shrink-0">
                    <SignOut size={20} />
                </IconButton>
            </div>
        ) : (
            <div className="header-inner flex justify-between items-center py-3 duo:py-3.5 duo-lg:py-4">
                <p className="font-semibold text-ink truncate min-w-0">{user.name}</p>
                <div className="flex items-center gap-1">
                    <AccountMenu user={isClientPreview ? null : user} />
                    <IconButton onClick={onLogout} aria-label="Logg ut" className="shrink-0">
                        <SignOut size={20} />
                    </IconButton>
                </div>
            </div>
        )}
    </header>
));

export default Header;
