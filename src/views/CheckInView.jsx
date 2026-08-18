import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Check, Camera, X, Trash2, Loader2, Scale,
  Activity, AlertCircle, Save, Pencil, ChevronDown, Plus
} from 'lucide-react';
import { Card, Badge, Button, EmptyState, IconButton, InputLabel, SegmentedControl, SessionStepper } from '../components/ui';
import ReportMetrics from '../components/ReportMetrics';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { formatDateNO, formatWeight, formatWeightDelta, getThumbnail } from '../lib/formatters';
import { OPTIONS_1_TO_10, INITIAL_FORM_DATA } from '../lib/config';
import { haptic } from '../lib/haptic';

const ImageModal = React.lazy(() => import('../components/ImageModal'));

const REPORT_BATCH_SIZE = 20;

const getMonday = (value = new Date()) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date;
};

const parseEntryDate = (entry) => {
    if (!entry) return null;
    if (entry.timestamp) {
        const fromTimestamp = new Date(entry.timestamp);
        if (!Number.isNaN(fromTimestamp.getTime())) return fromTimestamp;
    }
    if (entry.date) {
        const raw = String(entry.date);
        const fromDate = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
        if (!Number.isNaN(fromDate.getTime())) return fromDate;
    }
    return null;
};

const isSameWeek = (a, b = new Date()) => {
    const left = getMonday(a);
    const right = getMonday(b);
    return Boolean(left && right && left.getTime() === right.getTime());
};

const formatWeekRange = (fromDate = new Date()) => {
    const start = getMonday(fromDate);
    if (!start) return '';
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startLabel = start.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
    const endLabel = end.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
    return `${startLabel} – ${endLabel}`;
};

const getPlanWeek = (startDate, totalWeeks = 12) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return null;
    const days = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 1;
    return Math.min(Math.floor(days / 7) + 1, totalWeeks || 12);
};

const getEntryImages = (entry) => {
    let imageArray = [];
    if (entry?.images) {
        if (typeof entry.images === 'string') {
            try {
                imageArray = JSON.parse(entry.images);
            } catch (e) {
                imageArray = [];
            }
        } else if (Array.isArray(entry.images)) {
            imageArray = entry.images;
        }
    } else if (entry?.image) {
        imageArray = [entry.image];
    }
    return imageArray.filter(img => img && typeof img === 'string' && img.trim() !== '');
};

const WeightDelta = ({ current, previous, className = '' }) => {
    const delta = formatWeightDelta(current, previous);
    if (!delta) return null;
    const toneClass = delta.tone === 'neutral' ? 'text-ink-muted' : 'text-ink';
    return <span className={`tabular-nums ${toneClass} ${className}`}>{delta.text}</span>;
};

const CheckinFields = ({
    values,
    onField,
    lastWeight,
    stepGoal,
    weightError,
    weightInputRef,
    showImages = true,
    images = [],
    onPickImages,
    onRemoveImage,
    isUploading = false,
    onOpenImage
}) => (
    <div className="space-y-5">
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
                    aria-invalid={!!weightError}
                    aria-describedby={weightError ? 'weight-error' : undefined}
                    value={values.weight}
                    onChange={(event) => onField('weight', event.target.value)}
                    className={`w-full pl-12 pr-4 py-3.5 bg-surface-50 border rounded-xl outline-none focus:ring-2 focus:ring-accent focus:border-accent font-medium text-lg placeholder-ink-faint ${weightError ? 'border-error/40' : 'border-surface-200'}`}
                    placeholder="f.eks. 83.5"
                />
            </div>
            {weightError ? (
                <p id="weight-error" className="text-error text-xs mt-1.5">{weightError}</p>
            ) : lastWeight != null && (
                <p className="text-xs text-ink-muted mt-1.5">
                    Forrige: {formatWeight(lastWeight)} kg
                    {values.weight && (
                        <>
                            {' · '}
                            <WeightDelta current={values.weight} previous={lastWeight} />
                        </>
                    )}
                </p>
            )}
        </div>

        <SegmentedControl
            label="Energi"
            value={values.energy}
            onChange={(value) => onField('energy', value)}
            options={OPTIONS_1_TO_10}
        />
        <SegmentedControl
            label="Søvn"
            value={values.sleep}
            onChange={(value) => onField('sleep', value)}
            options={OPTIONS_1_TO_10}
        />
        <SegmentedControl
            label="Nøyaktighet"
            hint="Hvor godt fulgte du mat- og treningsplanen denne uken?"
            value={values.accuracy}
            onChange={(value) => onField('accuracy', value)}
            options={OPTIONS_1_TO_10}
        />

        <div className="grid grid-cols-2 gap-4">
            <SessionStepper
                label="Styrkeøkter"
                value={values.strengthSessions}
                onChange={(value) => onField('strengthSessions', value)}
            />
            <SessionStepper
                label="Cardio"
                value={values.cardioSessions}
                onChange={(value) => onField('cardioSessions', value)}
            />
        </div>

        <div className="space-y-3">
            <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-colors ${values.stepsReached ? 'bg-accent/10 border-accent/20' : 'bg-surface-50 border-surface-200'}`}>
                <input type="checkbox" checked={values.stepsReached} onChange={(event) => { haptic('toggle'); onField('stepsReached', event.target.checked); }} className="sr-only" />
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${values.stepsReached ? 'bg-accent text-white border-2 border-accent' : 'border-2 border-surface-300 bg-white text-transparent'}`}>
                    <Check size={14} strokeWidth={2.5} />
                </div>
                <div>
                    <p className="font-medium">Skrittmål oppnådd</p>
                    <p className="text-sm text-ink-muted">{(stepGoal || 10000).toLocaleString('nb-NO')} skritt</p>
                </div>
            </label>
            <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-colors ${values.takenSupplements ? 'bg-accent/10 border-accent/20' : 'bg-surface-50 border-surface-200'}`}>
                <input type="checkbox" checked={values.takenSupplements} onChange={(event) => { haptic('toggle'); onField('takenSupplements', event.target.checked); }} className="sr-only" />
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${values.takenSupplements ? 'bg-accent text-white border-2 border-accent' : 'border-2 border-surface-300 bg-white text-transparent'}`}>
                    <Check size={14} strokeWidth={2.5} />
                </div>
                <div>
                    <p className="font-medium">Kosttilskudd tatt</p>
                    <p className="text-sm text-ink-muted">Tatt jevnlig denne uken</p>
                </div>
            </label>
        </div>

        <div>
            <InputLabel>Kommentar, valgfritt</InputLabel>
            <textarea
                value={values.comment}
                onChange={(event) => onField('comment', event.target.value)}
                maxLength={5000}
                className="w-full px-4 py-3.5 bg-surface-50 border border-surface-200 rounded-xl h-28 outline-none resize-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Hvordan har uken vært?"
            />
        </div>

        {showImages && (
            <div>
                <InputLabel>Bilder, valgfritt</InputLabel>
                {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {images.map((img, idx) => (
                            <div key={`${img}-${idx}`} className="relative aspect-square">
                                <img
                                    src={getThumbnail(img)}
                                    className="w-full h-full object-cover rounded-lg cursor-pointer"
                                    alt={`Forhåndsvisning ${idx + 1}`}
                                    onClick={() => onOpenImage?.(images, idx)}
                                />
                                <button
                                    type="button"
                                    onClick={() => onRemoveImage(idx)}
                                    aria-label="Fjern bilde"
                                    className="absolute -top-1.5 -right-1.5 bg-ink text-white p-1.5 rounded-full"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <label className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-surface-200 px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:border-surface-300 hover:bg-surface-50 ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                    {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                    {isUploading ? 'Laster opp…' : 'Legg til bilde'}
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={onPickImages} />
                </label>
            </div>
        )}
    </div>
);

const CheckInView = React.memo(({
    checkins = [],
    onNewCheckin,
    onDelete,
    onUpdate,
    canEdit = false,
    isReadOnly,
    canDelete = !isReadOnly,
    stepGoal,
    hideForm = false,
    draftKey = 'default',
    uploadUserId,
    startDate,
    totalWeeks
}) => {
    const toast = useToast();
    const [composing, setComposing] = useState(false);
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
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const weightInputRef = React.useRef(null);
    const confirmDialog = useConfirm();
    const storageKey = `jnm_checkin_draft_${draftKey}`;

    const sortedCheckins = Array.isArray(checkins) ? checkins : [];
    const thisWeekReport = useMemo(
        () => sortedCheckins.find(entry => isSameWeek(parseEntryDate(entry))) || null,
        [sortedCheckins]
    );
    const featuredReport = thisWeekReport || ((isReadOnly || hideForm) ? sortedCheckins[0] || null : null);
    const olderReports = useMemo(
        () => featuredReport ? sortedCheckins.filter(entry => entry.id !== featuredReport.id) : sortedCheckins,
        [sortedCheckins, featuredReport]
    );
    const showForm = !isReadOnly && !hideForm && (composing || !thisWeekReport);
    const planWeek = getPlanWeek(startDate, totalWeeks);
    const weekRange = formatWeekRange(featuredReport ? parseEntryDate(featuredReport) : new Date());
    const hasDraftContent = Boolean(
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
    );

    useEffect(() => {
        if (isReadOnly || hideForm) return;
        try {
            const savedDraft = localStorage.getItem(storageKey);
            if (savedDraft) {
                const parsedDraft = JSON.parse(savedDraft);
                setFormData(prev => ({ ...prev, ...parsedDraft }));
                setRestoredDraft(true);
                if (thisWeekReport) setComposing(true);
            }
        } catch (e) {
            console.error('[CheckIn] Kunne ikke laste utkast:', e);
        }
    }, [storageKey, isReadOnly, hideForm]);

    useEffect(() => {
        if (isReadOnly || hideForm || !showForm) return;

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
    }, [formData, hasDraftContent, storageKey, isReadOnly, hideForm, showForm]);

    const closeLightbox = useCallback(() => {
        setLightbox(prev => ({ ...prev, isOpen: false }));
    }, []);

    const openLightbox = useCallback((images, index) => {
        setLightbox({ isOpen: true, images, index });
    }, []);

    const handleImageUpload = useCallback(async (e) => {
        const files = Array.from(e.target.files);
        e.target.value = '';
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

    const lastWeight = useMemo(() => {
        const last = sortedCheckins.find(c => c.weight && parseFloat(c.weight) > 0);
        return last ? parseFloat(last.weight) : null;
    }, [sortedCheckins]);

    const previousWeightFor = useCallback((entry) => {
        const index = sortedCheckins.findIndex(item => item.id === entry.id);
        const older = sortedCheckins.slice(index + 1).find(item => item.weight && parseFloat(item.weight) > 0);
        return older ? parseFloat(older.weight) : null;
    }, [sortedCheckins]);

    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'weight') setWeightFieldError('');
    }, []);

    const dismissDraftNotice = useCallback(() => setRestoredDraft(false), []);

    const startCompose = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setRestoredDraft(false);
        setErrorMessage('');
        setWeightFieldError('');
        setComposing(true);
    }, []);

    const cancelCompose = useCallback(() => {
        setComposing(false);
        setFormData(INITIAL_FORM_DATA);
        setRestoredDraft(false);
        try { localStorage.removeItem(storageKey); } catch (e) {}
    }, [storageKey]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const weightNum = parseFloat(formData.weight);
        if (!formData.weight || isNaN(weightNum) || weightNum < 20 || weightNum > 500) {
            setWeightFieldError('Skriv inn en gyldig vekt mellom 20 og 500 kg.');
            weightInputRef.current?.focus();
            return;
        }
        setWeightFieldError('');
        haptic('save');
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
            setComposing(false);
            setFormData(INITIAL_FORM_DATA);
            toast('Rapport sendt');
        } catch (error) {
            console.error('Checkin-innsending feilet:', error);
            setErrorMessage('Kunne ikke sende rapporten. Prøv igjen.');
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, onNewCheckin, storageKey, toast]);

    const [visibleReportCount, setVisibleReportCount] = useState(REPORT_BATCH_SIZE);
    const visibleCheckins = useMemo(
        () => olderReports.slice(0, visibleReportCount),
        [olderReports, visibleReportCount]
    );
    const hasMoreReports = visibleReportCount < olderReports.length;
    const handleShowMoreReports = useCallback(() => {
        setVisibleReportCount(count => count + REPORT_BATCH_SIZE);
    }, []);

    const startEdit = useCallback((entry) => {
        setEditingId(entry.id);
        setExpandedIds(prev => new Set(prev).add(entry.id));
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
        if (field === 'weight') setEditWeightError('');
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
        haptic('save');
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

    const toggleExpanded = useCallback((id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const renderReportBody = (entry) => {
        const displayImages = getEntryImages(entry);
        return (
            <>
                <ReportMetrics report={entry} className="mb-4" />
                {entry.comment && (
                    <p className="text-sm text-ink-muted bg-surface-50 p-3 rounded-lg mb-4">{entry.comment}</p>
                )}
                {displayImages.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                        {displayImages.map((img, idx) => (
                            <img
                                key={`${entry.id}-${idx}`}
                                src={getThumbnail(img)}
                                loading="lazy"
                                className="w-16 h-16 object-cover rounded-lg cursor-pointer flex-none"
                                alt={`Rapportbilde ${idx + 1}`}
                                onClick={() => openLightbox(displayImages, idx)}
                            />
                        ))}
                    </div>
                )}
            </>
        );
    };

    const renderEditForm = (entry) => (
        <form onSubmit={submitEdit} className="space-y-5">
            <div className="flex items-center justify-between">
                <p className="font-medium">{formatDateNO(entry.date)}</p>
                <span className="text-xs text-ink-muted">Redigerer</span>
            </div>
            <CheckinFields
                values={editForm}
                onField={updateEditField}
                lastWeight={previousWeightFor(entry)}
                stepGoal={stepGoal}
                weightError={editWeightError}
                showImages={false}
            />
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
    );

    return (
        <div className={`space-y-5 animate-slide-up ${showForm ? 'pb-52 lg:pb-24' : 'pb-32 lg:pb-8'}`}>
            {lightbox.isOpen && (
                <React.Suspense fallback={null}>
                    <ImageModal images={lightbox.images} initialIndex={lightbox.index} onClose={closeLightbox} />
                </React.Suspense>
            )}

            <div className="px-1">
                <p className="section-label">{isReadOnly ? 'Siste rapport' : 'Denne uken'}</p>
                <p className="text-sm text-ink-muted mt-1">
                    {planWeek ? `Uke ${planWeek} · ${weekRange}` : weekRange}
                </p>
            </div>

            {featuredReport && !showForm && (
                <Card className="p-5">
                    {editingId === featuredReport.id && editForm ? (
                        renderEditForm(featuredReport)
                    ) : (
                        <>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="font-medium">{formatDateNO(featuredReport.date)}</p>
                                    <p className="text-xs text-ink-muted">
                                        {thisWeekReport ? 'Sendt denne uken' : 'Siste innsending'}
                                        {previousWeightFor(featuredReport) != null && (
                                            <>
                                                {' · '}
                                                <WeightDelta current={featuredReport.weight} previous={previousWeightFor(featuredReport)} />
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canEdit && onUpdate && (
                                        <IconButton type="button" onClick={() => startEdit(featuredReport)} aria-label="Rediger rapport" tone="accent">
                                            <Pencil size={16} />
                                        </IconButton>
                                    )}
                                    {canDelete && onDelete && (
                                        <IconButton
                                            type="button"
                                            onClick={async () => {
                                                if (await confirmDialog('Slett denne rapporten?', { title: 'Slett rapport', confirmText: 'Slett', destructive: true })) {
                                                    onDelete(featuredReport.id);
                                                }
                                            }}
                                            aria-label="Slett rapport"
                                            tone="danger"
                                        >
                                            <Trash2 size={16} />
                                        </IconButton>
                                    )}
                                    <Badge className="tabular-nums">{formatWeight(featuredReport.weight)} kg</Badge>
                                </div>
                            </div>
                            {renderReportBody(featuredReport)}
                            {!isReadOnly && !hideForm && thisWeekReport && (
                                <Button variant="secondary" size="sm" className="mt-5" onClick={startCompose}>
                                    <Plus size={16} /> Send ny rapport
                                </Button>
                            )}
                        </>
                    )}
                </Card>
            )}

            {showForm && (
                <form id="weekly-checkin-form" onSubmit={handleSubmit} className="space-y-5">
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
                                <h3 className="section-title">{thisWeekReport ? 'Ny rapport' : 'Ukesrapport'}</h3>
                                <p className="text-sm text-ink-muted mt-1">
                                    {thisWeekReport ? 'Denne sendes i tillegg til rapporten som allerede er inne.' : 'Fyll ut status for uken. Du kan redigere etterpå.'}
                                </p>
                            </div>
                            {hasDraftContent && (
                                <span className="shrink-0 text-[11px] font-medium text-ink-muted bg-surface-100 px-2 py-1 rounded-full">
                                    Utkast lagret
                                </span>
                            )}
                        </div>
                        <CheckinFields
                            values={formData}
                            onField={updateField}
                            lastWeight={lastWeight}
                            stepGoal={stepGoal}
                            weightError={weightFieldError}
                            weightInputRef={weightInputRef}
                            images={formData.images}
                            onPickImages={handleImageUpload}
                            onRemoveImage={removeImage}
                            isUploading={isCompressing}
                            onOpenImage={openLightbox}
                        />
                    </Card>

                    {errorMessage && (
                        <div className="flex items-center gap-3 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
                            <AlertCircle size={18} />
                            {errorMessage}
                        </div>
                    )}

                    {thisWeekReport && (
                        <Button type="button" variant="ghost" className="w-full lg:hidden" onClick={cancelCompose}>
                            Avbryt
                        </Button>
                    )}
                </form>
            )}

            {showForm && (
                <div
                    className="plan-save-bar fixed inset-x-0 z-40 border-t border-surface-200/80 bg-surface-50/94 backdrop-blur-xl"
                    style={{ bottom: 'calc(4.35rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <div className="header-inner mx-auto flex items-center gap-2 px-4 py-2.5 lg:px-8">
                        {thisWeekReport ? (
                            <Button type="button" variant="ghost" onClick={cancelCompose} disabled={isSubmitting} className="hidden lg:inline-flex">
                                Avbryt
                            </Button>
                        ) : (
                            <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">Klar når vekten er fylt ut</p>
                        )}
                        <Button
                            type="submit"
                            form="weekly-checkin-form"
                            className="flex-1 lg:flex-none"
                            disabled={isSubmitting || isCompressing}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {isSubmitting ? 'Sender…' : 'Send rapport'}
                        </Button>
                    </div>
                </div>
            )}

            <div className={showForm || thisWeekReport ? 'pt-4 border-t border-surface-200' : ''}>
                <div className="mb-4 px-1">
                    <p className="section-label">Tidligere rapporter</p>
                    <p className="text-sm text-ink-muted mt-1">
                        {olderReports.length === 0
                            ? (thisWeekReport ? 'Ingen eldre innsendinger' : 'Ingen tidligere innsendinger ennå')
                            : `${olderReports.length} rapport${olderReports.length > 1 ? 'er' : ''}`}
                    </p>
                </div>

                {olderReports.length === 0 ? (
                    !thisWeekReport && (
                        <EmptyState
                            icon={Activity}
                            title="Ingen rapporter enda"
                            description={isReadOnly ? 'Når utøveren sender en rapport, vises den her.' : 'Send ukesrapporten over for å starte historikken.'}
                        />
                    )
                ) : (
                    <div className="space-y-2">
                        {visibleCheckins.map((entry) => {
                            const isEditing = editingId === entry.id;
                            const isExpanded = expandedIds.has(entry.id) || isEditing;
                            const previousWeight = previousWeightFor(entry);

                            if (isEditing && editForm) {
                                return (
                                    <Card key={entry.id} className="p-5">
                                        {renderEditForm(entry)}
                                    </Card>
                                );
                            }

                            return (
                                <Card key={entry.id} className="overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-3">
                                        <button
                                            type="button"
                                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                            onClick={() => toggleExpanded(entry.id)}
                                            aria-expanded={isExpanded}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium truncate">{formatDateNO(entry.date)}</p>
                                                <p className="text-xs text-ink-muted tabular-nums">
                                                    {formatWeight(entry.weight)} kg
                                                    {previousWeight != null && (
                                                        <>
                                                            {' · '}
                                                            <WeightDelta current={entry.weight} previous={previousWeight} />
                                                        </>
                                                    )}
                                                    {' · '}energi {entry.energy ?? '–'}
                                                    {' · '}søvn {entry.sleep ?? '–'}
                                                </p>
                                            </div>
                                            <ChevronDown size={18} className={`shrink-0 text-ink-faint transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                        {canEdit && onUpdate && (
                                            <IconButton type="button" onClick={() => startEdit(entry)} aria-label="Rediger rapport" tone="accent">
                                                <Pencil size={16} />
                                            </IconButton>
                                        )}
                                        {canDelete && onDelete && (
                                            <IconButton
                                                type="button"
                                                onClick={async () => {
                                                    if (await confirmDialog('Slett denne rapporten?', { title: 'Slett rapport', confirmText: 'Slett', destructive: true })) {
                                                        onDelete(entry.id);
                                                    }
                                                }}
                                                aria-label="Slett rapport"
                                                tone="danger"
                                            >
                                                <Trash2 size={16} />
                                            </IconButton>
                                        )}
                                    </div>
                                    {isExpanded && (
                                        <div className="border-t border-surface-100 px-4 py-4">
                                            {renderReportBody(entry)}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                        {hasMoreReports && (
                            <Button variant="secondary" size="md" className="w-full" onClick={handleShowMoreReports}>
                                Vis flere rapporter ({Math.min(REPORT_BATCH_SIZE, olderReports.length - visibleReportCount)})
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default CheckInView;
