import React, { useState, useCallback, useMemo } from 'react';
import {
  Scale, Footprints, Pencil, ChevronRight, TrendingUp, TrendingDown, Minus,
  X, Plus, Check, Loader2, Pause, Play, Activity, ArrowRight, ArrowLeft, Trash2
} from 'lucide-react';
import { Card, Badge, Button, IconButton, InputLabel } from '../components/ui';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useFocusTrap } from '../hooks';
import { formatDateNO, formatWeight } from '../lib/formatters';
import { haptic } from '../lib/haptic';

const PeriodManagementModal = React.memo(({ userData, onClose, isLoading, onCreatePeriod, onEndPeriod, onUpdatePeriod, onDeletePeriod }) => {
    const modalRef = useFocusTrap(true);
    const confirmDialog = useConfirm();
    const [view, setView] = useState('list'); // 'list' eller 'create'
    const [formData, setFormData] = useState({ name: '', startingWeight: '', goalWeight: '' });
    const [editingPeriodId, setEditingPeriodId] = useState(null);
    const [editingPeriod, setEditingPeriod] = useState({ name: '', startDate: '', endDate: '' });
    const [editError, setEditError] = useState('');
    const [weightError, setWeightError] = useState('');
    const periods = userData.periods || [];
    const activePeriod = periods.find(p => p.isActive);

    const handleNameChange = useCallback((e) => setFormData(prev => ({ ...prev, name: e.target.value })), []);
    const handleStartingWeightChange = useCallback((e) => { setFormData(prev => ({ ...prev, startingWeight: e.target.value })); setWeightError(''); }, []);
    const handleGoalWeightChange = useCallback((e) => setFormData(prev => ({ ...prev, goalWeight: e.target.value })), []);

    const handleCreate = useCallback(async (e) => {
        e.preventDefault();
        if (!formData.startingWeight) {
            setWeightError('Startvekt er påkrevd');
            return;
        }
        const result = await onCreatePeriod(formData.name || `Runde ${periods.length + 1}`, formData.startingWeight, formData.goalWeight || null);
        if (result === true) {
            haptic('save');
            setFormData({ name: '', startingWeight: '', goalWeight: '' });
            setView('list');
        }
    }, [formData, periods.length, onCreatePeriod]);

    const handleEnd = useCallback(async (periodId) => {
        if (await confirmDialog('Avslutt denne runden? Du kan starte en ny runde etterpå.', { title: 'Avslutt runde', confirmText: 'Avslutt' })) {
            await onEndPeriod(periodId);
        }
    }, [onEndPeriod, confirmDialog]);

    const handleDelete = useCallback(async (period) => {
        const linkedReports = (userData.checkins || []).filter(checkin => checkin.periodId === period.id).length;
        const reportMessage = linkedReports > 0
            ? ` ${linkedReports} ${linkedReports === 1 ? 'rapport beholdes' : 'rapporter beholdes'}, men koblingen til runden fjernes.`
            : '';
        const confirmed = await confirmDialog(
            `Slette «${period.name}» permanent?${reportMessage}${period.isActive ? ' Den aktive runden avsluttes uten å opprette en ny.' : ''}`,
            { title: 'Slett coaching-runde', confirmText: 'Slett runde', destructive: true }
        );
        if (confirmed) await onDeletePeriod(period.id);
    }, [confirmDialog, onDeletePeriod, userData.checkins]);

    const handleStartRename = useCallback((period) => {
        setEditingPeriodId(period.id);
        setEditingPeriod({
            name: period.name || '',
            startDate: period.startDate ? period.startDate.split('T')[0] : '',
            endDate: period.endDate ? period.endDate.split('T')[0] : ''
        });
        setEditError('');
    }, []);

    const handleCancelRename = useCallback(() => {
        setEditingPeriodId(null);
        setEditingPeriod({ name: '', startDate: '', endDate: '' });
        setEditError('');
    }, []);

    const handleEditFieldChange = useCallback((field, value) => {
        setEditingPeriod(prev => ({ ...prev, [field]: value }));
        setEditError('');
    }, []);

    const handleSaveRename = useCallback(async (periodId) => {
        const trimmedName = editingPeriod.name.trim();
        if (!trimmedName) {
            setEditError('Navn kan ikke være tomt');
            return;
        }
        if (!editingPeriod.startDate) {
            setEditError('Startdato må fylles ut');
            return;
        }
        if (editingPeriod.endDate && editingPeriod.endDate < editingPeriod.startDate) {
            setEditError('Sluttdato kan ikke være før startdato');
            return;
        }
        const result = await onUpdatePeriod(periodId, {
            name: trimmedName,
            startDate: editingPeriod.startDate,
            endDate: editingPeriod.endDate || null
        });
        if (result !== true) return;
        haptic('save');
        setEditingPeriodId(null);
        setEditingPeriod({ name: '', startDate: '', endDate: '' });
        setEditError('');
    }, [editingPeriod, onUpdatePeriod]);

    return (
        <div className="modal-backdrop fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <Card ref={modalRef} className="modal-scroll-panel w-full max-w-md p-4 sm:p-6 animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="period-modal-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
                <div className="flex items-center gap-2 mb-6">
                    <IconButton onClick={onClose} aria-label="Tilbake til planinnstillinger" disabled={isLoading}>
                        <ArrowLeft size={20} />
                    </IconButton>
                    <h2 id="period-modal-title" className="text-xl font-display">Coaching-runder</h2>
                </div>

                {view === 'list' ? (
                    <div className="space-y-4">
                        {/* Aktiv periode */}
                        {activePeriod && (
                            <div className="mb-6">
                                <p className="text-xs text-ink-muted uppercase tracking-wide mb-3">Aktiv runde</p>
                                <div className="p-4 bg-success/5 border border-success/20 rounded-xl">
                                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                                        <div>
                                            {editingPeriodId === activePeriod.id ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editingPeriod.name}
                                                        onChange={(e) => handleEditFieldChange('name', e.target.value)}
                                                        className="min-w-0 w-full px-3 py-2 bg-white border border-success/20 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                        placeholder="Navn på runde"
                                                        autoFocus
                                                    />
                                                    {editError && <p className="text-error text-xs">{editError}</p>}
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={handleCancelRename}
                                                            disabled={isLoading}
                                                        >
                                                            Avbryt
                                                        </Button>
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            onClick={() => handleSaveRename(activePeriod.id)}
                                                            disabled={isLoading}
                                                        >
                                                            {isLoading ? <><Loader2 size={14} className="animate-spin" /> Lagrer...</> : 'Lagre navn'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="break-words font-semibold text-ink">{activePeriod.name}</p>
                                                    <p className="text-sm text-ink-muted">Startet {formatDateNO(activePeriod.startDate)}</p>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editingPeriodId !== activePeriod.id && (
                                                <>
                                                    <IconButton
                                                        onClick={() => handleStartRename(activePeriod)}
                                                        aria-label={`Rediger navn på ${activePeriod.name}`}
                                                        disabled={isLoading}
                                                        tone="accent"
                                                    >
                                                        <Pencil size={16} />
                                                    </IconButton>
                                                    <IconButton
                                                        onClick={() => handleDelete(activePeriod)}
                                                        aria-label={`Slett ${activePeriod.name}`}
                                                        disabled={isLoading}
                                                        tone="danger"
                                                    >
                                                        <Trash2 size={16} />
                                                    </IconButton>
                                                </>
                                            )}
                                            <Badge variant="success">Aktiv</Badge>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-ink-faint">Startvekt</p>
                                            <p className="font-semibold">{activePeriod.startingWeight ? formatWeight(activePeriod.startingWeight) + ' kg' : 'Ikke satt'}</p>
                                        </div>
                                        {activePeriod.goalWeight && (
                                            <div>
                                                <p className="text-ink-faint">Målvekt</p>
                                                <p className="font-semibold">{formatWeight(activePeriod.goalWeight)} kg</p>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full mt-4"
                                        onClick={() => handleEnd(activePeriod.id)}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <><Loader2 size={14} className="animate-spin" /> Avslutter...</> : 'Avslutt runde'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Tidligere perioder */}
                        {periods.filter(p => !p.isActive).length > 0 && (
                            <div>
                                <p className="text-xs text-ink-muted uppercase tracking-wide mb-3">Tidligere runder</p>
                                <div className="space-y-2">
                                    {periods.filter(p => !p.isActive).map(period => (
                                        <div key={period.id} className="p-4 bg-surface-50 rounded-xl">
                                            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                                                <div>
                                                    {editingPeriodId === period.id ? (
                                                        <div className="space-y-2">
                                                            <input
                                                                type="text"
                                                                value={editingPeriod.name}
                                                                onChange={(e) => handleEditFieldChange('name', e.target.value)}
                                                                className="min-w-0 w-full px-3 py-2 bg-white border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                                placeholder="Navn på runde"
                                                                autoFocus
                                                            />
                                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                <div>
                                                                    <InputLabel>Startdato</InputLabel>
                                                                    <input
                                                                        type="date"
                                                                        value={editingPeriod.startDate}
                                                                        onChange={(e) => handleEditFieldChange('startDate', e.target.value)}
                                                                        className="min-w-0 w-full px-3 py-2 bg-white border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <InputLabel>Sluttdato</InputLabel>
                                                                    <input
                                                                        type="date"
                                                                        value={editingPeriod.endDate}
                                                                        onChange={(e) => handleEditFieldChange('endDate', e.target.value)}
                                                                        className="min-w-0 w-full px-3 py-2 bg-white border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {editError && <p className="text-error text-xs">{editError}</p>}
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={handleCancelRename}
                                                                    disabled={isLoading}
                                                                >
                                                                    Avbryt
                                                                </Button>
                                                                <Button
                                                                    variant="primary"
                                                                    size="sm"
                                                                    onClick={() => handleSaveRename(period.id)}
                                                                    disabled={isLoading}
                                                                >
                                                                    {isLoading ? <><Loader2 size={14} className="animate-spin" /> Lagrer...</> : 'Lagre endringer'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="break-words font-medium">{period.name}</p>
                                                            <p className="text-xs text-ink-muted">
                                                                {formatDateNO(period.startDate)} - {period.endDate ? formatDateNO(period.endDate) : 'Pågår'}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                {editingPeriodId !== period.id && (
                                                    <div className="flex items-center">
                                                        <IconButton
                                                            onClick={() => handleStartRename(period)}
                                                            aria-label={`Rediger navn på ${period.name}`}
                                                            disabled={isLoading}
                                                            tone="accent"
                                                        >
                                                            <Pencil size={16} />
                                                        </IconButton>
                                                        <IconButton
                                                            onClick={() => handleDelete(period)}
                                                            aria-label={`Slett ${period.name}`}
                                                            disabled={isLoading}
                                                            tone="danger"
                                                        >
                                                            <Trash2 size={16} />
                                                        </IconButton>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                {period.startingWeight && (
                                                    <Badge variant="muted">
                                                        Start: {formatWeight(period.startingWeight)} kg
                                                    </Badge>
                                                )}
                                                {period.goalWeight && (
                                                    <Badge variant="muted">
                                                        Mål: {formatWeight(period.goalWeight)} kg
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Start ny runde knapp */}
                        <Button 
                            variant="primary" 
                            size="lg" 
                            className="w-full"
                            onClick={() => setView('create')}
                        >
                            <Plus size={18} /> Start ny runde
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <InputLabel>Navn på runde</InputLabel>
                            <input 
                                type="text"
                                value={formData.name}
                                onChange={handleNameChange}
                                placeholder={`Runde ${periods.length + 1}`}
                                className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-accent"
                            />
                        </div>
                        
                        <div>
                            <InputLabel>Startvekt (kg) *</InputLabel>
                            <div className="relative">
                                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                                <input 
                                    type="number"
                                    inputMode="decimal"
                                    step="0.1"
                                    required
                                    value={formData.startingWeight}
                                    onChange={handleStartingWeightChange}
                                    placeholder="0.0"
                                    className={`w-full pl-12 pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent font-medium text-lg ${weightError ? 'border-error/40' : 'border-surface-200'}`}
                                />
                            </div>
                            {weightError && <p className="text-error text-xs mt-1.5">{weightError}</p>}
                        </div>

                        <div>
                            <InputLabel>Målvekt (kg, valgfritt)</InputLabel>
                            <input 
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={formData.goalWeight}
                                onChange={handleGoalWeightChange}
                                placeholder="0.0"
                                className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-accent font-medium text-lg"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => setView('list')}>
                                Avbryt
                            </Button>
                            <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={isLoading}>
                                {isLoading ? <><Loader2 size={18} className="animate-spin" /> Oppretter...</> : <><Check size={18} /> Opprett</>}
                            </Button>
                        </div>
                    </form>
                )}
            </Card>
        </div>
    );
});

// --- Plan Settings Modal (erstatter prompt()-dialoger) ---
const PlanSettingsModal = React.memo(({ userData, onClose, onUpdateData, onOpenPeriodModal }) => {
    const confirmDialog = useConfirm();
    const modalRef = useFocusTrap(true);
    const [startDate, setStartDate] = useState(
        userData.startDate ? new Date(userData.startDate).toISOString().split('T')[0] : ''
    );
    const [totalWeeks, setTotalWeeks] = useState(String(userData.totalWeeks || 12));
    const [stepGoal, setStepGoal] = useState(String(userData.stepGoal || 10000));
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const origStartDate = userData.startDate ? new Date(userData.startDate).toISOString().split('T')[0] : '';
    const origTotalWeeks = String(userData.totalWeeks || 12);
    const origStepGoal = String(userData.stepGoal || 10000);

    const hasChanges = startDate !== origStartDate || totalWeeks !== origTotalWeeks || stepGoal !== origStepGoal;
    const weeksValid = Number.isInteger(Number(totalWeeks)) && Number(totalWeeks) >= 1 && Number(totalWeeks) <= 52;
    const stepGoalValid = Number.isInteger(Number(stepGoal)) && Number(stepGoal) >= 1000 && Number(stepGoal) <= 100000;
    const dateValid = !startDate || !Number.isNaN(new Date(startDate).getTime());

    const confirmDiscard = useCallback(async () => !hasChanges || confirmDialog(
        'Endringene i planinnstillingene er ikke lagret. Vil du forkaste dem?',
        { title: 'Forkast endringer?', confirmText: 'Forkast endringer', destructive: true }
    ), [hasChanges, confirmDialog]);

    const handleClose = useCallback(async () => {
        if (isSaving) return;
        if (await confirmDiscard()) onClose();
    }, [isSaving, confirmDiscard, onClose]);

    const handleSave = useCallback(async () => {
        if (isSaving || !hasChanges || !weeksValid || !stepGoalValid || !dateValid) return;
        const updates = {};
        if (startDate !== origStartDate) {
            updates.startDate = startDate ? new Date(startDate).toISOString() : null;
        }
        if (totalWeeks !== origTotalWeeks) {
            updates.totalWeeks = Number(totalWeeks);
        }
        if (stepGoal !== origStepGoal) {
            updates.stepGoal = Number(stepGoal);
        }
        setIsSaving(true);
        setSaveError('');
        try {
            const result = await onUpdateData(updates);
            if (result === true) {
                haptic('save');
                onClose();
            } else {
                setSaveError(result?.error || 'Kunne ikke lagre endringene. Prøv igjen.');
            }
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, hasChanges, weeksValid, stepGoalValid, dateValid, startDate, totalWeeks, stepGoal, origStartDate, origTotalWeeks, origStepGoal, onUpdateData, onClose]);

    const handlePauseResume = useCallback(async () => {
        if (isSaving || !(await confirmDiscard())) return;
        setIsSaving(true);
        setSaveError('');
        try {
            const result = await onUpdateData({ action: userData.isPaused ? 'resume' : 'pause' });
            if (result === true) onClose();
            else setSaveError(result?.error || 'Kunne ikke endre status. Prøv igjen.');
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, confirmDiscard, userData.isPaused, onUpdateData, onClose]);

    const handleOpenPeriods = useCallback(async () => {
        if (isSaving || !(await confirmDiscard())) return;
        onOpenPeriodModal();
    }, [isSaving, confirmDiscard, onOpenPeriodModal]);

    const handleStartDateChange = useCallback((e) => { setStartDate(e.target.value); setSaveError(''); }, []);
    const handleTotalWeeksChange = useCallback((e) => { setTotalWeeks(e.target.value); setSaveError(''); }, []);
    const handleStepGoalChange = useCallback((e) => { setStepGoal(e.target.value); setSaveError(''); }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
            <Card ref={modalRef} className="flex w-full max-w-lg max-h-[92dvh] flex-col overflow-hidden rounded-b-none sm:max-h-[90dvh] sm:rounded-b-xl animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="plan-settings-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); handleClose(); } }}>
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-200 px-5 py-4 sm:px-6">
                    <div>
                        <h2 id="plan-settings-title" className="text-xl font-display">Planinnstillinger</h2>
                        <p className="mt-1 text-sm text-ink-muted">Tidsplan, mål og coaching-runder</p>
                    </div>
                    <IconButton onClick={handleClose} aria-label="Lukk planinnstillinger" disabled={isSaving}>
                        <X size={20} />
                    </IconButton>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                    <section aria-labelledby="plan-timeline-title">
                        <h3 id="plan-timeline-title" className="font-semibold text-ink">Tidsplan</h3>
                        <p className="mb-3 text-sm text-ink-muted">Startdato og varighet styrer ukevisningen og fremdriften.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="plan-start-date" className="mb-2 block text-sm font-medium text-ink-muted">Startdato</label>
                                <div>
                                    <input
                                        id="plan-start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={handleStartDateChange}
                                        disabled={isSaving}
                                        aria-invalid={!dateValid}
                                        className="w-full min-w-0 rounded-xl border border-surface-200 bg-surface-50 px-3 py-3 font-medium outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                                    />
                                </div>
                                {userData.isPaused && startDate !== origStartDate && (
                                    <p className="mt-1.5 text-xs text-ink-muted">Endring av startdato gjenopptar en pauset plan.</p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="plan-total-weeks" className="mb-2 block text-sm font-medium text-ink-muted">Varighet i uker</label>
                                <input
                                    id="plan-total-weeks"
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    max="52"
                                    value={totalWeeks}
                                    onChange={handleTotalWeeksChange}
                                    disabled={isSaving}
                                    aria-invalid={!weeksValid}
                                    aria-describedby={!weeksValid ? 'plan-weeks-error' : undefined}
                                    className={`w-full rounded-xl border bg-surface-50 px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 ${weeksValid ? 'border-surface-200' : 'border-error/50'}`}
                                />
                                {!weeksValid && <p id="plan-weeks-error" className="mt-1.5 text-xs text-error">Velg et tall mellom 1 og 52.</p>}
                            </div>
                        </div>
                    </section>

                    <section aria-labelledby="plan-goal-title" className="border-t border-surface-200 pt-4">
                        <h3 id="plan-goal-title" className="font-semibold text-ink">Mål</h3>
                        <p className="mb-3 text-sm text-ink-muted">Skrittmålet vises i ukesrapporten.</p>
                        <label htmlFor="plan-step-goal" className="mb-2 block text-sm font-medium text-ink-muted">Skrittmål</label>
                        <div className="relative">
                            <Footprints className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                            <input
                                id="plan-step-goal"
                                type="number"
                                inputMode="numeric"
                                min="1000"
                                max="100000"
                                step="1000"
                                value={stepGoal}
                                onChange={handleStepGoalChange}
                                disabled={isSaving}
                                aria-invalid={!stepGoalValid}
                                aria-describedby={!stepGoalValid ? 'plan-steps-error' : undefined}
                                className={`w-full rounded-xl border bg-surface-50 py-3 pl-10 pr-4 font-medium outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 ${stepGoalValid ? 'border-surface-200' : 'border-error/50'}`}
                            />
                        </div>
                        {!stepGoalValid && <p id="plan-steps-error" className="mt-1.5 text-xs text-error">Velg et tall mellom 1 000 og 100 000.</p>}
                    </section>

                    <section aria-labelledby="plan-more-title" className="border-t border-surface-200 pt-4">
                        <h3 id="plan-more-title" className="mb-3 font-semibold text-ink">Administrasjon</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={handleOpenPeriods}
                            disabled={isSaving}
                            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-left transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                        >
                            <Activity size={19} className="shrink-0 text-ink-muted" />
                            <span className="min-w-0 flex-1">
                                <span className="block font-medium">Coaching-runder</span>
                                <span className="block truncate text-xs text-ink-muted">
                                    {userData.periods?.find(period => period.isActive)?.name || `${userData.periods?.length || 0} runder`}
                                </span>
                            </span>
                            <ArrowRight size={18} className="shrink-0 text-ink-muted" />
                        </button>
                        {userData.startDate && (
                            <button
                                type="button"
                                onClick={handlePauseResume}
                                disabled={isSaving}
                                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-left transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                            >
                                {userData.isPaused ? <Play size={19} className="shrink-0 text-ink-muted" /> : <Pause size={19} className="shrink-0 text-ink-muted" />}
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium">{userData.isPaused ? 'Gjenoppta plan' : 'Pause plan'}</span>
                                    <span className="block text-xs text-ink-muted">{userData.isPaused ? 'Fortsett der dere slapp' : 'Sett fremdriften på vent'}</span>
                                </span>
                                <ArrowRight size={18} className="shrink-0 text-ink-muted" />
                            </button>
                        )}
                        </div>
                    </section>
                </div>

                <div className="shrink-0 border-t border-surface-200 bg-white px-5 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:px-6 sm:pb-4">
                    {saveError && <p className="mb-3 text-sm text-error" role="alert">{saveError}</p>}
                    <div className="flex gap-3">
                        <Button variant="secondary" size="md" className="flex-1" onClick={handleClose} disabled={isSaving}>
                            {hasChanges ? 'Avbryt' : 'Lukk'}
                        </Button>
                        <Button variant="primary" size="md" className="flex-1" onClick={handleSave} disabled={isSaving || !hasChanges || !weeksValid || !stepGoalValid || !dateValid}>
                            {isSaving ? <><Loader2 size={17} className="animate-spin" /> Lagrer...</> : <><Check size={17} /> Lagre</>}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
});

const getMondayTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date.getTime();
};

const DashboardView = React.memo(({ userData, isCoach, onUpdateData, onOpenWeightHistory, onOpenCheckin }) => {
    const toast = useToast();
    const checkins = userData.checkins || [];
    const periods = userData.periods || [];
    const activePeriod = periods.find(p => p.isActive);
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [showPlanSettings, setShowPlanSettings] = useState(false);
    const [periodLoading, setPeriodLoading] = useState(false);
    
    const lastCheckin = checkins.length > 0 ? checkins[0] : null;
    const thisWeekReport = useMemo(() => {
        const thisMonday = getMondayTime(new Date());
        if (!thisMonday) return null;
        return checkins.find((entry) => {
            const raw = entry.timestamp || (entry.date ? (String(entry.date).length === 10 ? `${entry.date}T12:00:00` : entry.date) : null);
            const monday = getMondayTime(raw);
            return monday === thisMonday;
        }) || null;
    }, [checkins]);

    // Memoize week calculation
    const { currentWeek, progress } = useMemo(() => {
        if (!userData.startDate) return { currentWeek: 0, progress: 0 };
        const start = new Date(userData.startDate);
        const end = userData.isPaused && userData.pausedAt ? new Date(userData.pausedAt) : new Date();
        const totalWeeks = userData.totalWeeks || 12;
        const diffTime = Math.max(0, end - start);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const week = Math.min(Math.floor(diffDays / 7) + 1, totalWeeks);
        const prog = Math.min((diffTime / (totalWeeks * 7 * 24 * 60 * 60 * 1000)) * 100, 100);
        return { currentWeek: week, progress: prog };
    }, [userData.startDate, userData.isPaused, userData.pausedAt, userData.totalWeeks]);

    // Beregn statistikk fra alle innsjekker
    const stats = useMemo(() => {
        if (checkins.length === 0) return null;

        let totalStrength = 0;
        let totalCardio = 0;
        let stepsHit = 0;
        let accuracySum = 0;
        let periodCheckinsCount = 0;
        let newestRelevantWeight = null;
        let oldestRelevantWeight = null;

        for (const checkin of checkins) {
            totalStrength += parseInt(checkin.strengthSessions) || 0;
            totalCardio += parseInt(checkin.cardioSessions) || 0;
            if (checkin.stepsReached) stepsHit++;
            accuracySum += parseInt(checkin.accuracy) || 0;

            const isRelevantPeriod = !activePeriod?.id || checkin.periodId === activePeriod.id;
            if (!isRelevantPeriod) continue;

            periodCheckinsCount++;

            const parsedWeight = parseFloat(checkin.weight);
            if (isNaN(parsedWeight) || parsedWeight <= 0) continue;

            if (newestRelevantWeight === null) {
                newestRelevantWeight = parsedWeight;
            }
            oldestRelevantWeight = parsedWeight;
        }

        const avgAccuracy = (accuracySum / checkins.length).toFixed(1);
        let weightChange = null;

        if (newestRelevantWeight !== null && activePeriod?.startingWeight) {
            // Beregn fra rundens startvekt til siste vekt
            const startWeight = parseFloat(activePeriod.startingWeight);
            weightChange = (newestRelevantWeight - startWeight).toFixed(1);
        } else if (newestRelevantWeight !== null && oldestRelevantWeight !== null && newestRelevantWeight !== oldestRelevantWeight) {
            // Fallback: første til siste checkin
            weightChange = (newestRelevantWeight - oldestRelevantWeight).toFixed(1);
        }

        return { totalStrength, totalCardio, stepsHit, avgAccuracy, weightChange, totalCheckins: checkins.length, periodCheckins: periodCheckinsCount };
    }, [checkins, activePeriod]);

    const handleOpenPlanSettings = useCallback(() => setShowPlanSettings(true), []);
    const handleClosePlanSettings = useCallback(() => setShowPlanSettings(false), []);
    const handleClosePeriodModal = useCallback(() => {
        setShowPeriodModal(false);
        setShowPlanSettings(true);
    }, []);
    const handleOpenPeriodFromSettings = useCallback(() => {
        setShowPlanSettings(false);
        setShowPeriodModal(true);
    }, []);

    const handleCreatePeriod = useCallback(async (name, startingWeight, goalWeight) => {
        setPeriodLoading(true);
        try {
            const result = await onUpdateData({ action: 'create_period', name, startingWeight, goalWeight });
            if (result === true) toast('Runde opprettet');
            return result;
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, toast]);

    const handleEndPeriod = useCallback(async (periodId) => {
        setPeriodLoading(true);
        try {
            const result = await onUpdateData({ action: 'end_period', periodId });
            if (result === true) toast('Runde avsluttet');
            return result;
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, toast]);

    const handleUpdatePeriodCb = useCallback(async (periodId, updates) => {
        setPeriodLoading(true);
        try {
            const result = await onUpdateData({ action: 'update_period', periodId, ...updates });
            if (result === true) toast('Runde oppdatert');
            return result;
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, toast]);

    const handleDeletePeriod = useCallback(async (periodId) => {
        setPeriodLoading(true);
        try {
            const result = await onUpdateData({ action: 'delete_period', periodId });
            if (result === true) toast('Runde slettet');
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, toast]);

    return (
        <div className="space-y-5 pb-32 lg:pb-8 animate-slide-up">
            {/* Period Management Modal */}
            {showPeriodModal && (
                <PeriodManagementModal
                    userData={userData}
                    onClose={handleClosePeriodModal}
                    isLoading={periodLoading}
                    onCreatePeriod={handleCreatePeriod}
                    onEndPeriod={handleEndPeriod}
                    onUpdatePeriod={handleUpdatePeriodCb}
                    onDeletePeriod={handleDeletePeriod}
                />
            )}

            {/* Plan Settings Modal */}
            {showPlanSettings && (
                <PlanSettingsModal
                    userData={userData}
                    onClose={handleClosePlanSettings}
                    onUpdateData={onUpdateData}
                    onOpenPeriodModal={handleOpenPeriodFromSettings}
                />
            )}

            {/* Hero Card */}
            <div className="px-5 py-4 lg:px-7 lg:py-6 hero-tint text-white rounded-xl relative overflow-hidden ring-1 ring-white/10">
                <div className="relative z-10">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div>
                            <p className="text-white/70 text-xs">
                                {activePeriod ? activePeriod.name : (userData.isPaused ? 'Plan på pause' : userData.startDate ? 'Din fremgang' : 'Velkommen')}
                            </p>
                            <h2 className="text-2xl font-display leading-tight mt-0.5">
                                {userData.isPaused ? 'Pauset' : userData.startDate ? `Uke ${currentWeek} av ${userData.totalWeeks || 12}` : 'Kom i gang'}
                            </h2>
                            {userData.startDate && !userData.isPaused && (() => {
                                const endDate = new Date(new Date(userData.startDate).getTime() + (userData.totalWeeks || 12) * 7 * 24 * 60 * 60 * 1000);
                                return (
                                    <p className="text-white/75 text-xs mt-0.5">
                                        {formatDateNO(userData.startDate)} → {formatDateNO(endDate.toISOString())}
                                    </p>
                                );
                            })()}
                            {activePeriod && activePeriod.startingWeight && (
                                <p className="text-white/75 text-xs mt-0.5">
                                    Startvekt: {formatWeight(activePeriod.startingWeight)} kg
                                    {activePeriod.goalWeight && ` → Mål: ${formatWeight(activePeriod.goalWeight)} kg`}
                                </p>
                            )}
                        </div>
                        {isCoach && (
                            <button
                                type="button"
                                onClick={handleOpenPlanSettings}
                                aria-label="Åpne plan-innstillinger"
                                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-white/5 hover:bg-white/12 text-white/70 transition-colors"
                            >
                                <Pencil size={18} />
                            </button>
                        )}
                    </div>

                    {userData.startDate && !userData.isPaused && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-white/75">Fremdrift</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {!userData.startDate && (
                        <div className="space-y-3">
                            <p className="text-white/80 text-sm">
                                {isCoach ? 'Sett opp startdato, skrittmål og eventuelt første coaching-runde for å komme i gang.' : 'Venter på at coach setter opp planen din.'}
                            </p>
                            {isCoach && (
                                <Button variant="secondary" size="sm" onClick={handleOpenPlanSettings}>
                                    <Pencil size={16} /> Sett opp plan
                                </Button>
                            )}
                        </div>
                    )}

                    {userData.isPaused && (
                        <div className="space-y-3">
                            <p className="text-white/80 text-sm">
                                {isCoach ? 'Planen er pauset. Gjenoppta når dere er klare for å fortsette.' : 'Planen er satt på pause akkurat nå.'}
                            </p>
                            {isCoach && (
                                <Button variant="secondary" size="sm" onClick={handleOpenPlanSettings}>
                                    <Play size={16} /> Gjenoppta plan
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <Card
                    className="p-5 group"
                    interactive
                    onClick={onOpenWeightHistory}
                >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted group-hover:bg-surface-200 transition-colors">
                            <Scale size={20} />
                        </div>
                        <ChevronRight size={16} className="text-ink-faint" />
                    </div>
                    <p className="section-label">Siste vekt</p>
                    <p className="text-2xl font-semibold mt-1 tabular-nums">
                        {lastCheckin ? formatWeight(lastCheckin.weight) : '-'}
                        <span className="text-sm font-normal text-ink-muted ml-1">kg</span>
                    </p>
                    <p className="text-xs text-ink-muted mt-1.5">Se historikk</p>
                </Card>

                <Card
                    className={`p-5 ${isCoach ? 'group' : 'soft-panel'}`}
                    interactive={isCoach}
                    onClick={isCoach ? handleOpenPlanSettings : undefined}
                >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-ink-muted ${isCoach ? 'bg-surface-100 group-hover:bg-surface-200 transition-colors' : 'bg-white'}`}>
                            <Footprints size={20} />
                        </div>
                        {isCoach && <ChevronRight size={16} className="text-ink-faint" />}
                    </div>
                    <p className="section-label">Ukentlig skrittmål</p>
                    <p className="text-2xl font-semibold mt-1">{(userData.stepGoal || 10000).toLocaleString('nb-NO')}</p>
                    <p className="text-xs text-ink-muted mt-1.5">{isCoach ? 'Endre i innstillinger' : 'Per uke'}</p>
                </Card>
            </div>

            {/* Totaloversikt - kun hvis det finnes data */}
            {stats && (
                <div>
                    <p className="section-label mx-1 mb-3">Din reise så langt</p>
                    <Card className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-5">
                            <div>
                                <div className="text-2xl font-semibold text-ink">{stats.totalStrength}</div>
                                <div className="stat-label mt-1">Styrke</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-ink">{stats.totalCardio}</div>
                                <div className="stat-label mt-1">Cardio</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-ink tabular-nums">{stats.stepsHit}/{stats.totalCheckins}</div>
                                <div className="stat-label mt-1">Skrittmål</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-ink tabular-nums">{stats.avgAccuracy}</div>
                                <div className="stat-label mt-1">Plan</div>
                            </div>
                        </div>

                        {stats.weightChange && (() => {
                            const wc = parseFloat(stats.weightChange);
                            return (
                                <div
                                    className={`flex items-center justify-center gap-2 rounded-lg p-3 text-sm font-semibold ${wc === 0 ? 'bg-surface-100 text-ink-muted' : 'bg-surface-100 text-ink'}`}
                                >
                                    {wc < 0 ? <TrendingDown size={18} /> : wc > 0 ? <TrendingUp size={18} /> : <Minus size={18} />}
                                    <span className="tabular-nums">
                                        {wc > 0 ? '+' : ''}{stats.weightChange.replace('.', ',')} kg total endring
                                    </span>
                                </div>
                            );
                        })()}
                    </Card>
                </div>
            )}

            <Card className="p-5">
                <p className="section-label">Denne uken</p>
                {thisWeekReport ? (
                    <div className="mt-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-semibold">Rapport sendt</p>
                            <p className="text-sm text-ink-muted mt-1">
                                {formatDateNO(thisWeekReport.date)}
                                {thisWeekReport.weight ? ` · ${formatWeight(thisWeekReport.weight)} kg` : ''}
                            </p>
                        </div>
                        {onOpenCheckin && (
                            <Button variant="secondary" size="sm" onClick={onOpenCheckin}>
                                Se rapport
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="mt-2">
                        <p className="font-semibold">{isCoach ? 'Ingen rapport enda' : 'Ukesrapport mangler'}</p>
                        <p className="text-sm text-ink-muted mt-1">
                            {isCoach
                                ? 'Når utøveren sender ukesrapporten, vises den her.'
                                : 'Fyll ut status for uken når du er klar.'}
                        </p>
                        {onOpenCheckin && !isCoach && (
                            <Button size="sm" className="mt-4" onClick={onOpenCheckin}>
                                Fyll ut rapport
                            </Button>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
});

export default DashboardView;
