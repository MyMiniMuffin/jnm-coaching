import React, { useState, useCallback, useMemo } from 'react';
import {
  Scale, Footprints, Pencil, ChevronRight, TrendingUp, TrendingDown, Minus,
  X, Plus, Check, Loader2, Calendar, Pause, Play, Activity, ArrowRight
} from 'lucide-react';
import { Card, Badge, Button, InputLabel } from '../components/ui';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useEscapeKey } from '../hooks';
import { formatDateNO, formatWeight } from '../lib/formatters';
import { QUOTES } from '../lib/config';

const PeriodManagementModal = React.memo(({ userData, onClose, isLoading, onCreatePeriod, onEndPeriod, onUpdatePeriod }) => {
    useEscapeKey(onClose);
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
        await onCreatePeriod(formData.name || `Runde ${periods.length + 1}`, formData.startingWeight, formData.goalWeight || null);
        onClose();
    }, [formData, periods.length, onCreatePeriod, onClose]);

    const handleEnd = useCallback(async (periodId) => {
        if (await confirmDialog('Avslutt denne runden? Du kan starte en ny runde etterpå.', { title: 'Avslutt runde', confirmText: 'Avslutt' })) {
            await onEndPeriod(periodId);
            onClose();
        }
    }, [onEndPeriod, onClose, confirmDialog]);

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
        await onUpdatePeriod(periodId, {
            name: trimmedName,
            startDate: editingPeriod.startDate,
            endDate: editingPeriod.endDate || null
        });
        setEditingPeriodId(null);
        setEditingPeriod({ name: '', startDate: '', endDate: '' });
        setEditError('');
    }, [editingPeriod, onUpdatePeriod]);

    return (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <Card className="w-full max-w-md p-6 max-h-[80vh] overflow-y-auto animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-display">Coaching-runder</h2>
                    <button onClick={onClose} aria-label="Lukk" className="text-ink-muted hover:text-ink p-2">
                        <X size={20} />
                    </button>
                </div>

                {view === 'list' ? (
                    <div className="space-y-4">
                        {/* Aktiv periode */}
                        {activePeriod && (
                            <div className="mb-6">
                                <p className="text-xs text-ink-muted uppercase tracking-wide mb-3">Aktiv runde</p>
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            {editingPeriodId === activePeriod.id ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editingPeriod.name}
                                                        onChange={(e) => handleEditFieldChange('name', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                        placeholder="Navn på runde"
                                                        autoFocus
                                                    />
                                                    {editError && <p className="text-red-600 text-xs">{editError}</p>}
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
                                                    <p className="font-semibold text-ink">{activePeriod.name}</p>
                                                    <p className="text-sm text-ink-muted">Startet {formatDateNO(activePeriod.startDate)}</p>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editingPeriodId !== activePeriod.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartRename(activePeriod)}
                                                    className="p-2 text-emerald-700/70 hover:text-emerald-900 transition-colors"
                                                    aria-label={`Rediger navn på ${activePeriod.name}`}
                                                    disabled={isLoading}
                                                >
                                                    <Pencil size={16} />
                                                </button>
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
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    {editingPeriodId === period.id ? (
                                                        <div className="space-y-2">
                                                            <input
                                                                type="text"
                                                                value={editingPeriod.name}
                                                                onChange={(e) => handleEditFieldChange('name', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                                placeholder="Navn på runde"
                                                                autoFocus
                                                            />
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <InputLabel>Startdato</InputLabel>
                                                                    <input
                                                                        type="date"
                                                                        value={editingPeriod.startDate}
                                                                        onChange={(e) => handleEditFieldChange('startDate', e.target.value)}
                                                                        className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <InputLabel>Sluttdato</InputLabel>
                                                                    <input
                                                                        type="date"
                                                                        value={editingPeriod.endDate}
                                                                        onChange={(e) => handleEditFieldChange('endDate', e.target.value)}
                                                                        className="w-full px-3 py-2 bg-white border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-accent"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {editError && <p className="text-red-600 text-xs">{editError}</p>}
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
                                                            <p className="font-medium">{period.name}</p>
                                                            <p className="text-xs text-ink-muted">
                                                                {formatDateNO(period.startDate)} - {period.endDate ? formatDateNO(period.endDate) : 'Pågår'}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                {editingPeriodId !== period.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartRename(period)}
                                                        className="p-2 text-ink-faint hover:text-ink transition-colors"
                                                        aria-label={`Rediger navn på ${period.name}`}
                                                        disabled={isLoading}
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2 text-xs">
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
                                    className={`w-full pl-12 pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent font-medium text-lg ${weightError ? 'border-red-300' : 'border-surface-200'}`}
                                />
                            </div>
                            {weightError && <p className="text-red-600 text-xs mt-1.5">{weightError}</p>}
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
    useEscapeKey(onClose);
    const [startDate, setStartDate] = useState(
        userData.startDate ? new Date(userData.startDate).toISOString().split('T')[0] : ''
    );
    const [totalWeeks, setTotalWeeks] = useState(userData.totalWeeks || 12);
    const [stepGoal, setStepGoal] = useState(userData.stepGoal || 10000);

    const origStartDate = userData.startDate ? new Date(userData.startDate).toISOString().split('T')[0] : '';
    const origTotalWeeks = userData.totalWeeks || 12;
    const origStepGoal = userData.stepGoal || 10000;

    const hasChanges = startDate !== origStartDate || totalWeeks !== origTotalWeeks || stepGoal !== origStepGoal;

    const handleSave = useCallback(async () => {
        const updates = {};
        if (startDate !== origStartDate) {
            updates.startDate = startDate ? new Date(startDate).toISOString() : null;
        }
        if (totalWeeks !== origTotalWeeks) {
            const parsed = parseInt(totalWeeks, 10);
            if (!isNaN(parsed) && parsed >= 1) updates.totalWeeks = parsed;
        }
        if (stepGoal !== origStepGoal) {
            const parsed = parseInt(stepGoal, 10);
            if (!isNaN(parsed) && parsed >= 1000) updates.stepGoal = parsed;
        }
        onClose();
        if (Object.keys(updates).length > 0) {
            await onUpdateData(updates);
        }
    }, [startDate, totalWeeks, stepGoal, origStartDate, origTotalWeeks, origStepGoal, onUpdateData, onClose]);

    const handlePauseResume = useCallback(async () => {
        onClose();
        if (userData.isPaused) {
            await onUpdateData({ action: 'resume' });
        } else {
            await onUpdateData({ action: 'pause' });
        }
    }, [userData.isPaused, onUpdateData, onClose]);

    const handleStartDateChange = useCallback((e) => setStartDate(e.target.value), []);
    const handleTotalWeeksChange = useCallback((e) => {
        const val = e.target.value;
        setTotalWeeks(val === '' ? '' : (parseInt(val, 10) || ''));
    }, []);
    const handleStepGoalChange = useCallback((e) => {
        const val = e.target.value;
        setStepGoal(val === '' ? '' : (parseInt(val, 10) || ''));
    }, []);

    return (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <Card className="w-full max-w-md p-6 max-h-[80vh] overflow-y-auto overflow-x-hidden animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-display">Plan-innstillinger</h2>
                    <button onClick={onClose} aria-label="Lukk" className="text-ink-muted hover:text-ink p-2">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5">
                    <div>
                        <InputLabel>Startdato</InputLabel>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                            <input
                                type="date"
                                value={startDate}
                                onChange={handleStartDateChange}
                                className="w-full min-w-0 pl-12 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-accent font-medium appearance-none"
                            />
                        </div>
                    </div>

                    <div>
                        <InputLabel>Antall uker</InputLabel>
                        <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="52"
                            value={totalWeeks}
                            onChange={handleTotalWeeksChange}
                            aria-invalid={totalWeeks !== '' && (Number(totalWeeks) < 1 || Number(totalWeeks) > 52)}
                            className={`w-full px-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent font-medium ${totalWeeks !== '' && (Number(totalWeeks) < 1 || Number(totalWeeks) > 52) ? 'border-red-300' : 'border-surface-200'}`}
                        />
                        {totalWeeks !== '' && (Number(totalWeeks) < 1 || Number(totalWeeks) > 52) && (
                            <p className="text-red-600 text-xs mt-1.5">Velg mellom 1 og 52 uker.</p>
                        )}
                    </div>

                    <div>
                        <InputLabel>Ukentlig skrittmål</InputLabel>
                        <div className="relative">
                            <Footprints className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                            <input
                                type="number"
                                inputMode="numeric"
                                min="1000"
                                max="100000"
                                step="1000"
                                value={stepGoal}
                                onChange={handleStepGoalChange}
                                aria-invalid={stepGoal !== '' && (Number(stepGoal) < 1000 || Number(stepGoal) > 100000)}
                                className={`w-full pl-12 pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent font-medium ${stepGoal !== '' && (Number(stepGoal) < 1000 || Number(stepGoal) > 100000) ? 'border-red-300' : 'border-surface-200'}`}
                            />
                        </div>
                        {stepGoal !== '' && (Number(stepGoal) < 1000 || Number(stepGoal) > 100000) && (
                            <p className="text-red-600 text-xs mt-1.5">Velg mellom 1 000 og 100 000 skritt.</p>
                        )}
                    </div>

                    {userData.startDate && (
                        <Button
                            variant="secondary"
                            size="lg"
                            className="w-full"
                            onClick={handlePauseResume}
                        >
                            {userData.isPaused
                                ? <><Play size={18} /> Gjenoppta plan</>
                                : <><Pause size={18} /> Pause plan</>
                            }
                        </Button>
                    )}

                    <Button
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        onClick={onOpenPeriodModal}
                    >
                        <Activity size={18} /> Administrer runder <ArrowRight size={16} />
                    </Button>

                    <Button
                        variant="primary"
                        size="lg"
                        className="w-full"
                        onClick={handleSave}
                        disabled={
                            !hasChanges ||
                            (totalWeeks !== '' && (Number(totalWeeks) < 1 || Number(totalWeeks) > 52)) ||
                            (stepGoal !== '' && (Number(stepGoal) < 1000 || Number(stepGoal) > 100000))
                        }
                    >
                        <Check size={18} /> Lagre endringer
                    </Button>
                </div>
            </Card>
        </div>
    );
});

const DashboardView = React.memo(({ userData, isCoach, onUpdateData, onOpenWeightHistory }) => {
    const toast = useToast();
    const checkins = userData.checkins || [];
    const periods = userData.periods || [];
    const activePeriod = periods.find(p => p.isActive);
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [showPlanSettings, setShowPlanSettings] = useState(false);
    const [periodLoading, setPeriodLoading] = useState(false);
    
    const lastCheckin = checkins.length > 0 ? checkins[0] : null;

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

    // Memoize dagens quote
    const todayQuote = useMemo(() => QUOTES[new Date().getDay() % QUOTES.length], []);

    const handleOpenPlanSettings = useCallback(() => setShowPlanSettings(true), []);
    const handleClosePlanSettings = useCallback(() => setShowPlanSettings(false), []);
    const handleClosePeriodModal = useCallback(() => setShowPeriodModal(false), []);
    const handleOpenPeriodFromSettings = useCallback(() => {
        setShowPlanSettings(false);
        setShowPeriodModal(true);
    }, []);

    const handleCreatePeriod = useCallback(async (name, startingWeight, goalWeight) => {
        setPeriodLoading(true);
        try {
            await onUpdateData({ action: 'create_period', name, startingWeight, goalWeight });
            setShowPeriodModal(false);
            toast('Runde opprettet');
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, toast]);

    const handleEndPeriod = useCallback(async (periodId) => {
        setPeriodLoading(true);
        try {
            await onUpdateData({ action: 'end_period', periodId });
            setShowPeriodModal(false);
            toast('Runde avsluttet');
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, toast]);

    const handleUpdatePeriodCb = useCallback(async (periodId, updates) => {
        setPeriodLoading(true);
        try {
            await onUpdateData({ action: 'update_period', periodId, ...updates });
            setShowPeriodModal(false);
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData]);

    return (
        <div className="space-y-5 pb-32 animate-slide-up">
            {/* Period Management Modal */}
            {showPeriodModal && (
                <PeriodManagementModal
                    userData={userData}
                    onClose={handleClosePeriodModal}
                    isLoading={periodLoading}
                    onCreatePeriod={handleCreatePeriod}
                    onEndPeriod={handleEndPeriod}
                    onUpdatePeriod={handleUpdatePeriodCb}
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
            <div className="px-5 py-4 hero-tint text-white rounded-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="text-white/60 text-xs">
                                {activePeriod ? activePeriod.name : (userData.isPaused ? 'Plan på pause' : userData.startDate ? 'Din fremgang' : 'Velkommen')}
                            </p>
                            <h2 className="text-2xl font-display leading-tight mt-0.5">
                                {userData.isPaused ? 'Pauset' : userData.startDate ? `Uke ${currentWeek}` : 'Kom i gang'}
                            </h2>
                            {userData.startDate && !userData.isPaused && (() => {
                                const endDate = new Date(new Date(userData.startDate).getTime() + (userData.totalWeeks || 12) * 7 * 24 * 60 * 60 * 1000);
                                return (
                                    <p className="text-white/40 text-xs mt-0.5">
                                        {formatDateNO(userData.startDate)} → {formatDateNO(endDate.toISOString())}
                                    </p>
                                );
                            })()}
                            {activePeriod && activePeriod.startingWeight && (
                                <p className="text-white/40 text-xs mt-0.5">
                                    Startvekt: {formatWeight(activePeriod.startingWeight)} kg
                                    {activePeriod.goalWeight && ` → Mål: ${formatWeight(activePeriod.goalWeight)} kg`}
                                </p>
                            )}
                        </div>
                        {isCoach && (
                            <button
                                onClick={handleOpenPlanSettings}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/60 transition-colors"
                            >
                                <Pencil size={18} />
                            </button>
                        )}
                    </div>

                    {userData.startDate && !userData.isPaused && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-white/60">Fremdrift</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-white/40 text-xs text-right">{userData.totalWeeks || 12} uker totalt</p>
                        </div>
                    )}

                    {!userData.startDate && (
                        <div className="space-y-3">
                            <p className="text-white/60 text-sm">
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
                            <p className="text-white/60 text-sm">
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
                    <div className="flex justify-between items-start mb-3">
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
                </Card>

                <Card className="p-5 relative soft-panel">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted">
                            <Footprints size={20} />
                        </div>
                    </div>
                    <p className="section-label">Ukentlig skrittmål</p>
                    <p className="text-2xl font-semibold mt-1">{(userData.stepGoal || 10000).toLocaleString()}</p>
                </Card>
            </div>

            {/* Last Report */}
            {lastCheckin && (
                <div>
                    <p className="section-label mb-3 px-1">Siste rapport</p>
                    <Card className="p-4">
                        <div className="grid grid-cols-5 gap-2 text-center">
                            <div>
                                <div className={`rounded-lg py-2 ${parseInt(lastCheckin.accuracy) >= 8 ? 'bg-emerald-50' : parseInt(lastCheckin.accuracy) >= 5 ? 'bg-amber-50' : 'bg-red-50'}`}>
                                    <p className={`text-lg font-semibold tabular-nums ${parseInt(lastCheckin.accuracy) >= 8 ? 'text-emerald-700' : parseInt(lastCheckin.accuracy) >= 5 ? 'text-amber-700' : 'text-red-700'}`}>{lastCheckin.accuracy}</p>
                                </div>
                                <p className="text-[10px] text-ink-muted mt-1.5">Nøyakt.</p>
                            </div>
                            <div>
                                <div className={`rounded-lg py-2 ${parseInt(lastCheckin.energy) >= 8 ? 'bg-emerald-50' : parseInt(lastCheckin.energy) >= 5 ? 'bg-amber-50' : 'bg-red-50'}`}>
                                    <p className={`text-lg font-semibold tabular-nums ${parseInt(lastCheckin.energy) >= 8 ? 'text-emerald-700' : parseInt(lastCheckin.energy) >= 5 ? 'text-amber-700' : 'text-red-700'}`}>{lastCheckin.energy}</p>
                                </div>
                                <p className="text-[10px] text-ink-muted mt-1.5">Energi</p>
                            </div>
                            <div>
                                <div className={`rounded-lg py-2 ${parseInt(lastCheckin.sleep) >= 8 ? 'bg-emerald-50' : parseInt(lastCheckin.sleep) >= 5 ? 'bg-amber-50' : 'bg-red-50'}`}>
                                    <p className={`text-lg font-semibold tabular-nums ${parseInt(lastCheckin.sleep) >= 8 ? 'text-emerald-700' : parseInt(lastCheckin.sleep) >= 5 ? 'text-amber-700' : 'text-red-700'}`}>{lastCheckin.sleep}</p>
                                </div>
                                <p className="text-[10px] text-ink-muted mt-1.5">Søvn</p>
                            </div>
                            <div>
                                <div className="rounded-lg py-2 bg-surface-50">
                                    <p className="text-lg font-semibold tabular-nums text-ink">{lastCheckin.strengthSessions || 0}</p>
                                </div>
                                <p className="text-[10px] text-ink-muted mt-1.5">Styrke</p>
                            </div>
                            <div>
                                <div className="rounded-lg py-2 bg-surface-50">
                                    <p className="text-lg font-semibold tabular-nums text-ink">{lastCheckin.cardioSessions || 0}</p>
                                </div>
                                <p className="text-[10px] text-ink-muted mt-1.5">Cardio</p>
                            </div>
                        </div>
                        <div className="mt-3 flex justify-center gap-2">
                            <Badge variant={lastCheckin.stepsReached ? 'success' : 'muted'}>
                                <Footprints size={12} />
                                {lastCheckin.stepsReached ? 'Skrittmål' : 'Under mål'}
                            </Badge>
                            <Badge variant={lastCheckin.takenSupplements ? 'success' : 'muted'}>
                                {lastCheckin.takenSupplements ? <Check size={12} /> : <X size={12} />}
                                Tilskudd
                            </Badge>
                        </div>
                    </Card>
                </div>
            )}

            {/* Totaloversikt - kun hvis det finnes data */}
            {stats && (
                <div>
                    <p className="section-label mb-3 px-1">Din reise så langt</p>
                    <Card className="p-5">
                        <div className="grid grid-cols-4 gap-3 text-center mb-5">
                            <div>
                                <div className="text-2xl font-semibold text-ink">{stats.totalStrength}</div>
                                <div className="stat-label mt-1">Styrkeøkter</div>
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
                                <div className="stat-label mt-1">Snitt nøyakt.</div>
                            </div>
                        </div>
                        
                        {stats.weightChange && (
                            <div className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl ${parseFloat(stats.weightChange) < 0 ? 'bg-emerald-50 text-emerald-700' : parseFloat(stats.weightChange) > 0 ? 'bg-surface-100 text-ink' : 'bg-surface-100 text-ink-muted'}`}>
                                {parseFloat(stats.weightChange) < 0 ? <TrendingDown size={18} /> : parseFloat(stats.weightChange) > 0 ? <TrendingUp size={18} /> : <Minus size={18} />}
                                <span className="font-medium tabular-nums">
                                    {parseFloat(stats.weightChange) > 0 ? '+' : ''}{stats.weightChange.replace('.', ',')} kg total endring
                                </span>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Dagens motivasjon */}
            <Card className="p-6 bg-gradient-to-br from-[#f4ede2] via-surface-50 to-[#edf3ea]">
                <div className="text-center">
                    <p className="font-display text-[1.35rem] text-ink italic leading-relaxed">"{todayQuote.text}"</p>
                    <p className="text-xs text-ink-muted mt-3">- {todayQuote.author}</p>
                </div>
            </Card>
        </div>
    );
});

export default DashboardView;
