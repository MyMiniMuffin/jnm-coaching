import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Check, Camera, X, Trash2, Loader2, Scale,
  Activity, Footprints, AlertCircle, Save
} from 'lucide-react';
import { Card, Badge, Button, InputLabel, SegmentedControl } from '../components/ui';
import ImageModal from '../components/ImageModal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { createConfetti } from '../lib/confetti';
import { formatDateNO, formatWeight, getThumbnail } from '../lib/formatters';
import { OPTIONS_1_TO_10, OPTIONS_0_TO_7, INITIAL_FORM_DATA } from '../lib/config';

const CheckInView = React.memo(({ checkins, onNewCheckin, onDelete, isReadOnly, canDelete = !isReadOnly, stepGoal, hideForm = false, draftKey = 'default', uploadUserId }) => {
    const [step, setStep] = useState('form');
    const [lightbox, setLightbox] = useState({ isOpen: false, images: [], index: 0 });
    const [isCompressing, setIsCompressing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [weightFieldError, setWeightFieldError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [restoredDraft, setRestoredDraft] = useState(false);
    const weightInputRef = React.useRef(null);
    const confirmDialog = useConfirm();
    const storageKey = `jnm_checkin_draft_${draftKey}`;

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
        try {
            if (
                formData.weight ||
                formData.comment ||
                formData.images.length > 0 ||
                formData.energy !== INITIAL_FORM_DATA.energy ||
                formData.sleep !== INITIAL_FORM_DATA.sleep ||
                formData.accuracy !== INITIAL_FORM_DATA.accuracy ||
                formData.strengthSessions !== INITIAL_FORM_DATA.strengthSessions ||
                formData.cardioSessions !== INITIAL_FORM_DATA.cardioSessions ||
                formData.stepsReached !== INITIAL_FORM_DATA.stepsReached ||
                formData.takenSupplements !== INITIAL_FORM_DATA.takenSupplements
            ) {
                localStorage.setItem(storageKey, JSON.stringify(formData));
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch (e) {
            console.error('[CheckIn] Kunne ikke lagre utkast:', e);
        }
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
        console.log('[CheckIn] Starter opplasting av', files.length, 'bilder');
        try {
            const uploadPromises = files.map(async (file) => {
                console.log('[CheckIn] Leser fil:', file.name, 'størrelse:', file.size);
                const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Kunne ikke lese fil: ' + file.name));
                    reader.readAsDataURL(file);
                });
                console.log('[CheckIn] Base64-lengde:', base64Image.length);

                const result = await api.uploadImage(base64Image, uploadUserId, 'checkin');
                if (result.authError) {
                    throw new Error('Autentisering feilet');
                }
                console.log('[CheckIn] Opplasting fullført:', result.data.url);
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
            console.log(`[CheckIn] ${uploadedUrls.length}/${results.length} bilder lastet opp`);
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
            setTimeout(() => {
                setStep('form');
                setFormData(INITIAL_FORM_DATA);
            }, 2500);
        } catch (error) {
            console.error('Checkin-innsending feilet:', error);
            setErrorMessage('Kunne ikke sende rapporten. Prøv igjen.');
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, onNewCheckin]);

    const sortedCheckins = checkins;

    const lastWeight = useMemo(() => {
        const last = sortedCheckins.find(c => c.weight && parseFloat(c.weight) > 0);
        return last ? parseFloat(last.weight) : null;
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

    if (step === 'success') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] animate-scale-in text-center px-6">
                <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6">
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
                        <Card className="p-4 border-emerald-200 bg-emerald-50">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium text-emerald-900">Utkast gjenopprettet</p>
                                    <p className="text-sm text-emerald-800/80 mt-1">Du kan fortsette der du slapp og sende rapporten når du er klar.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={dismissDraftNotice}
                                    className="text-emerald-700/70 hover:text-emerald-900 transition-colors"
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
                                    className={`w-full pl-12 pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent focus:border-accent font-medium text-lg placeholder-ink-faint ${weightFieldError ? 'border-red-300' : 'border-surface-200'}`}
                                    placeholder="f.eks. 83.5"
                                />
                            </div>
                            {weightFieldError ? (
                                <p id="weight-error" className="text-red-600 text-xs mt-1.5">{weightFieldError}</p>
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
                            <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all ${formData.stepsReached ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-50 border-surface-200'}`}>
                                <input type="checkbox" checked={formData.stepsReached} onChange={handleStepsChange} className="sr-only" />
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${formData.stepsReached ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-200'}`}>
                                    <Check size={14} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="font-medium">Skrittmål oppnådd</p>
                                    <p className="text-sm text-ink-muted">{stepGoal?.toLocaleString() || '10 000'} skritt</p>
                                </div>
                            </label>
                            <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all ${formData.takenSupplements ? 'bg-emerald-50 border-emerald-200' : 'bg-surface-50 border-surface-200'}`}>
                                <input type="checkbox" checked={formData.takenSupplements} onChange={handleSupplementsChange} className="sr-only" />
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${formData.takenSupplements ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-200'}`}>
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
                        <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
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
                    <div className="text-center py-12">
                        <div className="w-14 h-14 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted mx-auto mb-4">
                            <Activity size={24} />
                        </div>
                        <p className="text-ink-muted font-display text-[1.35rem] italic mb-1">Ingen rapporter enda</p>
                        <p className="text-ink-faint text-sm">Fyll ut skjemaet over for å sende din første ukesrapport</p>
                    </div>
                ) : (
                    <div className="space-y-3">
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

                            return (
                                <Card key={entry.id} className="p-5 group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-medium">{formatDateNO(entry.date)}</p>
                                            <p className="text-xs text-ink-muted">{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canDelete && onDelete && (
                                                <button
                                                    onClick={async () => { if(await confirmDialog('Slett denne rapporten?', { title: 'Slett rapport', confirmText: 'Slett', destructive: true })) onDelete(entry.id); }}
                                                    aria-label="Slett rapport"
                                                    className="p-2 text-ink-faint hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            <Badge className="tabular-nums">{formatWeight(entry.weight)} kg</Badge>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-5 gap-1.5 text-xs mb-4">
                                        <div className={`py-2 rounded-lg text-center ${parseInt(entry.accuracy) >= 8 ? 'bg-emerald-50' : parseInt(entry.accuracy) >= 5 ? 'bg-amber-50' : 'bg-red-50'}`}>
                                            <p className={`font-semibold tabular-nums ${parseInt(entry.accuracy) >= 8 ? 'text-emerald-700' : parseInt(entry.accuracy) >= 5 ? 'text-amber-700' : 'text-red-700'}`}>{entry.accuracy}</p>
                                            <p className="text-[9px] text-ink-faint mt-0.5">Nøyakt.</p>
                                        </div>
                                        <div className={`py-2 rounded-lg text-center ${parseInt(entry.energy) >= 8 ? 'bg-emerald-50' : parseInt(entry.energy) >= 5 ? 'bg-amber-50' : 'bg-red-50'}`}>
                                            <p className={`font-semibold tabular-nums ${parseInt(entry.energy) >= 8 ? 'text-emerald-700' : parseInt(entry.energy) >= 5 ? 'text-amber-700' : 'text-red-700'}`}>{entry.energy}</p>
                                            <p className="text-[9px] text-ink-faint mt-0.5">Energi</p>
                                        </div>
                                        <div className={`py-2 rounded-lg text-center ${parseInt(entry.sleep) >= 8 ? 'bg-emerald-50' : parseInt(entry.sleep) >= 5 ? 'bg-amber-50' : 'bg-red-50'}`}>
                                            <p className={`font-semibold tabular-nums ${parseInt(entry.sleep) >= 8 ? 'text-emerald-700' : parseInt(entry.sleep) >= 5 ? 'text-amber-700' : 'text-red-700'}`}>{entry.sleep}</p>
                                            <p className="text-[9px] text-ink-faint mt-0.5">Søvn</p>
                                        </div>
                                        <div className="py-2 rounded-lg text-center bg-surface-50">
                                            <p className="font-semibold tabular-nums text-ink">{entry.strengthSessions || 0}</p>
                                            <p className="text-[9px] text-ink-faint mt-0.5">Styrke</p>
                                        </div>
                                        <div className="py-2 rounded-lg text-center bg-surface-50">
                                            <p className="font-semibold tabular-nums text-ink">{entry.cardioSessions || 0}</p>
                                            <p className="text-[9px] text-ink-faint mt-0.5">Cardio</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mb-4">
                                        <Badge variant={entry.stepsReached ? 'success' : 'muted'}>
                                            <Footprints size={12} />
                                            {entry.stepsReached ? 'Skrittmål' : 'Under mål'}
                                        </Badge>
                                        <Badge variant={entry.takenSupplements ? 'success' : 'muted'}>
                                            {entry.takenSupplements ? <Check size={12} /> : <X size={12} />}
                                            Tilskudd
                                        </Badge>
                                    </div>

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
