import React, { useState, useCallback, useMemo } from 'react';
import {
  Scale, Footprints, Edit2, ChevronRight, TrendingUp, TrendingDown, Minus,
  X, Plus, Check, Loader2, Calendar, Pause, Play, Activity, ArrowRight
} from 'lucide-react';
import { Card, Badge, Button, InputLabel } from '../components/ui';
import { useToast } from '../components/Toast';
import { useEscapeKey } from '../hooks';
import { formatDateNO, formatWeight } from '../lib/formatters';
import { QUOTES } from '../lib/config';

const PeriodManagementModal = React.memo(({ userData, onClose, isLoading, onCreatePeriod, onEndPeriod, onUpdatePeriod }) => {
    useEscapeKey(onClose);
    const [view, setView] = useState('list'); // 'list' eller 'create'
    const [formData, setFormData] = useState({ name: '', startingWeight: '', goalWeight: '' });
    const periods = userData.periods || [];
    const activePeriod = periods.find(p => p.isActive);

    const handleNameChange = useCallback((e) => setFormData(prev => ({ ...prev, name: e.target.value })), []);
    const handleStartingWeightChange = useCallback((e) => setFormData(prev => ({ ...prev, startingWeight: e.target.value })), []);
    const handleGoalWeightChange = useCallback((e) => setFormData(prev => ({ ...prev, goalWeight: e.target.value })), []);

    const handleCreate = useCallback(async (e) => {
        e.preventDefault();
        if (!formData.startingWeight) {
            alert('Startvekt er påkrevd');
            return;
        }
        await onCreatePeriod(formData.name || `Runde ${periods.length + 1}`, formData.startingWeight, formData.goalWeight || null);
        onClose();
    }, [formData, periods.length, onCreatePeriod, onClose]);

    const handleEnd = useCallback(async (periodId) => {
        if (confirm('Avslutt denne runden? Du kan starte en ny runde etterpå.')) {
            await onEndPeriod(periodId);
            onClose();
        }
    }, [onEndPeriod, onClose]);

    return (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <Card className="w-full max-w-md p-6 max-h-[80vh] overflow-y-auto animate-scale-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-display">Coaching-runder</h2>
                    <button onClick={onClose} className="text-ink-muted hover:text-ink p-2">
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
                                            <p className="font-semibold text-ink">{activePeriod.name}</p>
                                            <p className="text-sm text-ink-muted">Startet {formatDateNO(activePeriod.startDate)}</p>
                                        </div>
                                        <Badge variant="success">Aktiv</Badge>
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
                                                    <p className="font-medium">{period.name}</p>
                                                    <p className="text-xs text-ink-muted">
                                                        {formatDateNO(period.startDate)} - {period.endDate ? formatDateNO(period.endDate) : 'Pågår'}
                                                    </p>
                                                </div>
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
                                className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink"
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
                                    className="w-full pl-12 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink font-medium text-lg"
                                />
                            </div>
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
                                className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink font-medium text-lg"
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
const PlanSettingsModal = React.memo(({ userData, onClose, onUpdateData, onRefreshData, onOpenPeriodModal }) => {
    useEscapeKey(onClose);
    const toast = useToast();
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
            if (updates.stepGoal && onRefreshData) await onRefreshData();
        }
    }, [startDate, totalWeeks, stepGoal, origStartDate, origTotalWeeks, origStepGoal, onUpdateData, onRefreshData, onClose]);

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
                    <button onClick={onClose} className="text-ink-muted hover:text-ink p-2">
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
                                className="w-full min-w-0 pl-12 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink font-medium appearance-none"
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
                            className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink font-medium"
                        />
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
                                className="w-full pl-12 pr-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-ink font-medium"
                            />
                        </div>
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
                        disabled={!hasChanges}
                    >
                        <Check size={18} /> Lagre endringer
                    </Button>
                </div>
            </Card>
        </div>
    );
});

const DashboardView = React.memo(({ userData, isCoach, onUpdateData, onOpenWeightHistory, onRefreshData }) => {
    const toast = useToast();
    const checkins = userData.checkins || [];
    const periods = userData.periods || [];
    const activePeriod = periods.find(p => p.isActive);
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [showPlanSettings, setShowPlanSettings] = useState(false);
    const [periodLoading, setPeriodLoading] = useState(false);
    
    // Memoize sorterte checkins og lastCheckin
    const { sortedCheckins, lastCheckin } = useMemo(() => {
        const sorted = [...checkins].sort((a, b) => b.timestamp - a.timestamp);
        return { sortedCheckins: sorted, lastCheckin: sorted.length > 0 ? sorted[0] : null };
    }, [checkins]);

    // Memoize week calculation
    const { currentWeek, progress } = useMemo(() => {
        if (!userData.startDate) return { currentWeek: 0, progress: 0 };
        const start = new Date(userData.startDate);
        const end = userData.isPaused && userData.pausedAt ? new Date(userData.pausedAt) : new Date();
        const diffTime = Math.max(0, end - start);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7);
        const prog = Math.min((week / (userData.totalWeeks || 12)) * 100, 100);
        return { currentWeek: week, progress: prog };
    }, [userData.startDate, userData.isPaused, userData.pausedAt, userData.totalWeeks]);

    // Beregn statistikk fra alle innsjekker
    const stats = useMemo(() => {
        if (checkins.length === 0) return null;
        
        const totalStrength = checkins.reduce((sum, c) => sum + (parseInt(c.strengthSessions) || 0), 0);
        const totalCardio = checkins.reduce((sum, c) => sum + (parseInt(c.cardioSessions) || 0), 0);
        const stepsHit = checkins.filter(c => c.stepsReached).length;
        const avgAccuracy = (checkins.reduce((sum, c) => sum + (parseInt(c.accuracy) || 0), 0) / checkins.length).toFixed(1);
        
        // Vektendring - bruk aktivt periodestartsvekt hvis tilgjengelig
        let weightChange = null;
        let periodCheckins = checkins;
        
        // Filtrer checkins til kun de fra aktiv periode
        if (activePeriod && activePeriod.id) {
            periodCheckins = checkins.filter(c => c.periodId === activePeriod.id);
        }
        
        const validWeights = periodCheckins.filter(c => c.weight && parseFloat(c.weight) > 0).sort((a, b) => a.timestamp - b.timestamp);
        
        if (validWeights.length >= 1 && activePeriod?.startingWeight) {
            // Beregn fra rundens startvekt til siste vekt
            const startWeight = parseFloat(activePeriod.startingWeight);
            const lastWeight = parseFloat(validWeights[validWeights.length - 1].weight);
            weightChange = (lastWeight - startWeight).toFixed(1);
        } else if (validWeights.length >= 2) {
            // Fallback: første til siste checkin
            const first = parseFloat(validWeights[0].weight);
            const last = parseFloat(validWeights[validWeights.length - 1].weight);
            weightChange = (last - first).toFixed(1);
        }
        
        return { totalStrength, totalCardio, stepsHit, avgAccuracy, weightChange, totalCheckins: checkins.length, periodCheckins: periodCheckins.length };
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
            if (onRefreshData) await onRefreshData();
            toast('Runde opprettet');
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, onRefreshData, toast]);

    const handleEndPeriod = useCallback(async (periodId) => {
        setPeriodLoading(true);
        try {
            await onUpdateData({ action: 'end_period', periodId });
            setShowPeriodModal(false);
            if (onRefreshData) await onRefreshData();
            toast('Runde avsluttet');
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, onRefreshData, toast]);

    const handleUpdatePeriodCb = useCallback(async (periodId, updates) => {
        setPeriodLoading(true);
        try {
            await onUpdateData({ action: 'update_period', periodId, ...updates });
            setShowPeriodModal(false);
            if (onRefreshData) await onRefreshData();
        } finally {
            setPeriodLoading(false);
        }
    }, [onUpdateData, onRefreshData]);

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
                    onRefreshData={onRefreshData}
                    onOpenPeriodModal={handleOpenPeriodFromSettings}
                />
            )}

            {/* Hero Card */}
            <div className="p-6 bg-ink text-white rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-white/60 text-sm">
                                {activePeriod ? activePeriod.name : (userData.isPaused ? 'Plan på pause' : userData.startDate ? 'Din fremgang' : 'Velkommen')}
                            </p>
                            <h2 className="text-3xl font-display mt-1">
                                {userData.isPaused ? 'Pauset' : userData.startDate ? `Uke ${currentWeek}` : 'Kom i gang'}
                            </h2>
                            {userData.startDate && !userData.isPaused && (() => {
                                const endDate = new Date(new Date(userData.startDate).getTime() + (userData.totalWeeks || 12) * 7 * 24 * 60 * 60 * 1000);
                                return (
                                    <p className="text-white/40 text-sm mt-1">
                                        {formatDateNO(userData.startDate)} → {formatDateNO(endDate.toISOString())}
                                    </p>
                                );
                            })()}
                            {activePeriod && activePeriod.startingWeight && (
                                <p className="text-white/40 text-sm mt-1">
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
                                <Edit2 size={18} />
                            </button>
                        )}
                    </div>

                    {userData.startDate && !userData.isPaused && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-white/60">Fremdrift</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-white rounded-full transition-all duration-500" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-white/40 text-xs text-right">{userData.totalWeeks || 12} uker totalt</p>
                        </div>
                    )}

                    {!userData.startDate && (
                        <p className="text-white/60 text-sm">
                            {isCoach ? 'Trykk på blyanten for å sette startdato' : 'Venter på at coach setter opp planen'}
                        </p>
                    )}

                    {userData.isPaused && (
                        <p className="text-white/60 text-sm">
                            {isCoach ? 'Trykk på blyanten for å gjenoppta' : 'Planen er satt på pause'}
                        </p>
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
                    <p className="text-xs text-ink-muted uppercase tracking-wide">Siste vekt</p>
                    <p className="text-2xl font-semibold mt-1 tabular-nums">
                        {lastCheckin ? formatWeight(lastCheckin.weight) : '-'}
                        <span className="text-sm font-normal text-ink-muted ml-1">kg</span>
                    </p>
                </Card>

                <Card className="p-5 relative">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted">
                            <Footprints size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-ink-muted uppercase tracking-wide">Ukentlig skrittmål</p>
                    <p className="text-2xl font-semibold mt-1">{(userData.stepGoal || 10000).toLocaleString()}</p>
                </Card>
            </div>

            {/* Last Report */}
            {lastCheckin && (
                <div>
                    <p className="text-xs text-ink-muted uppercase tracking-wide mb-3 px-1">Siste rapport</p>
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
                    <p className="text-xs text-ink-muted uppercase tracking-wide mb-3 px-1">Din reise så langt</p>
                    <Card className="p-5">
                        <div className="grid grid-cols-4 gap-3 text-center mb-5">
                            <div>
                                <div className="text-2xl font-semibold text-ink">{stats.totalStrength}</div>
                                <div className="text-[10px] text-ink-muted uppercase tracking-wide mt-1">Styrkeøkter</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-ink">{stats.totalCardio}</div>
                                <div className="text-[10px] text-ink-muted uppercase tracking-wide mt-1">Cardio</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-ink tabular-nums">{stats.stepsHit}/{stats.totalCheckins}</div>
                                <div className="text-[10px] text-ink-muted uppercase tracking-wide mt-1">Skrittmål</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-ink tabular-nums">{stats.avgAccuracy}</div>
                                <div className="text-[10px] text-ink-muted uppercase tracking-wide mt-1">Snitt nøyakt.</div>
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
            <Card className="p-6 bg-gradient-to-br from-surface-50 to-surface-100 border-dashed">
                <div className="text-center">
                    <p className="font-display text-lg text-ink italic leading-relaxed">"{todayQuote.text}"</p>
                    <p className="text-xs text-ink-muted mt-3">- {todayQuote.author}</p>
                </div>
            </Card>
        </div>
    );
});

export default DashboardView;
