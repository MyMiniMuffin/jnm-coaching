import React from 'react';
import AccountMenu from './AccountMenu';
import { CaretLeft, WifiSlash, Eye, Plus } from '@phosphor-icons/react';
import { IconButton } from './ui';
import FormSubmissions from './FormSubmissions';

// coachHome: inbox (Postkasse) and «Ny utøver» live here, only on the coach's athlete list.
const Header = React.memo(({ user, viewingClient, onLogout, onClearClient, isOffline = false, isClientPreview = false, onToggleClientPreview, previewDisabled = false, hideClientBack = false, coachHome = false, onNewAthlete, notificationPermission, onEnableNotifications }) => (
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
                    <button type="button" onClick={onToggleClientPreview} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-accent active:bg-white/60 focus-visible:outline-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-accent">
                        Tilbake til coach
                    </button>
                </div>
            </div>
        )}
        {viewingClient ? (
            <div className="header-inner flex flex-nowrap items-center py-3 gap-1 lg:gap-2 duo:py-3.5 duo-lg:py-4">
                {!hideClientBack && onClearClient && (
                <button
                    type="button"
                    onClick={onClearClient}
                    aria-label="Tilbake til utøverlisten"
                    data-testid="header-client-back"
                    className="flex min-h-11 items-center gap-0.5 rounded-lg px-2.5 py-2 text-accent transition-colors active:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-100"
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
                <AccountMenu user={isClientPreview ? null : user} onLogout={isClientPreview ? undefined : onLogout} notificationPermission={notificationPermission} onEnableNotifications={onEnableNotifications} />
            </div>
        ) : (
            <div className="header-inner flex flex-nowrap items-center justify-between gap-2 py-3 duo:py-3.5 duo-lg:py-4">
                <p className="min-w-0 flex-1 truncate font-semibold text-ink">{user.name}</p>
                <div className="flex shrink-0 items-center gap-1">
                    {coachHome && !isClientPreview && (
                        <>
                            <FormSubmissions />
                            <button
                                type="button"
                                aria-label="Ny utøver"
                                onClick={onNewAthlete}
                                className="inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation select-none items-center justify-center rounded-full bg-ink text-white transition-colors active:bg-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-ink/90"
                            >
                                <Plus size={20} weight="bold" aria-hidden="true" />
                            </button>
                        </>
                    )}
                    <AccountMenu user={isClientPreview ? null : user} onLogout={isClientPreview ? undefined : onLogout} notificationPermission={notificationPermission} onEnableNotifications={onEnableNotifications} />
                </div>
            </div>
        )}
    </header>
));

export default Header;
