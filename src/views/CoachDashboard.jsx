import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Trash2, Pause, Play, User, ChevronRight, Loader2, KeyRound, BellRing } from 'lucide-react';
import { Card, Badge, Button, EmptyState, IconButton, TextField, ToggleGroup } from '../components/ui';
import { useEscapeKey } from '../hooks';
import { useConfirm } from '../components/ConfirmDialog';

const CoachDashboard = React.memo(({ user, allUsers, isLoading, notificationPermission = 'unsupported', onEnableNotifications, onSelectClient, onAddClient, onDeleteClient, onArchiveClient, onResetPassword }) => {
    const [showModal, setShowModal] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [resetTarget, setResetTarget] = useState(null);
    const [isResetting, setIsResetting] = useState(false);
    const [pendingClientAction, setPendingClientAction] = useState(null);
    const confirm = useConfirm();

    // Memoize filtrerte lister
    const { activeClients, archivedClients, totalAthletes } = useMemo(() => ({
        activeClients: allUsers.filter(u => u.role === 'athlete' && !u.is_archived),
        archivedClients: allUsers.filter(u => u.role === 'athlete' && u.is_archived),
        totalAthletes: allUsers.filter(u => u.role === 'athlete').length
    }), [allUsers]);
    const totalUnreadCheckins = useMemo(
        () => activeClients.reduce((sum, client) => sum + (Number(client.unreadCheckins) || 0), 0),
        [activeClients]
    );

    const displayedClients = showArchived ? archivedClients : activeClients;

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

    const handleDelete = useCallback(async (e, clientId) => {
        e.stopPropagation();
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

    const handleArchiveToggle = useCallback(async (e, client) => {
        e.stopPropagation();
        setPendingClientAction({ clientId: client.id, type: client.is_archived ? 'restore' : 'archive' });
        try {
            await onArchiveClient(client.id, !client.is_archived);
        } finally {
            setPendingClientAction(null);
        }
    }, [onArchiveClient]);

    const openResetModal = useCallback((e, client) => {
        e.stopPropagation();
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
        <div className="space-y-5 pb-32 animate-slide-up">
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
                            <TextField ref={newAthleteNameRef} required name="name" type="text" placeholder="Fullt navn" />
                            <TextField required name="username" type="text" placeholder="Brukernavn" autoComplete="off" pattern="[a-zA-Z0-9_]+" title="Kun bokstaver, tall og understrek" />
                            <TextField required name="password" type="password" minLength="6" placeholder="Passord (min. 6 tegn)" autoComplete="new-password" />
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
                            <TextField ref={resetPasswordInputRef} required name="password" type="password" minLength="6" placeholder="Nytt passord (min. 6 tegn)" autoComplete="new-password" />
                            <Button type="submit" size="lg" className="w-full" disabled={isResetting}>
                                {isResetting ? <><Loader2 size={18} className="animate-spin" /> Tilbakestiller...</> : <><KeyRound size={18} /> Tilbakestill passord</>}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* Hero Stats Card */}
            <div className="px-5 py-4 hero-tint text-white rounded-xl relative overflow-hidden ring-1 ring-white/10">
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-white/60 text-xs">Velkommen tilbake</p>
                        <h2 className="text-2xl font-display leading-tight truncate">{user.name}</h2>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-white/60">
                            <BellRing size={12} />
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
                    <div className="flex gap-3 shrink-0">
                        <div className="text-center rounded-xl bg-white/7 px-2.5 py-2 ring-1 ring-white/10">
                            <p className="text-2xl font-semibold leading-none">{activeClients.length}</p>
                            <p className="text-white/55 text-xs mt-1">Aktive</p>
                        </div>
                        <div className="text-center rounded-xl bg-white/7 px-2.5 py-2 ring-1 ring-white/10">
                            <p className="text-2xl font-semibold leading-none">{archivedClients.length}</p>
                            <p className="text-white/55 text-xs mt-1">Arkivert</p>
                        </div>
                        <div className="text-center rounded-xl bg-white/7 px-2.5 py-2 ring-1 ring-white/10">
                            <p className="text-2xl font-semibold leading-none">{totalUnreadCheckins}</p>
                            <p className="text-white/55 text-xs mt-1">Uleste</p>
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
                            { value: 'active', label: `Aktive (${activeClients.length})` },
                            { value: 'archived', label: `Arkivert (${archivedClients.length})` }
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

            {/* Client List */}
            <div className="space-y-2">
                {displayedClients.length === 0 && isLoading ? (
                    <div className="space-y-2 animate-pulse" aria-label="Laster utøvere" role="status">
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
                    <EmptyState
                        icon={User}
                        title={showArchived ? 'Ingen arkiverte utøvere' : 'Ingen utøvere enda'}
                        description={!showArchived ? 'Trykk «Ny» for å legge til din første utøver' : undefined}
                    />
                ) : (
                    displayedClients.map(client => {
                        const isPending = pendingClientAction?.clientId === client.id;
                        return (
                        <Card
                            key={client.id}
                            className={`p-4 flex items-center justify-between group ${showArchived ? 'opacity-60' : client.unreadCheckins > 0 ? 'border-emerald-300 bg-emerald-50/50' : ''} ${isPending ? 'pointer-events-none opacity-70' : ''}`}
                            interactive={!isPending}
                            onClick={() => !isPending && onSelectClient(client)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-semibold ${showArchived ? 'bg-surface-200 text-ink-muted' : client.unreadCheckins > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-ink'}`}>
                                    {client.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium">{client.name}</p>
                                    <p className={`text-sm ${client.unreadCheckins > 0 ? 'text-emerald-600 font-medium' : 'text-ink-muted'}`}>
                                        {client.unreadCheckins > 0
                                            ? `${client.unreadCheckins} ny${client.unreadCheckins > 1 ? 'e' : ''} rapport${client.unreadCheckins > 1 ? 'er' : ''}`
                                            : client.lastCheckinDate
                                                ? `Siste rapport: ${(() => { const d = new Date(client.lastCheckinDate.length === 10 ? client.lastCheckinDate + 'T00:00:00' : client.lastCheckinDate); return isNaN(d) ? client.lastCheckinDate : d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' }); })()}`
                                                : 'Ingen rapporter ennå'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                                    {/* Arkiver/Gjenopprett knapp */}
                                    <button
                                        type="button"
                                        onClick={(e) => handleArchiveToggle(e, client)}
                                        className="p-2 text-ink-faint hover:text-ink transition-colors"
                                        aria-label={client.is_archived ? 'Gjenopprett' : 'Arkiver'}
                                        title={client.is_archived ? 'Gjenopprett' : 'Arkiver'}
                                        disabled={isPending}
                                    >
                                        {client.is_archived ? <Play size={16} /> : <Pause size={16} />}
                                    </button>
                                    {/* Tilbakestill passord */}
                                    <button
                                        type="button"
                                        onClick={(e) => openResetModal(e, client)}
                                        className="p-2 text-ink-faint hover:text-ink transition-colors"
                                        aria-label="Tilbakestill passord"
                                        title="Tilbakestill passord"
                                        disabled={isPending}
                                    >
                                        <KeyRound size={16} />
                                    </button>
                                    {/* Slett knapp */}
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(e, client.id)}
                                        className="p-2 text-ink-faint hover:text-red-500 transition-colors"
                                        aria-label="Slett utøver"
                                        disabled={isPending}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
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
