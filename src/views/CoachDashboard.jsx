import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Trash2, User, ChevronRight, Loader2, KeyRound, BellRing, Search, ArrowUpDown, MoreHorizontal, ArchiveRestore, Archive } from 'lucide-react';
import { Card, Button, EmptyState, IconButton, TextField, ToggleGroup, SelectField } from '../components/ui';
import { useEscapeKey } from '../hooks';
import { useConfirm } from '../components/ConfirmDialog';

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
                <MoreHorizontal size={18} />
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
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-100"
                        onClick={(event) => run(event, onArchive)}
                    >
                        {client.is_archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        {client.is_archived ? 'Gjenopprett' : 'Arkiver'}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-100"
                        onClick={(event) => run(event, onReset)}
                    >
                        <KeyRound size={16} />
                        Tilbakestill passord
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-error hover:bg-error/10"
                        onClick={(event) => run(event, onDelete)}
                    >
                        <Trash2 size={16} />
                        Slett utøver
                    </button>
                </div>
            )}
        </div>
    );
};

const CoachDashboard = React.memo(({ allUsers = [], isLoading, notificationPermission = 'unsupported', onEnableNotifications, onSelectClient, onAddClient, onDeleteClient, onArchiveClient, onResetPassword }) => {
    const [showModal, setShowModal] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [resetTarget, setResetTarget] = useState(null);
    const [isResetting, setIsResetting] = useState(false);
    const [pendingClientAction, setPendingClientAction] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('unread');
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
    const openModal = useCallback(() => setShowModal(true), []);
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

    const handleFormSubmit = useCallback(async (e) => {
        e.preventDefault();
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
        if (await confirm('Er du sikker på at du vil slette denne utøveren permanent?', {
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
        <div className="space-y-5 pb-8 animate-slide-up">
            {showModal && (
                <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={closeModal}>
                    <Card className="w-full max-w-sm p-6 animate-scale-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="new-athlete-title">
                        <div className="flex justify-between items-center mb-6">
                            <h2 id="new-athlete-title" className="text-xl font-display">Ny utøver</h2>
                            <IconButton onClick={closeModal} aria-label="Lukk">
                                <X size={20} />
                            </IconButton>
                        </div>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <TextField ref={newAthleteNameRef} id="new-athlete-name" label="Fullt navn" required name="name" type="text" placeholder="Ola Nordmann" />
                            <TextField id="new-athlete-username" label="Brukernavn" required name="username" type="text" placeholder="ola_nordmann" autoComplete="off" pattern="[a-zA-Z0-9_]+" title="Kun bokstaver, tall og understrek" />
                            <TextField id="new-athlete-password" label="Passord" required name="password" type="password" minLength="6" placeholder="Minst 6 tegn" autoComplete="new-password" />
                            <Button type="submit" size="lg" className="w-full" disabled={isCreating}>
                                {isCreating ? <><Loader2 size={18} className="animate-spin" /> Oppretter...</> : 'Opprett utøver'}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* Passord-reset modal */}
            {resetTarget && (
                <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={closeResetModal}>
                    <Card className="w-full max-w-sm p-6 animate-scale-in" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reset-password-title" aria-describedby="reset-password-description">
                        <div className="flex justify-between items-center mb-6">
                            <h2 id="reset-password-title" className="text-xl font-display">Tilbakestill passord</h2>
                            <IconButton onClick={closeResetModal} aria-label="Lukk">
                                <X size={20} />
                            </IconButton>
                        </div>
                        <p id="reset-password-description" className="text-sm text-ink-muted mb-4">Nytt passord for <span className="font-medium text-ink">{resetTarget.name}</span></p>
                        <form onSubmit={handleResetSubmit} className="space-y-4">
                            <TextField ref={resetPasswordInputRef} id="reset-athlete-password" label="Nytt passord" required name="password" type="password" minLength="6" placeholder="Minst 6 tegn" autoComplete="new-password" />
                            <Button type="submit" size="lg" className="w-full" disabled={isResetting}>
                                {isResetting ? <><Loader2 size={18} className="animate-spin" /> Tilbakestiller...</> : <><KeyRound size={18} /> Tilbakestill passord</>}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* Hero Stats Card */}
            <div className="px-5 py-4 lg:px-7 lg:py-6 hero-tint text-white rounded-xl relative overflow-hidden ring-1 ring-white/10">
                <div className="relative z-10 space-y-4">
                    <div className="min-w-0">
                        <p className="text-white/70 text-xs">Oversikt</p>
                        <h2 className="text-2xl font-display leading-tight">Utøvere</h2>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-white/75">
                            <BellRing size={12} className="shrink-0" />
                            <span>
                                {notificationPermission === 'granted'
                                    ? (totalUnreadCheckins > 0 ? `${totalUnreadCheckins} uleste rapporter` : 'Pushvarsler aktivert')
                                    : notificationPermission === 'denied'
                                        ? 'Varsler blokkert'
                                        : notificationPermission === 'unsupported'
                                            ? 'Varsler ikke støttet'
                                            : 'Varsler ikke aktivert'}
                            </span>
                            {notificationPermission === 'default' && (
                                <button type="button" onClick={onEnableNotifications} className="underline underline-offset-2 text-white/80 hover:text-white">
                                    Slå på
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="text-center rounded-xl bg-white/7 px-2.5 py-2.5 ring-1 ring-white/10">
                            <p className="text-2xl font-semibold leading-none tabular-nums">{activeClients.length}</p>
                            <p className="text-white/75 text-xs mt-1">Aktive</p>
                        </div>
                        <div className="text-center rounded-xl bg-white/7 px-2.5 py-2.5 ring-1 ring-white/10">
                            <p className="text-2xl font-semibold leading-none tabular-nums">{archivedClients.length}</p>
                            <p className="text-white/75 text-xs mt-1">Arkivert</p>
                        </div>
                        <div className="text-center rounded-xl bg-white/7 px-2.5 py-2.5 ring-1 ring-white/10">
                            <p className="text-2xl font-semibold leading-none tabular-nums">{totalUnreadCheckins}</p>
                            <p className="text-white/75 text-xs mt-1">Uleste</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toggle og Ny-knapp */}
            <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <ToggleGroup
                        value={showArchived ? 'archived' : 'active'}
                        onChange={(value) => value === 'archived' ? showArchivedClients() : showActive()}
                        options={[
                            { value: 'active', label: 'Aktive' },
                            { value: 'archived', label: 'Arkivert' }
                        ]}
                    />
                    {isLoading && displayedClients.length > 0 && (
                        <Loader2 size={14} className="animate-spin text-ink-faint ml-1" aria-label="Oppdaterer" />
                    )}
                </div>
                <Button variant="primary" size="sm" onClick={openModal}>
                    <Plus size={16} /> Ny
                </Button>
            </div>

            {(activeClients.length > 0 || archivedClients.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] lg:grid-cols-[1fr_14rem] gap-3">
                    <TextField
                        icon={Search}
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="Søk etter utøver"
                        aria-label="Søk etter utøver"
                    />
                    <div className="relative">
                        <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted z-10" size={18} />
                        <SelectField
                            value={sortBy}
                            onChange={handleSortChange}
                            options={['unread', 'lastCheckin', 'name']}
                            aria-label="Sorter utøvere"
                            displayLabels={{
                                unread: 'Uleste først',
                                lastCheckin: 'Siste rapport',
                                name: 'Navn'
                            }}
                            selectClassName="pl-12"
                        />
                    </div>
                </div>
            )}

            {/* Client List */}
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                {displayedClients.length === 0 && isLoading ? (
                    <div className="space-y-2 animate-pulse lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0" aria-label="Laster utøvere" role="status">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="p-4 flex items-center justify-between bg-white rounded-xl border border-surface-200">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-surface-200 rounded-xl" />
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
                    <div className="lg:col-span-2">
                    <EmptyState
                        icon={User}
                        title={searchTerm ? 'Ingen treff' : (showArchived ? 'Ingen arkiverte utøvere' : 'Ingen utøvere enda')}
                        description={searchTerm ? 'Prøv et annet navn eller brukernavn' : (!showArchived ? 'Trykk «Ny» for å legge til din første utøver' : undefined)}
                    />
                    </div>
                ) : (
                    displayedClients.map(client => {
                        const isPending = pendingClientAction?.clientId === client.id;
                        return (
                        <Card
                            key={client.id}
                            className={`p-4 flex items-center justify-between group ${showArchived ? 'opacity-60' : client.unreadCheckins > 0 ? 'border-success/30 bg-success/5' : ''} ${isPending ? 'pointer-events-none opacity-70' : ''}`}
                            interactive={!isPending}
                            onClick={() => {
                                if (isPending) return;
                                if (openMenuId) {
                                    setOpenMenuId(null);
                                    return;
                                }
                                onSelectClient(client);
                            }}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-lg font-semibold ${showArchived ? 'bg-surface-200 text-ink-muted' : client.unreadCheckins > 0 ? 'bg-success/10 text-success' : 'bg-surface-100 text-ink'}`}>
                                    {client.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{client.name}</p>
                                    <p className={`text-sm ${client.unreadCheckins > 0 ? 'text-success font-medium' : 'text-ink-muted'}`}>
                                        {client.unreadCheckins > 0
                                            ? `${client.unreadCheckins} ny${client.unreadCheckins > 1 ? 'e' : ''} rapport${client.unreadCheckins > 1 ? 'er' : ''}`
                                            : client.lastCheckinDate
                                                ? `Siste rapport: ${(() => { const d = new Date(client.lastCheckinDate.length === 10 ? client.lastCheckinDate + 'T00:00:00' : client.lastCheckinDate); return isNaN(d) ? client.lastCheckinDate : d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' }); })()}`
                                                : 'Ingen rapporter ennå'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center shrink-0">
                                <ClientActionsMenu
                                    client={client}
                                    isPending={isPending}
                                    open={openMenuId === client.id}
                                    onOpenChange={(nextOpen) => setOpenMenuId(nextOpen ? client.id : null)}
                                    onArchive={() => handleArchiveToggle(client)}
                                    onReset={() => openResetModal(client)}
                                    onDelete={() => handleDelete(client.id)}
                                />
                                {isPending ? <Loader2 size={18} className="text-ink-faint animate-spin" /> : <ChevronRight size={18} className="text-ink-faint" />}
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
