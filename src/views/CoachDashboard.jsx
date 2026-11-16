import DeletionRequests from '../components/DeletionRequests';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { X, Trash, User, CaretRight, CircleNotch, Key, MagnifyingGlass, ArrowsDownUp, DotsThree, TrayArrowUp, Archive } from '@phosphor-icons/react';
import { Card, Button, EmptyState, IconButton, TextField, ToggleGroup } from '../components/ui';
import { useEscapeKey } from '../hooks';
import { useConfirm } from '../components/ConfirmDialog';
import { haptic } from '../lib/haptic';
import { formatDateNO } from '../lib/formatters';

const RecentActivityDot = ({ lastActiveAt }) => {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 15000);
        return () => window.clearInterval(interval);
    }, []);
    const lastActive = Date.parse(lastActiveAt);
    if (!Number.isFinite(lastActive) || now - lastActive >= 5 * 60000) return null;
    return (
        <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white"
            role="img"
            aria-label="Aktiv siste 5 minutter"
            title="Aktiv siste 5 minutter"
        />
    );
};

const ClientActionsMenu = ({ client, isPending, open, onOpenChange, onArchive, onReset, onDelete }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (event) => {
            if (event.type === 'keydown' && event.key !== 'Escape') return;
            if (event.type === 'pointerdown' && menuRef.current?.contains(event.target)) return;
            onOpenChange(false);
        };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open, onOpenChange]);

    const run = (event, action) => {
        event.stopPropagation();
        onOpenChange(false);
        action();
    };

    return (
        <div className="relative" ref={menuRef}>
            <IconButton
                type="button"
                aria-label={`Flere handlinger for ${client.name}`}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={isPending}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenChange(!open);
                }}
            >
                <DotsThree size={18} />
            </IconButton>
            {open && (
                <div
                    role="menu"
                    aria-label={`Handlinger for ${client.name}`}
                    className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-surface-200 bg-white p-1 shadow-lg"
                    onClick={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        role="menuitem"
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={(event) => run(event, onArchive)}
                    >
                        {client.is_archived ? <TrayArrowUp size={16} /> : <Archive size={16} />}
                        {client.is_archived ? 'Gjenopprett' : 'Arkiver'}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={(event) => run(event, onReset)}
                    >
                        <Key size={16} />
                        Tilbakestill passord
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-error hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={(event) => run(event, onDelete)}
                    >
                        <Trash size={16} />
                        Slett utøver
                    </button>
                </div>
            )}
        </div>
    );
};

const CoachDashboard = React.memo(({ allUsers = [], isLoading, newAthleteRequest = 0, onSelectClient, onAddClient, onDeleteClient, onArchiveClient, onResetPassword }) => {
    const [showModal, setShowModal] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [resetTarget, setResetTarget] = useState(null);
    const [isResetting, setIsResetting] = useState(false);
    const [pendingClientAction, setPendingClientAction] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('unread');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef(null);
    const searchButtonRef = useRef(null);
    const confirm = useConfirm();

    // Memoize filtrerte lister
    const { activeClients, archivedClients } = useMemo(() => ({
        activeClients: (Array.isArray(allUsers) ? allUsers : []).filter(u => u.role === 'athlete' && !u.is_archived),
        archivedClients: (Array.isArray(allUsers) ? allUsers : []).filter(u => u.role === 'athlete' && u.is_archived)
    }), [allUsers]);
    const totalUnreadCheckins = useMemo(
        () => activeClients.reduce((sum, client) => sum + (Number(client.unreadCheckins) || 0), 0),
        [activeClients]
    );

    const displayedClients = useMemo(() => {
        const source = showArchived ? archivedClients : activeClients;
        const query = searchTerm.trim().toLowerCase();
        const filtered = query
            ? source.filter(client => (
                client.name?.toLowerCase().includes(query) ||
                client.username?.toLowerCase().includes(query)
            ))
            : source;

        return [...filtered].sort((a, b) => {
            if (sortBy === 'name') {
                return (a.name || '').localeCompare(b.name || '', 'nb');
            }
            if (sortBy === 'lastCheckin') {
                const aParsed = a.lastCheckinDate ? new Date(a.lastCheckinDate).getTime() : 0;
                const bParsed = b.lastCheckinDate ? new Date(b.lastCheckinDate).getTime() : 0;
                const aTime = Number.isNaN(aParsed) ? 0 : aParsed;
                const bTime = Number.isNaN(bParsed) ? 0 : bParsed;
                return bTime - aTime;
            }
            return (Number(b.unreadCheckins) || 0) - (Number(a.unreadCheckins) || 0)
                || (a.name || '').localeCompare(b.name || '', 'nb');
        });
    }, [activeClients, archivedClients, searchTerm, showArchived, sortBy]);

    const closeModal = useCallback(() => setShowModal(false), []);
    // Header «Ny utøver» bumps the counter in App. Remember the value seen on
    // mount so a remount (open an athlete, then return) does not reopen the modal.
    const seenNewAthleteRequest = useRef(newAthleteRequest);
    useEffect(() => {
        if (newAthleteRequest === seenNewAthleteRequest.current) return;
        seenNewAthleteRequest.current = newAthleteRequest;
        setShowModal(true);
    }, [newAthleteRequest]);
    useEscapeKey(closeModal, showModal);

    // Delay focus to after scale-in animation finishes for stable mobile focus
    const newAthleteNameRef = useRef(null);
    const resetPasswordInputRef = useRef(null);
    useEffect(() => {
        if (!showModal) return;
        const t = setTimeout(() => newAthleteNameRef.current?.focus(), 250);
        return () => clearTimeout(t);
    }, [showModal]);
    useEffect(() => {
        if (!resetTarget) return;
        const t = setTimeout(() => resetPasswordInputRef.current?.focus(), 250);
        return () => clearTimeout(t);
    }, [resetTarget]);
    const showActive = useCallback(() => setShowArchived(false), []);
    const showArchivedClients = useCallback(() => setShowArchived(true), []);
    const handleSearchChange = useCallback((e) => setSearchTerm(e.target.value), []);
    const handleSortChange = useCallback((e) => setSortBy(e.target.value), []);

    // Search disclosure: focus moves into the field on open and back to the icon on close.
    useEffect(() => {
        if (searchOpen) searchInputRef.current?.focus();
    }, [searchOpen]);
    const closeSearch = useCallback(() => {
        setSearchTerm('');
        setSearchOpen(false);
        searchButtonRef.current?.focus();
    }, []);
    const toggleSearch = useCallback(() => {
        if (!searchOpen) setSearchOpen(true);
        else if (searchTerm.trim()) searchInputRef.current?.focus(); // a live filter stays visible
        else closeSearch();
    }, [searchOpen, searchTerm, closeSearch]);
    const handleSearchKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeSearch();
        }
    }, [closeSearch]);

    const handleFormSubmit = useCallback(async (e) => {
        e.preventDefault();
        haptic('save');
        setIsCreating(true);
        try {
            const fd = new FormData(e.target);
            await onAddClient(Object.fromEntries(fd));
            e.target.reset();
            setShowModal(false);
        } finally {
            setIsCreating(false);
        }
    }, [onAddClient]);

    const handleDelete = useCallback(async (clientId) => {
        if (await confirm('Slette denne utøveren permanent?', {
            title: 'Slett utøver',
            confirmText: 'Slett',
            destructive: true
        })) {
            setPendingClientAction({ clientId, type: 'delete' });
            try {
                await onDeleteClient(clientId);
            } finally {
                setPendingClientAction(null);
            }
        }
    }, [confirm, onDeleteClient]);

    const handleArchiveToggle = useCallback(async (client) => {
        const archiving = !client.is_archived;
        const confirmed = await confirm(
            archiving
                ? 'Utøveren flyttes til arkivet og får begrenset tilgang.'
                : 'Utøveren blir aktiv igjen og får tilbake full tilgang.',
            {
                title: archiving ? 'Arkiver utøver?' : 'Gjenopprett utøver?',
                confirmText: archiving ? 'Arkiver' : 'Gjenopprett'
            }
        );
        if (!confirmed) return;
        setPendingClientAction({ clientId: client.id, type: archiving ? 'archive' : 'restore' });
        try {
            await onArchiveClient(client.id, archiving);
        } finally {
            setPendingClientAction(null);
        }
    }, [confirm, onArchiveClient]);

    const openResetModal = useCallback((client) => {
        setResetTarget(client);
    }, []);

    const closeResetModal = useCallback(() => {
        setResetTarget(null);
    }, []);

    useEscapeKey(closeResetModal, !!resetTarget);

    const handleResetSubmit = useCallback(async (e) => {
        e.preventDefault();
        haptic('save');
        setIsResetting(true);
        setPendingClientAction({ clientId: resetTarget.id, type: 'reset' });
        try {
            const password = new FormData(e.target).get('password');
            await onResetPassword(resetTarget.id, password);
            setResetTarget(null);
        } finally {
            setIsResetting(false);
            setPendingClientAction(null);
        }
    }, [resetTarget, onResetPassword]);

    return (
        <div className="space-y-3 pb-8 animate-slide-up">
            <DeletionRequests allUsers={allUsers} onSelectClient={onSelectClient} />
            {showModal && (
                <div className="modal-backdrop fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={closeModal}>
                    <Card className="modal-scroll-panel w-full max-w-sm p-5 sm:p-6 animate-scale-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="new-athlete-title">
                        <div className="flex justify-between items-center mb-6">
                            <h2 id="new-athlete-title" className="text-xl font-display">Ny utøver</h2>
                            <IconButton onClick={closeModal} aria-label="Lukk">
                                <X size={20} />
                            </IconButton>
                        </div>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <TextField ref={newAthleteNameRef} id="new-athlete-name" label="Fullt navn" required name="name" type="text" placeholder="Ola Nordmann" />
                            <TextField id="new-athlete-username" label="Brukernavn" required name="username" type="text" placeholder="ola_nordmann" autoComplete="off" pattern="[a-zA-Z0-9_]+" title="Kun bokstaver, tall og understrek" />
                            <TextField id="new-athlete-password" label="Midlertidig passord (byttes ved første innlogging)" required name="password" type="password" minLength="6" placeholder="Minst 6 tegn" autoComplete="new-password" />
                            <Button type="submit" size="lg" className="w-full" disabled={isCreating}>
                                {isCreating ? <><CircleNotch size={18} className="animate-spin" /> Oppretter…</> : 'Opprett utøver'}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* Passord-reset modal */}
            {resetTarget && (
                <div className="modal-backdrop fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={closeResetModal}>
                    <Card className="modal-scroll-panel w-full max-w-sm p-5 sm:p-6 animate-scale-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reset-password-title" aria-describedby="reset-password-description">
                        <div className="flex justify-between items-center mb-6">
                            <h2 id="reset-password-title" className="text-xl font-display">Tilbakestill passord</h2>
                            <IconButton onClick={closeResetModal} aria-label="Lukk">
                                <X size={20} />
                            </IconButton>
                        </div>
                        <p id="reset-password-description" className="text-sm text-ink-muted mb-4">Midlertidig passord for <span className="font-medium text-ink">{resetTarget.name}</span></p>
                        <form onSubmit={handleResetSubmit} className="space-y-4">
                            <TextField ref={resetPasswordInputRef} id="reset-athlete-password" label="Midlertidig passord (byttes ved neste innlogging)" required name="password" type="password" minLength="6" placeholder="Minst 6 tegn" autoComplete="new-password" />
                            <Button type="submit" size="lg" className="w-full" disabled={isResetting}>
                                {isResetting ? <><CircleNotch size={18} className="animate-spin" /> Tilbakestiller…</> : <><Key size={18} /> Tilbakestill passord</>}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* Slim summary: one calm line, the unread count is the only accent */}
            <p className="px-1 text-sm tabular-nums text-ink-muted" data-testid="coach-summary">
                {activeClients.length} {activeClients.length === 1 ? 'aktiv' : 'aktive'}
                {' · '}
                <span className={totalUnreadCheckins > 0 ? 'font-medium text-accent' : undefined}>
                    {totalUnreadCheckins} {totalUnreadCheckins === 1 ? 'ulest' : 'uleste'}
                </span>
            </p>

            {/* One-row toolbar: segments left, search and sort as icon buttons right */}
            <div className="flex items-center gap-1" data-testid="coach-toolbar">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <ToggleGroup
                        className="min-w-0"
                        value={showArchived ? 'archived' : 'active'}
                        onChange={(value) => value === 'archived' ? showArchivedClients() : showActive()}
                        options={[
                            { value: 'active', label: 'Aktive' },
                            { value: 'archived', label: archivedClients.length > 0 ? <>Arkivert <span className="tabular-nums">{archivedClients.length}</span></> : 'Arkivert' }
                        ]}
                    />
                    {isLoading && displayedClients.length > 0 && (
                        <CircleNotch size={14} className="shrink-0 animate-spin text-ink-faint" role="img" aria-label="Oppdaterer" />
                    )}
                </div>
                {(activeClients.length > 0 || archivedClients.length > 0) && (
                    <>
                        <IconButton
                            ref={searchButtonRef}
                            aria-label="Søk etter utøver"
                            aria-expanded={searchOpen}
                            aria-controls="coach-search"
                            onClick={toggleSearch}
                            className={`shrink-0 touch-manipulation ${searchOpen || searchTerm ? 'bg-surface-200 text-ink' : ''}`}
                        >
                            <MagnifyingGlass size={20} aria-hidden="true" />
                        </IconButton>
                        <div className={`relative inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-ink-muted transition-colors focus-within:ring-2 focus-within:ring-accent active:bg-surface-200 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-100 [@media(hover:hover)_and_(pointer:fine)]:hover:text-ink ${sortBy !== 'unread' ? 'bg-surface-200 text-ink' : ''}`}>
                            <ArrowsDownUp size={20} aria-hidden="true" />
                            {/* Native select overlay: keyboard, screen reader and OS picker for free */}
                            <select
                                value={sortBy}
                                onChange={handleSortChange}
                                aria-label="Sorter utøvere"
                                className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full text-base opacity-0 focus:outline-none"
                            >
                                <option value="unread">Uleste først</option>
                                <option value="lastCheckin">Siste ukesrapport</option>
                                <option value="name">Navn</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            {searchOpen && (
                <div id="coach-search" role="search" className="relative">
                    <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} aria-hidden="true" />
                    <input
                        ref={searchInputRef}
                        type="search"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Søk etter utøver"
                        aria-label="Søk etter utøver"
                        autoComplete="off"
                        enterKeyHint="search"
                        className="min-h-11 w-full min-w-0 rounded-xl border border-surface-200 bg-surface-50 py-2 pl-12 pr-12 text-base font-medium outline-none transition-[border-color,box-shadow] placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    <IconButton
                        aria-label="Lukk søk"
                        onClick={closeSearch}
                        className="absolute right-0 top-1/2 -translate-y-1/2 touch-manipulation"
                    >
                        <X size={18} aria-hidden="true" />
                    </IconButton>
                </div>
            )}

            {/* Client List */}
            <div className="space-y-2 duo:grid duo:grid-cols-2 duo:gap-3 duo:space-y-0 duo-split-grid">
                {displayedClients.length === 0 && isLoading ? (
                    <div className="space-y-2 animate-pulse duo:col-span-2 duo:grid duo:grid-cols-2 duo:gap-3 duo:space-y-0 duo-split-grid" aria-label="Laster utøvere" role="status">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="px-3 py-1.5 sm:px-4 sm:py-2 flex min-h-[3.625rem] items-center justify-between bg-white rounded-xl border border-surface-200">
                                <div className="flex items-center gap-2.5 sm:gap-4">
                                    <div className="w-10 h-10 bg-surface-200 rounded-xl" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-28 bg-surface-200 rounded" />
                                        <div className="h-3 w-40 bg-surface-100 rounded" />
                                    </div>
                                </div>
                                <div className="w-4 h-4 bg-surface-100 rounded" />
                            </div>
                        ))}
                    </div>
                ) : displayedClients.length === 0 ? (
                    <div className="duo:col-span-2">
                    <EmptyState
                        icon={User}
                        title={searchTerm ? 'Ingen treff' : (showArchived ? 'Ingen arkiverte utøvere' : 'Ingen utøvere ennå')}
                        description={searchTerm ? 'Prøv et annet navn eller brukernavn.' : (!showArchived ? 'Trykk på + øverst for å legge til en utøver.' : undefined)}
                    />
                    </div>
                ) : (
                    displayedClients.map(client => {
                        const isPending = pendingClientAction?.clientId === client.id;
                        const isMenuOpen = openMenuId === client.id;
                        return (
                        <Card
                            key={client.id}
                            className={`relative ${isMenuOpen ? 'z-30' : 'z-0'} px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-1 group ${showArchived ? (isMenuOpen ? '' : 'opacity-60') : client.unreadCheckins > 0 ? 'border-accent/30 bg-accent/5' : ''} ${isPending ? 'opacity-70' : 'hover:border-surface-300'}`}
                        >
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                    if (openMenuId) {
                                        setOpenMenuId(null);
                                        return;
                                    }
                                    onSelectClient(client);
                                }}
                                className="flex min-h-11 min-w-11 flex-1 items-center gap-2.5 sm:gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait"
                            >
                                <span className={`relative w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-base font-semibold ${showArchived ? 'bg-surface-200 text-ink-muted' : client.unreadCheckins > 0 ? 'bg-accent/10 text-accent' : 'bg-surface-100 text-ink'}`}>
                                    {client.name.charAt(0)}
                                    <RecentActivityDot lastActiveAt={client.lastActiveAt} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium truncate">{client.name}</span>
                                    <span className={`block text-sm ${client.unreadCheckins > 0 ? 'text-accent font-medium' : 'text-ink-muted'}`}>
                                        {client.unreadCheckins > 0
                                            ? `${client.unreadCheckins} ny${client.unreadCheckins > 1 ? 'e' : ''} ukesrapport${client.unreadCheckins > 1 ? 'er' : ''}`
                                            : client.lastCheckinDate
                                                ? `Siste ukesrapport · ${formatDateNO(client.lastCheckinDate)}`
                                                : 'Ingen ukesrapporter ennå'}
                                    </span>
                                </span>
                                {!isPending && <CaretRight size={18} className="ml-auto shrink-0 text-ink-faint" />}
                            </button>
                            <div className="flex items-center shrink-0">
                                <ClientActionsMenu
                                    client={client}
                                    isPending={isPending}
                                    open={isMenuOpen}
                                    onOpenChange={(nextOpen) => setOpenMenuId(nextOpen ? client.id : null)}
                                    onArchive={() => handleArchiveToggle(client)}
                                    onReset={() => openResetModal(client)}
                                    onDelete={() => handleDelete(client.id)}
                                />
                                {isPending && <CircleNotch size={18} className="text-ink-faint animate-spin" />}
                            </div>
                        </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
});

export default CoachDashboard;
