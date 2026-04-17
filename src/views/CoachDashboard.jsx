import React, { useState, useCallback, useMemo } from 'react';
import { Plus, X, Trash2, Pause, Play, User, ChevronRight, Loader2, KeyRound } from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';
import { useEscapeKey } from '../hooks';
import { useConfirm } from '../components/ConfirmDialog';

const CoachDashboard = React.memo(({ user, allUsers, isLoading, onSelectClient, onAddClient, onDeleteClient, onArchiveClient, onResetPassword }) => {
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

    const displayedClients = showArchived ? archivedClients : activeClients;

    const closeModal = useCallback(() => setShowModal(false), []);
    const openModal = useCallback(() => setShowModal(true), []);
    useEscapeKey(closeModal, showModal);
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
                    <Card className="w-full max-w-sm p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-display">Ny utøver</h2>
                            <button onClick={closeModal} aria-label="Lukk" className="text-ink-muted hover:text-ink p-2">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <input required name="name" type="text" placeholder="Fullt navn" autoFocus className="w-full p-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink" />
                            <input required name="username" type="text" placeholder="Brukernavn" autoComplete="off" pattern="[a-zA-Z0-9_]+" title="Kun bokstaver, tall og understrek" className="w-full p-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink" />
                            <input required name="password" type="password" minLength="6" placeholder="Passord (min. 6 tegn)" autoComplete="new-password" className="w-full p-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink" />
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
                    <Card className="w-full max-w-sm p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-display">Tilbakestill passord</h2>
                            <button onClick={closeResetModal} aria-label="Lukk" className="text-ink-muted hover:text-ink p-2">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-ink-muted mb-4">Nytt passord for <span className="font-medium text-ink">{resetTarget.name}</span></p>
                        <form onSubmit={handleResetSubmit} className="space-y-4">
                            <input required name="password" type="password" minLength="6" placeholder="Nytt passord (min. 6 tegn)" autoFocus autoComplete="new-password" className="w-full p-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink" />
                            <Button type="submit" size="lg" className="w-full" disabled={isResetting}>
                                {isResetting ? <><Loader2 size={18} className="animate-spin" /> Tilbakestiller...</> : <><KeyRound size={18} /> Tilbakestill passord</>}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* Hero Stats Card */}
            <div className="p-6 hero-tint text-white rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
                <div className="relative z-10">
                    <p className="text-white/60 text-sm">Velkommen tilbake</p>
                    <h2 className="text-3xl font-display mt-1">{user.name}</h2>

                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="text-center">
                            <p className="text-3xl font-semibold">{activeClients.length}</p>
                            <p className="text-white/50 text-xs uppercase tracking-wide mt-1">Aktive</p>
                        </div>
                        <div className="text-center border-x border-white/10">
                            <p className="text-3xl font-semibold">{archivedClients.length}</p>
                            <p className="text-white/50 text-xs uppercase tracking-wide mt-1">Arkivert</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-semibold">{totalAthletes}</p>
                            <p className="text-white/50 text-xs uppercase tracking-wide mt-1">Totalt</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toggle og Ny-knapp */}
            <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                    <button
                        onClick={showActive}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${!showArchived ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface-100'}`}
                    >
                        Aktive ({activeClients.length})
                    </button>
                    <button
                        onClick={showArchivedClients}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${showArchived ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface-100'}`}
                    >
                        Arkivert ({archivedClients.length})
                    </button>
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
                            <div key={i} className="p-4 flex items-center justify-between bg-white rounded-2xl border border-surface-200">
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
                    <div className="text-center py-12">
                        <div className="w-14 h-14 bg-surface-100 rounded-2xl flex items-center justify-center text-ink-muted mx-auto mb-4">
                            <User size={24} />
                        </div>
                        <p className="text-ink-muted font-display text-lg italic mb-1">{showArchived ? 'Ingen arkiverte utøvere' : 'Ingen utøvere enda'}</p>
                        {!showArchived && <p className="text-ink-faint text-sm">Trykk «Ny» for å legge til din første utøver</p>}
                    </div>
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
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-display text-xl ${showArchived ? 'bg-surface-200 text-ink-muted' : client.unreadCheckins > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-ink'}`}>
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
