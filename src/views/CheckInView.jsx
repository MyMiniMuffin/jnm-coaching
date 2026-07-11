import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Check, Camera, X, Trash2, Loader2, Scale,
  Activity, Footprints, AlertCircle, Save, Pencil
} from 'lucide-react';
import { Card, Badge, Button, EmptyState, IconButton, InputLabel, SegmentedControl } from '../components/ui';
import ImageModal from '../components/ImageModal';
import ReportMetrics from '../components/ReportMetrics';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { createConfetti } from '../lib/confetti';
import { formatDateNO, formatWeight, getThumbnail } from '../lib/formatters';
import { OPTIONS_1_TO_10, OPTIONS_0_TO_7, INITIAL_FORM_DATA } from '../lib/config';

const CheckInView = React.memo(({ checkins, onNewCheckin, onDelete, onUpdate, canEdit = false, isReadOnly, canDelete = !isReadOnly, stepGoal, hideForm = false, draftKey = 'default', uploadUserId }) => {
    const [step, setStep] = useState('form');
    const [lightbox, setLightbox] = useState({ isOpen: false, images: [], index: 0 });
    const [isCompressing, setIsCompressing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [weightFieldError, setWeightFieldError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [restoredDraft, setRestoredDraft] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editError, setEditError] = useState('');
    const [editWeightError, setEditWeightError] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const weightInputRef = React.useRef(null);
    const successResetTimeoutRef = React.useRef(null);
    const confirmDialog = useConfirm();
    const storageKey = `jnm_checkin_draft_${draftKey}`;

    useEffect(() => () => {
        if (successResetTimeoutRef.current) {
            clearTimeout(successResetTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (isReadOnly || hideForm) return;
        try {
            const savedDraft = localStorage.getItem(storageKey);
            if (savedDraft) {
                const parsedDraft = JSON.parse(savedDraft);
                setFormData(prev => ({ ...prev, ...parsedDraft }));
                setRestoredDraft(true);
            }
        } catch (e) {
            console.error('[CheckIn] Kunne ikke laste utkast:', e);
        }
    }, [storageKey, isReadOnly, hideForm]);

    useEffect(() => {
        if (isReadOnly || hideForm) return;

        const hasDraftContent =
            formData.weight ||
            formData.comment ||
            formData.images.length > 0 ||
            formData.energy !== INITIAL_FORM_DATA.energy ||
            formData.sleep !== INITIAL_FORM_DATA.sleep ||
            formData.accuracy !== INITIAL_FORM_DATA.accuracy ||
            formData.strengthSessions !== INITIAL_FORM_DATA.strengthSessions ||
            formData.cardioSessions !== INITIAL_FORM_DATA.cardioSessions ||
            formData.stepsReached !== INITIAL_FORM_DATA.stepsReached ||
            formData.takenSupplements !== INITIAL_FORM_DATA.takenSupplements;

        const timeoutId = setTimeout(() => {
            try {
                if (hasDraftContent) {
                    localStorage.setItem(storageKey, JSON.stringify(formData));
                } else {
                    localStorage.removeItem(storageKey);
                }
            } catch (e) {
                console.error('[CheckIn] Kunne ikke lagre utkast:', e);
            }
        }, 350);

        return () => clearTimeout(timeoutId);
    }, [formData, storageKey, isReadOnly, hideForm]);

    const closeLightbox = useCallback(() => {
        setLightbox(prev => ({ ...prev, isOpen: false }));
    }, []);

    const openLightbox = useCallback((images, index) => {
        setLightbox({ isOpen: true, images, index });
    }, []);

    const handleImageUpload = useCallback(async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (!uploadUserId) {
            setErrorMessage('Mangler bruker for opplasting. Last inn siden på nytt og prøv igjen.');
            return;
        }
        setIsCompressing(true);
        setErrorMessage('');
        try {
            const uploadPromises = files.map(async (file) => {
                const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Kunne ikke lese fil: ' + file.name));
                    reader.readAsDataURL(file);
                });

                const result = await api.uploadImage(base64Image, uploadUserId, 'checkin');
                if (result.authError) {
                    throw new Error('Autentisering feilet');
                }
                return result.data.url;
            });
            const results = await Promise.allSettled(uploadPromises);
            const uploadedUrls = [];
            const failedCount = results.filter(r => r.status === 'rejected').length;
            for (const result of results) {
                if (result.status === 'fulfilled') uploadedUrls.push(result.value);
            }
            if (uploadedUrls.length > 0) {
                setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
            }
            if (failedCount > 0) {
                setErrorMessage(`${failedCount} av ${results.length} bilder kunne ikke lastes opp.`);
            }
        } catch (err) {
            console.error('[CheckIn] Bildeopplasting feilet:', err);
            setErrorMessage('Bildeopplasting feilet. Sjekk tilkoblingen og prøv igjen.');
        } finally {
            setIsCompressing(false);
        }
    }, [uploadUserId]);

    const removeImage = useCallback((indexToRemove) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, index) => index !== indexToRemove) }));
    }, []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const weightNum = parseFloat(formData.weight);
        if (!formData.weight || isNaN(weightNum) || weightNum < 20 || weightNum > 500) {
            setWeightFieldError('Skriv inn en gyldig vekt mellom 20 og 500 kg.');
            weightInputRef.current?.focus();
            return;
        }
        setWeightFieldError('');
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            const newEntry = { 
                id: Date.now(), 
                date: new Date().toISOString().split('T')[0], 
                timestamp: Date.now(), 
                ...formData 
            };
            await onNewCheckin(newEntry);
            try { localStorage.removeItem(storageKey); } catch (e) {}
            setRestoredDraft(false);
            setStep('success');
            createConfetti(); // 🎉 Konfetti!
            if (successResetTimeoutRef.current) {
                clearTimeout(successResetTimeoutRef.current);
            }
            successResetTimeoutRef.current = setTimeout(() => {
                setStep('form');
                setFormData(INITIAL_FORM_DATA);
                successResetTimeoutRef.current = null;
            }, 2500);
        } catch (error) {
            console.error('Checkin-innsending feilet:', error);
            setErrorMessage('Kunne ikke sende rapporten. Prøv igjen.');
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, onNewCheckin, storageKey]);

    const sortedCheckins = checkins;

    const lastWeight = useMemo(() => {
        const last = sortedCheckins.find(c => c.weight && parseFloat(c.weight) > 0);
        return last ? parseFloat(last.weight) : null;
    }, [sortedCheckins]);

    const historySummary = useMemo(() => {
        const recent = sortedCheckins.slice(0, 4);
        if (recent.length === 0) return null;

        const numbers = recent.reduce((acc, entry) => {
            const weight = parseFloat(entry.weight);
            if (!isNaN(weight) && weight > 0) acc.weights.push(weight);
            acc.energy += parseInt(entry.energy, 10) || 0;
            acc.sleep += parseInt(entry.sleep, 10) || 0;
            acc.accuracy += parseInt(entry.accuracy, 10) || 0;
            acc.strength += parseInt(entry.strengthSessions, 10) || 0;
            acc.cardio += parseInt(entry.cardioSessions, 10) || 0;
            if (entry.stepsReached) acc.stepsHit += 1;
            return acc;
        }, {
            weights: [],
            energy: 0,
            sleep: 0,
            accuracy: 0,
            strength: 0,
            cardio: 0,
            stepsHit: 0
        });

        const newestWeight = numbers.weights[0] ?? null;
        const oldestWeight = numbers.weights[numbers.weights.length - 1] ?? null;
        const weightChange = newestWeight !== null && oldestWeight !== null && numbers.weights.length > 1
            ? newestWeight - oldestWeight
            : null;
        const average = (value) => (value / recent.length).toFixed(1).replace('.', ',');

        return {
            count: recent.length,
            weightChange,
            avgEnergy: average(numbers.energy),
            avgSleep: average(numbers.sleep),
            avgAccuracy: average(numbers.accuracy),
            totalStrength: numbers.strength,
            totalCardio: numbers.cardio,
            stepsHit: numbers.stepsHit
        };
    }, [sortedCheckins]);

    // Form field handlers - memoized
    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Stabile onChange-handlers for å ikke bryte React.memo på SelectField
    const handleWeightChange = useCallback((e) => {
        updateField('weight', e.target.value);
        if (weightFieldError) setWeightFieldError('');
    }, [updateField, weightFieldError]);
    const handleEnergyChange = useCallback((val) => updateField('energy', val), [updateField]);
    const handleSleepChange = useCallback((val) => updateField('sleep', val), [updateField]);
    const handleAccuracyChange = useCallback((val) => updateField('accuracy', val), [updateField]);
    const handleStrengthChange = useCallback((val) => updateField('strengthSessions', val), [updateField]);
    const handleCardioChange = useCallback((val) => updateField('cardioSessions', val), [updateField]);
    const handleStepsChange = useCallback((e) => updateField('stepsReached', e.target.checked), [updateField]);
    const handleSupplementsChange = useCallback((e) => updateField('takenSupplements', e.target.checked), [updateField]);
    const handleCommentChange = useCallback((e) => updateField('comment', e.target.value), [updateField]);
    const dismissDraftNotice = useCallback(() => setRestoredDraft(false), []);

    const startEdit = useCallback((entry) => {
        setEditingId(entry.id);
        setEditForm({
            weight: entry.weight != null ? String(entry.weight) : '',
            energy: String(entry.energy ?? 5),
            sleep: String(entry.sleep ?? 5),
            accuracy: String(entry.accuracy ?? 5),
            strengthSessions: String(entry.strengthSessions ?? 0),
            cardioSessions: String(entry.cardioSessions ?? 0),
            stepsReached: Boolean(entry.stepsReached),
            takenSupplements: Boolean(entry.takenSupplements),
            comment: entry.comment || ''
        });
        setEditError('');
        setEditWeightError('');
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditForm(null);
        setEditError('');
        setEditWeightError('');
    }, []);

    const updateEditField = useCallback((field, value) => {
        setEditForm(prev => prev ? { ...prev, [field]: value } : prev);
    }, []);

    const submitEdit = useCallback(async (e) => {
        e.preventDefault();
        if (!editForm || !editingId) return;
        const weightNum = parseFloat(editForm.weight);
        if (!editForm.weight || isNaN(weightNum) || weightNum < 20 || weightNum > 500) {
            setEditWeightError('Skriv inn en gyldig vekt mellom 20 og 500 kg.');
            return;
        }
        setEditWeightError('');
        setIsSavingEdit(true);
        setEditError('');
        try {
            await onUpdate(editingId, {
                weight: weightNum,
                energy: parseInt(editForm.energy, 10),
                sleep: parseInt(editForm.sleep, 10),
                accuracy: parseInt(editForm.accuracy, 10),
                strengthSessions: parseInt(editForm.strengthSessions, 10) || 0,
                cardioSessions: parseInt(editForm.cardioSessions, 10) || 0,
                stepsReached: Boolean(editForm.stepsReached),
                takenSupplements: Boolean(editForm.takenSupplements),
                comment: editForm.comment || ''
            });
            setEditingId(null);
            setEditForm(null);
        } catch (err) {
            console.error('Edit feilet:', err);
            setEditError('Kunne ikke lagre endringene. Prøv igjen.');
        } finally {
            setIsSavingEdit(false);
        }
    }, [editForm, editingId, onUpdate]);

    if (step === 'success') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] animate-scale-in text-center px-6">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-success/10 text-success">
                    <Check size={32} strokeWidth={2.5} />
                </div>
                <h2 className="text-[2rem] font-display mb-2">Rapport sendt</h2>
                <p className="text-ink-muted">Oppdateringen din er lagret</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-32 animate-slide-up">
            {lightbox.isOpen && (
                <ImageModal images={lightbox.images} initialIndex={lightbox.index} onClose={closeLightbox} />
            )}

            {!isReadOnly && !hideForm && (
                <form onSubmit={handleSubmit} className="space-y-5">
                    {restoredDraft && (
                        <Card className="border-success/20 bg-success/10 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium text-success">Utkast gjenopprettet</p>
                                    <p className="mt-1 text-sm text-success">Du kan fortsette der du slapp og sende rapporten når du er klar.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={dismissDraftNotice}
                                    className="text-success transition-colors hover:text-ink"
                                    aria-label="Skjul melding om gjenopprettet utkast"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </Card>
                    )}
                    <Card className="p-5 space-y-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="section-title">Ny ukesrapport</h3>
                                <p className="text-sm text-ink-muted mt-1">Fyll ut denne ukens status først. Historikken ligger separat lenger ned.</p>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium text-ink-faint bg-surface-100 px-2 py-1 rounded-full">
                                Auto-lagret
                            </span>
                        </div>
                        
                        <div>
                            <InputLabel>Vekt (kg)</InputLabel>
                            <div className="relative">
                                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                                <input
                                    ref={weightInputRef}
                                    type="number"
                                    inputMode="decimal"
                                    step="0.1"
                                    min="20"
                                    max="500"
                                    required
                                    aria-invalid={!!weightFieldError}
                                    aria-describedby={weightFieldError ? 'weight-error' : undefined}
                                    value={formData.weight}
                                    onChange={handleWeightChange}
                                    className={`w-full pl-12 pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent focus:border-accent font-medium text-lg placeholder-ink-faint ${weightFieldError ? 'border-error/40' : 'border-surface-200'}`}
                                    placeholder="f.eks. 83.5"
                                />
                            </div>
                            {weightFieldError ? (
                                <p id="weight-error" className="text-error text-xs mt-1.5">{weightFieldError}</p>
                            ) : lastWeight && (
                                <p className="text-xs text-ink-muted mt-1.5">Forrige: {formatWeight(lastWeight)} kg</p>
                            )}
                        </div>

                        <SegmentedControl
                            label="Energi (1–10)"
                            value={formData.energy}
                            onChange={handleEnergyChange}
                            options={OPTIONS_1_TO_10}
                            colorize
                        />
                        <SegmentedControl
                            label="Søvnkvalitet (1–10)"
                            value={formData.sleep}
                            onChange={handleSleepChange}
                            options={OPTIONS_1_TO_10}
                            colorize
                        />
                        <SegmentedControl
                            label="Nøyaktighet (1–10)"
                            value={formData.accuracy}
                            onChange={handleAccuracyChange}
                            options={OPTIONS_1_TO_10}
                            colorize
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <SegmentedControl
                                label="Styrkeøkter"
                                value={formData.strengthSessions}
                                onChange={handleStrengthChange}
                                options={OPTIONS_0_TO_7}
                            />
                            <SegmentedControl
                                label="Cardio"
                                value={formData.cardioSessions}
                                onChange={handleCardioChange}
                                options={OPTIONS_0_TO_7}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-colors ${formData.stepsReached ? 'bg-success/10 border-success/20' : 'bg-surface-50 border-surface-200'}`}>
                                <input type="checkbox" checked={formData.stepsReached} onChange={handleStepsChange} className="sr-only" />
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${formData.stepsReached ? 'bg-success text-white' : 'bg-surface-200 text-surface-200'}`}>
                                    <Check size={14} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="font-medium">Skrittmål oppnådd</p>
                                    <p className="text-sm text-ink-muted">{stepGoal?.toLocaleString() || '10 000'} skritt</p>
                                </div>
                            </label>
                            <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-colors ${formData.takenSupplements ? 'bg-success/10 border-success/20' : 'bg-surface-50 border-surface-200'}`}>
                                <input type="checkbox" checked={formData.takenSupplements} onChange={handleSupplementsChange} className="sr-only" />
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${formData.takenSupplements ? 'bg-success text-white' : 'bg-surface-200 text-surface-200'}`}>
                                    <Check size={14} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="font-medium">Kosttilskudd tatt</p>
                                    <p className="text-sm text-ink-muted">Tatt jevnlig denne uken</p>
                                </div>
                            </label>
                        </div>

                        <div>
                            <InputLabel>Kommentar</InputLabel>
                            <textarea
                                value={formData.comment}
                                onChange={handleCommentChange}
                                maxLength={5000}
                                className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl h-28 outline-none resize-none focus:ring-2 focus:ring-accent focus:border-accent"
                                placeholder="Hvordan har uken vært?"
                            />
                        </div>
                    </Card>

                    {/* Image Upload */}
                    <Card className="p-5">
                        {formData.images.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {formData.images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square">
                                        <img 
                                            src={getThumbnail(img)} 
                                            className="w-full h-full object-cover rounded-lg cursor-pointer" 
                                            alt="Preview" 
                                            onClick={() => setLightbox({ isOpen: true, images: formData.images, index: idx })} 
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            aria-label="Fjern bilde"
                                            className="absolute -top-1.5 -right-1.5 bg-ink text-white p-1.5 rounded-full"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <label className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-200 rounded-xl cursor-pointer hover:border-surface-300 hover:bg-surface-50 transition-all ${isCompressing ? 'opacity-50 pointer-events-none' : ''}`}>
                            {isCompressing ? (
                                <Loader2 className="animate-spin text-ink-muted" size={24} />
                            ) : (
                                <>
                                    <Camera size={24} className="text-ink-muted mb-2" />
                                    <span className="font-medium text-ink-muted">Last opp bilder</span>
                                </>
                            )}
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                        </label>
                    </Card>

                    {errorMessage && (
                        <div className="flex items-center gap-3 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
                            <AlertCircle size={18} />
                            {errorMessage}
                        </div>
                    )}

                    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || isCompressing}>
                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
                        {isSubmitting ? 'Sender...' : 'Send rapport'}
                    </Button>
                </form>
            )}

            {/* History */}
            <div className={!isReadOnly && !hideForm ? "pt-8 border-t border-surface-200" : ""}>
                <div className="mb-4 px-1">
                    <div>
                        <p className="section-label">Tidligere rapporter</p>
                        <p className="text-sm text-ink-muted mt-1">
                            {sortedCheckins.length === 0
                                ? 'Ingen tidligere innsendinger ennå'
                                : `${sortedCheckins.length} rapport${sortedCheckins.length > 1 ? 'er' : ''} lagret`}
                        </p>
                    </div>
                </div>

                {sortedCheckins.length === 0 ? (
                    <EmptyState
                        icon={Activity}
                        title="Ingen rapporter enda"
                        description="Fyll ut skjemaet over for å sende din første ukesrapport"
                    />
                ) : (
                    <div className="space-y-3">
                        {historySummary && (
                            <Card className="p-4 bg-surface-50">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <p className="font-medium">Siste {historySummary.count} rapport{historySummary.count > 1 ? 'er' : ''}</p>
                                        <p className="text-xs text-ink-muted">Rask status fra nyeste innsendinger</p>
                                    </div>
                                    <Badge
                                        variant={
                                            historySummary.weightChange === null || Math.abs(historySummary.weightChange) < 0.05
                                                ? 'muted'
                                                : historySummary.weightChange < 0
                                                    ? 'success'
                                                    : 'warning'
                                        }
                                        className="tabular-nums"
                                    >
                                        <Scale size={12} />
                                        {historySummary.weightChange === null
                                            ? 'Vekttrend -'
                                            : `${historySummary.weightChange > 0 ? '+' : ''}${formatWeight(historySummary.weightChange)} kg`}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="rounded-lg bg-white p-3 border border-surface-100">
                                        <p className="text-ink-faint">Snitt score</p>
                                        <p className="font-semibold text-ink mt-1 tabular-nums">{historySummary.avgAccuracy} nøyakt.</p>
                                        <p className="text-ink-muted tabular-nums">{historySummary.avgEnergy} energi / {historySummary.avgSleep} søvn</p>
                                    </div>
                                    <div className="rounded-lg bg-white p-3 border border-surface-100">
                                        <p className="text-ink-faint">Økter</p>
                                        <p className="font-semibold text-ink mt-1 tabular-nums">{historySummary.totalStrength} styrke</p>
                                        <p className="text-ink-muted tabular-nums">{historySummary.totalCardio} cardio</p>
                                    </div>
                                    <div className="rounded-lg bg-white p-3 border border-surface-100">
                                        <p className="text-ink-faint">Skrittmål</p>
                                        <p className="font-semibold text-ink mt-1 tabular-nums">{historySummary.stepsHit}/{historySummary.count}</p>
                                        <p className="text-ink-muted">uker oppnådd</p>
                                    </div>
                                    <div className="rounded-lg bg-white p-3 border border-surface-100">
                                        <p className="text-ink-faint">Rapporter</p>
                                        <p className="font-semibold text-ink mt-1 tabular-nums">{sortedCheckins.length}</p>
                                        <p className="text-ink-muted">totalt lagret</p>
                                    </div>
                                </div>
                            </Card>
                        )}
                        {sortedCheckins.map((entry) => {
                            // Sikre at images alltid er en array
                            let imageArray = [];
                            if (entry.images) {
                                if (typeof entry.images === 'string') {
                                    try {
                                        imageArray = JSON.parse(entry.images);
                                    } catch (e) {
                                        imageArray = [];
                                    }
                                } else if (Array.isArray(entry.images)) {
                                    imageArray = entry.images;
                                }
                            } else if (entry.image) {
                                imageArray = [entry.image];
                            }

                            // Filtrer ut ugyldige verdier
                            const displayImages = imageArray.filter(img => img && typeof img === 'string' && img.trim() !== '');

                            const isEditing = editingId === entry.id;
                            if (isEditing && editForm) {
                                return (
                                    <Card key={entry.id} className="p-5">
                                        <form onSubmit={submitEdit} className="space-y-5">
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium">{formatDateNO(entry.date)}</p>
                                                <span className="text-xs text-ink-muted">Redigerer</span>
                                            </div>
                                            <div>
                                                <InputLabel>Vekt (kg)</InputLabel>
                                                <div className="relative">
                                                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        step="0.1"
                                                        min="20"
                                                        max="500"
                                                        required
                                                        aria-invalid={!!editWeightError}
                                                        value={editForm.weight}
                                                        onChange={(e) => { updateEditField('weight', e.target.value); if (editWeightError) setEditWeightError(''); }}
                                                        className={`w-full pl-12 pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent focus:border-accent font-medium text-lg ${editWeightError ? 'border-error/40' : 'border-surface-200'}`}
                                                    />
                                                </div>
                                                {editWeightError && (
                                                    <p className="text-error text-xs mt-1.5">{editWeightError}</p>
                                                )}
                                            </div>
                                            <SegmentedControl
                                                label="Energi (1–10)"
                                                value={editForm.energy}
                                                onChange={(v) => updateEditField('energy', v)}
                                                options={OPTIONS_1_TO_10}
                                                colorize
                                            />
                                            <SegmentedControl
                                                label="Søvnkvalitet (1–10)"
                                                value={editForm.sleep}
                                                onChange={(v) => updateEditField('sleep', v)}
                                                options={OPTIONS_1_TO_10}
                                                colorize
                                            />
                                            <SegmentedControl
                                                label="Nøyaktighet (1–10)"
                                                value={editForm.accuracy}
                                                onChange={(v) => updateEditField('accuracy', v)}
                                                options={OPTIONS_1_TO_10}
                                                colorize
                                            />
                                            <div className="grid grid-cols-2 gap-4">
                                                <SegmentedControl
                                                    label="Styrkeøkter"
                                                    value={editForm.strengthSessions}
                                                    onChange={(v) => updateEditField('strengthSessions', v)}
                                                    options={OPTIONS_0_TO_7}
                                                />
                                                <SegmentedControl
                                                    label="Cardio"
                                                    value={editForm.cardioSessions}
                                                    onChange={(v) => updateEditField('cardioSessions', v)}
                                                    options={OPTIONS_0_TO_7}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-colors ${editForm.stepsReached ? 'bg-success/10 border-success/20' : 'bg-surface-50 border-surface-200'}`}>
                                                    <input type="checkbox" checked={editForm.stepsReached} onChange={(e) => updateEditField('stepsReached', e.target.checked)} className="sr-only" />
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${editForm.stepsReached ? 'bg-success text-white' : 'bg-surface-200 text-surface-200'}`}>
                                                        <Check size={14} strokeWidth={2.5} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">Skrittmål oppnådd</p>
                                                        <p className="text-sm text-ink-muted">{stepGoal?.toLocaleString() || '10 000'} skritt</p>
                                                    </div>
                                                </label>
                                                <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-colors ${editForm.takenSupplements ? 'bg-success/10 border-success/20' : 'bg-surface-50 border-surface-200'}`}>
                                                    <input type="checkbox" checked={editForm.takenSupplements} onChange={(e) => updateEditField('takenSupplements', e.target.checked)} className="sr-only" />
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${editForm.takenSupplements ? 'bg-success text-white' : 'bg-surface-200 text-surface-200'}`}>
                                                        <Check size={14} strokeWidth={2.5} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">Kosttilskudd tatt</p>
                                                        <p className="text-sm text-ink-muted">Tatt jevnlig denne uken</p>
                                                    </div>
                                                </label>
                                            </div>
                                            <div>
                                                <InputLabel>Kommentar</InputLabel>
                                                <textarea
                                                    value={editForm.comment}
                                                    onChange={(e) => updateEditField('comment', e.target.value)}
                                                    maxLength={5000}
                                                    className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl h-28 outline-none resize-none focus:ring-2 focus:ring-accent focus:border-accent"
                                                />
                                            </div>
                                            {editError && (
                                                <div className="flex items-center gap-3 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
                                                    <AlertCircle size={18} />
                                                    {editError}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <Button type="button" variant="ghost" onClick={cancelEdit} disabled={isSavingEdit} className="flex-1">
                                                    Avbryt
                                                </Button>
                                                <Button type="submit" disabled={isSavingEdit} className="flex-1">
                                                    {isSavingEdit ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                                    {isSavingEdit ? 'Lagrer...' : 'Lagre'}
                                                </Button>
                                            </div>
                                        </form>
                                    </Card>
                                );
                            }
                            return (
                                <Card key={entry.id} className="p-5 group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-medium">{formatDateNO(entry.date)}</p>
                                            <p className="text-xs text-ink-muted">{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canEdit && onUpdate && (
                                                <IconButton
                                                    type="button"
                                                    onClick={() => startEdit(entry)}
                                                    aria-label="Rediger rapport"
                                                    tone="accent"
                                                >
                                                    <Pencil size={16} />
                                                </IconButton>
                                            )}
                                            {canDelete && onDelete && (
                                                <IconButton
                                                    type="button"
                                                    onClick={async () => { if(await confirmDialog('Slett denne rapporten?', { title: 'Slett rapport', confirmText: 'Slett', destructive: true })) onDelete(entry.id); }}
                                                    aria-label="Slett rapport"
                                                    tone="danger"
                                                >
                                                    <Trash2 size={16} />
                                                </IconButton>
                                            )}
                                            <Badge className="tabular-nums">{formatWeight(entry.weight)} kg</Badge>
                                        </div>
                                    </div>
                                    
                                    <ReportMetrics report={entry} className="mb-4" />

                                    {entry.comment && (
                                        <p className="text-sm text-ink-muted bg-surface-50 p-3 rounded-lg italic mb-4">"{entry.comment}"</p>
                                    )}
                                    
                                    {displayImages.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                                            {displayImages.map((img, idx) => (
                                                <img
                                                    key={idx}
                                                    src={getThumbnail(img)}
                                                    loading="lazy"
                                                    className="w-16 h-16 object-cover rounded-lg cursor-pointer flex-none"
                                                    alt="Checkin"
                                                    onClick={() => openLightbox(displayImages, idx)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
});

export default CheckInView;
