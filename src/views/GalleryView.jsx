import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Camera, X, Loader2, Plus, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Card, Button, EmptyState, IconButton, TextField, ToggleGroup } from '../components/ui';
import ImageModal from '../components/ImageModal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useEscapeKey, useFocusTrap } from '../hooks';
import { api } from '../lib/api';
import { formatDateNO, formatWeight, getThumbnail, getFullSizeImage } from '../lib/formatters';
import { IMAGE_ZOOM_PROPS } from '../lib/zoomConfig';

const IMAGE_BATCH_SIZE = 60;
const TRANSFORM_WRAPPER_STYLE = { width: "100%", height: "100%" };
const TRANSFORM_CONTENT_STYLE = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" };

const getImageKey = (img, fallbackIndex) => {
    if (img.isGalleryImage) return `gallery-${img.galleryImageId}`;
    return `checkin-${img.checkinId}-${fallbackIndex}`;
};

const CompareZoomImage = React.memo(({ image, label }) => (
    <TransformWrapper
        key={image.url}
        {...IMAGE_ZOOM_PROPS}
    >
        <TransformComponent
            wrapperClass="compare-zoom-wrapper"
            contentClass="compare-zoom-content"
            wrapperStyle={TRANSFORM_WRAPPER_STYLE}
            contentStyle={TRANSFORM_CONTENT_STYLE}
        >
            <img
                src={getFullSizeImage(image.url)}
                onError={(event) => {
                    if (event.currentTarget.src !== image.url) {
                        event.currentTarget.src = image.url;
                    }
                }}
                className="block h-full w-full object-contain select-none shadow-[0_24px_90px_rgba(0,0,0,0.30)]"
                alt={label}
                draggable={false}
            />
        </TransformComponent>
    </TransformWrapper>
));

// GalleryView - samler alle bilder fra checkins for lett sammenligning
const GalleryView = React.memo(({ checkins, galleryImages = [], isCoach = false, uploadUserId, onAddGalleryImage, onDeleteGalleryImage }) => {
    const toast = useToast();
    const confirmDialog = useConfirm();
    const [lightbox, setLightbox] = useState({ isOpen: false, images: [], index: 0 });
    const [viewMode, setViewMode] = useState('grid'); // 'grid', 'timeline', eller 'compare'
    const [compareImages, setCompareImages] = useState({ before: null, after: null });
    const [selectingFor, setSelectingFor] = useState(null); // 'before' eller 'after'
    const [fullscreenCompare, setFullscreenCompare] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ label: 'Startbilde', date: new Date().toISOString().split('T')[0], weight: '' });
    const [visibleImageCount, setVisibleImageCount] = useState(IMAGE_BATCH_SIZE);
    const tilePointerRef = React.useRef(null);

    // Samle alle bilder med metadata, sortert fra nyeste til eldste
    const allImages = useMemo(() => {
        const images = [];
        
        // Hjelpefunksjon for å parse dato trygt
        const parseDate = (dateValue) => {
            if (!dateValue) return null;
            // Hvis det allerede er et tall (timestamp)
            if (typeof dateValue === 'number') return dateValue;
            // Hvis det er en Date
            if (dateValue instanceof Date) return dateValue.getTime();
            // Hvis det er en streng
            if (typeof dateValue === 'string') {
                // Prøv å parse direkte
                const parsed = new Date(dateValue);
                if (!isNaN(parsed.getTime())) return parsed.getTime();
            }
            return null;
        };
        
        // Legg til gallery-bilder (coach-opplastet)
        galleryImages.forEach(img => {
            // Bruk date-feltet for sortering
            const dateTimestamp = parseDate(img.date);
            const sortDate = dateTimestamp || img.timestamp;
            
            images.push({
                url: img.url,
                date: img.date,
                timestamp: img.timestamp,
                sortDate: sortDate,
                weight: img.weight || null,
                label: img.label,
                isGalleryImage: true,
                galleryImageId: img.id
            });
        });
        
        // Legg til checkin-bilder - bruk timestamp direkte
        checkins.forEach(checkin => {
            // Sikre at images alltid er en array
            let imageArray = [];
            if (checkin.images) {
                // Hvis det er en streng, prøv å parse den
                if (typeof checkin.images === 'string') {
                    try {
                        imageArray = JSON.parse(checkin.images);
                    } catch (e) {
                        console.error('[allImages] Kunne ikke parse images:', checkin.images);
                        imageArray = [];
                    }
                } else if (Array.isArray(checkin.images)) {
                    imageArray = checkin.images;
                }
            } else if (checkin.image) {
                imageArray = [checkin.image];
            }

            // Filtrer ut ugyldige verdier og legg til i images array
            const checkinImages = imageArray.filter(img => img && typeof img === 'string' && img.trim() !== '');

            checkinImages.forEach(img => {
                images.push({
                    url: img,
                    date: checkin.date,
                    timestamp: checkin.timestamp,
                    sortDate: checkin.timestamp,
                    weight: checkin.weight,
                    checkinId: checkin.id,
                    isGalleryImage: false
                });
            });
        });
        
        // Sorter alle bilder etter sortDate, nyeste først, og legg ved global index for senere oppslag
        return images
            .sort((a, b) => b.sortDate - a.sortDate)
            .map((img, index) => ({ ...img, globalIndex: index }));
    }, [checkins, galleryImages]);

    // Grupper bilder etter måned for timeline-visning
    const imagesByMonth = useMemo(() => {
        const grouped = {};
        allImages.forEach(img => {
            const date = new Date(img.sortDate);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = date.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' });

            if (!grouped[monthKey]) {
                grouped[monthKey] = { label: monthLabel, images: [] };
            }
            grouped[monthKey].images.push(img);
        });
        return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
    }, [allImages]);

    useEffect(() => {
        setVisibleImageCount(IMAGE_BATCH_SIZE);
    }, [allImages.length, viewMode]);

    const visibleImages = useMemo(
        () => allImages.slice(0, visibleImageCount),
        [allImages, visibleImageCount]
    );

    const visibleImagesByMonth = useMemo(() => {
        const visibleIndexes = new Set(visibleImages.map(img => img.globalIndex));
        return imagesByMonth
            .map(([monthKey, group]) => [
                monthKey,
                { ...group, images: group.images.filter(img => visibleIndexes.has(img.globalIndex)) }
            ])
            .filter(([, group]) => group.images.length > 0);
    }, [imagesByMonth, visibleImages]);

    const hasMoreImages = visibleImageCount < allImages.length;
    const handleShowMoreImages = useCallback(() => {
        setVisibleImageCount(count => Math.min(count + IMAGE_BATCH_SIZE, allImages.length));
    }, [allImages.length]);

    const closeLightbox = useCallback(() => {
        setLightbox(prev => ({ ...prev, isOpen: false }));
    }, []);

    const openLightbox = useCallback((index) => {
        if (selectingFor) return; // Ikke åpne lightbox når vi velger bilder
        setLightbox({ isOpen: true, images: allImages.map(img => img.url), index });
    }, [allImages, selectingFor]);

    const handleImageClick = useCallback((img, idx) => {
        if (selectingFor) {
            setCompareImages(prev => ({ ...prev, [selectingFor]: img }));
            setSelectingFor(null);
        } else {
            openLightbox(idx);
        }
    }, [selectingFor, openLightbox]);

    const handleCompareImageClick = useCallback((img) => {
        setCompareImages(prev => {
            const target = selectingFor || (!prev.before ? 'before' : !prev.after ? 'after' : 'after');
            return { ...prev, [target]: img };
        });
        setSelectingFor(null);
    }, [selectingFor]);

    const handleTilePointerDown = useCallback((e, img, idx) => {
        tilePointerRef.current = {
            x: e.clientX,
            y: e.clientY,
            img,
            idx
        };
    }, []);

    const handleTilePointerUp = useCallback((e) => {
        const start = tilePointerRef.current;
        tilePointerRef.current = null;
        if (!start) return;
        const deltaX = Math.abs(e.clientX - start.x);
        const deltaY = Math.abs(e.clientY - start.y);
        if (deltaX > 12 || deltaY > 12) return;
        handleImageClick(start.img, start.idx);
    }, [handleImageClick]);

    const handleTileKeyDown = useCallback((e, img, idx) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        handleImageClick(img, idx);
    }, [handleImageClick]);

    const startCompare = useCallback(() => {
        // Auto-velg eldste og nyeste bilde som standard
        if (allImages.length >= 2) {
            const oldest = allImages[allImages.length - 1];
            const newest = allImages[0];
            setCompareImages({ before: oldest, after: newest });
        }
        setViewMode('compare');
    }, [allImages]);

    const clearCompare = useCallback(() => {
        setCompareImages({ before: null, after: null });
        setSelectingFor(null);
        setViewMode('grid');
    }, []);

    // Håndter bildeopplasting for coach
    const [uploadProgress, setUploadProgress] = useState('');

    const handleImageUpload = useCallback(async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        if (!uploadUserId) {
            toast('Mangler bruker for opplasting', 'error');
            return;
        }
        if (files.length > 5) {
            toast('Maks 5 bilder om gangen', 'error');
            return;
        }
        setIsUploading(true);
        try {
            setUploadProgress(`${files.length} bilde${files.length > 1 ? 'r' : ''}...`);
            const uploadedUrls = await Promise.all(
                files.map(async (file) => {
                    const base64Image = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error('Kunne ikke lese fil: ' + file.name));
                        reader.readAsDataURL(file);
                    });
                    const result = await api.uploadImage(base64Image, uploadUserId, 'gallery');
                    if (result.authError) throw new Error('Autentisering feilet');
                    return result.data.url;
                })
            );
            // Lukk modal umiddelbart — optimistisk UI i onAddGalleryImage viser bildene
            const { label, date, weight } = uploadForm;
            setShowUploadModal(false);
            setUploadForm({ label: 'Startbilde', date: new Date().toISOString().split('T')[0], weight: '' });
            setIsUploading(false);
            setUploadProgress('');
            toast(`${uploadedUrls.length} bilde${uploadedUrls.length > 1 ? 'r' : ''} lagt til`);
            // Lagre til server i bakgrunnen (optimistisk UI allerede vist)
            const results = await Promise.allSettled(
                uploadedUrls.map(url => onAddGalleryImage(url, label, date, weight))
            );
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.error('Noen bilder kunne ikke lagres:', failed);
                toast(`${failed.length} av ${uploadedUrls.length} bilder kunne ikke lagres`, 'error');
            }
        } catch (err) {
            console.error(err);
            toast('Bildeopplasting feilet', 'error');
        } finally {
            setIsUploading(false);
            setUploadProgress('');
        }
    }, [onAddGalleryImage, uploadForm, uploadUserId, toast]);

    const handleDeleteGalleryImage = useCallback(async (imageId) => {
        if (await confirmDialog('Slett dette bildet fra galleriet?', { title: 'Slett bilde', confirmText: 'Slett', destructive: true })) {
            try {
                await onDeleteGalleryImage(imageId);
            } catch (err) {
                console.error(err);
                toast('Kunne ikke slette bildet', 'error');
            }
        }
    }, [onDeleteGalleryImage, confirmDialog, toast]);

    // Beregn vektendring mellom valgte bilder
    const weightDiff = useMemo(() => {
        if (!compareImages.before?.weight || !compareImages.after?.weight) return null;
        const diff = parseFloat(compareImages.after.weight) - parseFloat(compareImages.before.weight);
        return diff.toFixed(1);
    }, [compareImages]);

    // Beregn dager mellom bildene
    const daysDiff = useMemo(() => {
        if (!compareImages.before?.sortDate || !compareImages.after?.sortDate) return null;
        const diff = Math.abs(compareImages.after.sortDate - compareImages.before.sortDate);
        return Math.round(diff / (1000 * 60 * 60 * 24));
    }, [compareImages]);

    // Memoized input handlers for upload form
    const handleLabelChange = useCallback((e) => {
        setUploadForm(prev => ({ ...prev, label: e.target.value }));
    }, []);

    const handleDateChange = useCallback((e) => {
        setUploadForm(prev => ({ ...prev, date: e.target.value }));
    }, []);

    const handleWeightChange = useCallback((e) => {
        setUploadForm(prev => ({ ...prev, weight: e.target.value }));
    }, []);

    const closeUploadModal = useCallback(() => {
        setShowUploadModal(false);
    }, []);

    useEscapeKey(closeUploadModal, showUploadModal);
    const uploadModalRef = useFocusTrap(showUploadModal);

    // Felles upload-modal (brukes i både tom- og normal-visning)
    const uploadModal = showUploadModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <Card ref={uploadModalRef} className="w-full max-w-sm p-6 animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="upload-images-title">
                <div className="flex justify-between items-center mb-6">
                    <h2 id="upload-images-title" className="section-title text-[1.05rem]">Last opp bilder</h2>
                    <IconButton onClick={closeUploadModal} aria-label="Lukk">
                        <X size={20} />
                    </IconButton>
                </div>

                <div className="space-y-4">
                    <TextField label="Bildetekst" type="text" value={uploadForm.label} onChange={handleLabelChange} placeholder="F.eks. Startbilde" />
                    <TextField label="Dato" type="date" value={uploadForm.date} onChange={handleDateChange} />
                    <TextField label="Vekt (kg, valgfritt)" type="number" inputMode="decimal" step="0.1" value={uploadForm.weight} onChange={handleWeightChange} placeholder="0.0" />

                    <label className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-200 rounded-xl cursor-pointer hover:border-surface-300 hover:bg-surface-50 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isUploading ? (
                            <>
                                <Loader2 className="animate-spin text-ink-muted" size={24} />
                                {uploadProgress && <span className="text-sm text-ink-muted mt-2">Laster opp {uploadProgress}</span>}
                            </>
                        ) : (
                            <>
                                <Camera size={24} className="text-ink-muted mb-2" />
                                <span className="font-medium text-ink-muted">Velg bilder</span>
                                <span className="text-xs text-ink-faint mt-1">Maks 5 bilder (JPG, PNG, HEIC)</span>
                            </>
                        )}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                    </label>
                </div>
            </Card>
        </div>
    );

    if (allImages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
                {uploadModal}
                <EmptyState
                    icon={Camera}
                    title="Ingen bilder enda"
                    description="Bilder fra ukesrapporter vil vises her"
                    action={isCoach && onAddGalleryImage ? (
                        <Button variant="primary" size="md" onClick={() => setShowUploadModal(true)}>
                            <Plus size={18} /> Last opp startbilde
                        </Button>
                    ) : null}
                />
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-32 animate-slide-up">
            {uploadModal}

            {lightbox.isOpen && (
                <ImageModal 
                    images={lightbox.images} 
                    initialIndex={lightbox.index} 
                    onClose={closeLightbox} 
                />
            )}

            {/* Fullskjerm sammenligning */}
            {fullscreenCompare && compareImages.before && compareImages.after && (
                <div className="fixed inset-0 z-[100] bg-[#080807]/96 flex flex-col animate-fade-in overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),transparent_28rem)] pointer-events-none" />
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    {/* Header */}
                    <div className="safe-area-pt relative z-[120]">
                        <div className="flex justify-between items-center p-4">
                            <div className="text-white">
                                <p className="text-sm text-white/60">Sammenligning</p>
                                <p className="font-medium">{daysDiff} dager</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFullscreenCompare(false)}
                                aria-label="Lukk fullskjerm"
                                className="text-white/75 hover:text-white min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/10 hover:bg-white/18 backdrop-blur-md ring-1 ring-white/10 transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Bilder side-by-side med zoom */}
                    <div className="relative z-10 flex-1 flex min-h-0 overflow-hidden">
                        {/* Før */}
                        <div className="flex-1 min-w-0 h-full relative overflow-hidden">
                            <CompareZoomImage image={compareImages.before} label="Før" />
                            <div className="absolute top-4 left-4 bg-white/10 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md ring-1 ring-white/10 pointer-events-none">
                                FØR
                            </div>
                            <div className="absolute bottom-4 left-4 right-4 bg-black/45 backdrop-blur-md rounded-xl p-3 ring-1 ring-white/10 pointer-events-none">
                                <p className="text-white font-medium">{formatDateNO(compareImages.before.date)}</p>
                                {compareImages.before.weight && (
                                    <p className="text-white/70 text-sm">{formatWeight(compareImages.before.weight)} kg</p>
                                )}
                            </div>
                        </div>

                        {/* Skillelinje */}
                        <div className="w-0.5 bg-white/20" />

                        {/* Etter */}
                        <div className="flex-1 min-w-0 h-full relative overflow-hidden">
                            <CompareZoomImage image={compareImages.after} label="Etter" />
                            <div className="absolute top-4 right-4 bg-white/10 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md ring-1 ring-white/10 pointer-events-none">
                                ETTER
                            </div>
                            <div className="absolute bottom-4 left-4 right-4 bg-black/45 backdrop-blur-md rounded-xl p-3 ring-1 ring-white/10 pointer-events-none">
                                <p className="text-white font-medium">{formatDateNO(compareImages.after.date)}</p>
                                {compareImages.after.weight && (
                                    <p className="text-white/70 text-sm">{formatWeight(compareImages.after.weight)} kg</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer med statistikk */}
                    <div className="relative z-[120] p-4 safe-area-pb">
                        <div className="flex items-center justify-center gap-4">
                            {weightDiff && (
                                <div className={`flex items-center gap-2 py-2 px-4 rounded-full backdrop-blur-md ring-1 ring-white/10 ${parseFloat(weightDiff) < 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}`}>
                                    {parseFloat(weightDiff) < 0 ? <TrendingDown size={18} /> : parseFloat(weightDiff) > 0 ? <TrendingUp size={18} /> : <Minus size={18} />}
                                    <span className="font-semibold">
                                        {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff.replace('.', ',')} kg
                                    </span>
                                </div>
                            )}
                            <div className="bg-white/10 text-white/65 py-2 px-4 rounded-full text-sm backdrop-blur-md ring-1 ring-white/10">
                                Knip for å zoome
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header med visningsvalg */}
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[1.55rem] leading-none font-display">
                            {viewMode === 'compare' ? 'Sammenlign' : 'Fremgangsgalleri'}
                        </h2>
                        <p className="text-sm text-ink-muted">
                            {viewMode === 'compare' ? 'Velg bilder å sammenligne' : `${allImages.length} bilder`}
                        </p>
                    </div>
                    {viewMode === 'compare' ? (
                        <Button variant="secondary" size="sm" className="shrink-0" onClick={clearCompare}>
                            <X size={16} /> Lukk
                        </Button>
                    ) : isCoach && onAddGalleryImage ? (
                        <Button variant="primary" size="sm" className="shrink-0" onClick={() => setShowUploadModal(true)}>
                            <Plus size={16} /> Last opp
                        </Button>
                    ) : null}
                </div>
                {viewMode !== 'compare' && (
                    <ToggleGroup
                        value={viewMode}
                        onChange={(value) => value === 'compare' ? startCompare() : setViewMode(value)}
                        options={[
                            { value: 'grid', label: 'Rutenett' },
                            { value: 'timeline', label: 'Tidslinje' },
                            ...(allImages.length >= 2 ? [{ value: 'compare', label: 'Sammenlign' }] : [])
                        ]}
                    />
                )}
            </div>

            {/* Sammenlign-modus */}
            {viewMode === 'compare' && (
                <div className="space-y-4">
                    {/* Sammenligning side-by-side */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Før-bilde */}
                        <div className="space-y-2">
                            <p className="section-label text-center">Før</p>
                            <div 
                                className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectingFor === 'before' ? 'border-ink ring-2 ring-ink/20' : 'border-surface-200'}`}
                                onClick={() => setSelectingFor(selectingFor === 'before' ? null : 'before')}
                            >
                                {compareImages.before ? (
                                    <>
                                        <img 
                                            src={getThumbnail(compareImages.before.url)} 
                                            className="w-full h-full object-cover"
                                            alt="Før"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/80 to-transparent p-3">
                                            <p className="text-white text-sm font-medium">{formatDateNO(compareImages.before.date)}</p>
                                            {compareImages.before.weight && (
                                                <p className="text-white/70 text-xs">{formatWeight(compareImages.before.weight)} kg</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-100">
                                        <Plus size={24} className="text-ink-muted mb-2" />
                                        <p className="text-sm text-ink-muted">Velg bilde</p>
                                    </div>
                                )}
                                {selectingFor === 'before' && (
                                    <div className="absolute inset-0 bg-ink/10 flex items-center justify-center">
                                        <span className="bg-ink text-white px-3 py-1.5 rounded-full text-sm font-medium">
                                            Velger...
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Etter-bilde */}
                        <div className="space-y-2">
                            <p className="section-label text-center">Etter</p>
                            <div 
                                className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectingFor === 'after' ? 'border-ink ring-2 ring-ink/20' : 'border-surface-200'}`}
                                onClick={() => setSelectingFor(selectingFor === 'after' ? null : 'after')}
                            >
                                {compareImages.after ? (
                                    <>
                                        <img 
                                            src={getThumbnail(compareImages.after.url)} 
                                            className="w-full h-full object-cover"
                                            alt="Etter"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/80 to-transparent p-3">
                                            <p className="text-white text-sm font-medium">{formatDateNO(compareImages.after.date)}</p>
                                            {compareImages.after.weight && (
                                                <p className="text-white/70 text-xs">{formatWeight(compareImages.after.weight)} kg</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-100">
                                        <Plus size={24} className="text-ink-muted mb-2" />
                                        <p className="text-sm text-ink-muted">Velg bilde</p>
                                    </div>
                                )}
                                {selectingFor === 'after' && (
                                    <div className="absolute inset-0 bg-ink/10 flex items-center justify-center">
                                        <span className="bg-ink text-white px-3 py-1.5 rounded-full text-sm font-medium">
                                            Velger...
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Statistikk */}
                    {compareImages.before && compareImages.after && (
                        <Card className="p-4">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="section-label mb-1">Tidsperiode</p>
                                    <p className="text-lg font-semibold">{daysDiff} dager</p>
                                </div>
                                {weightDiff && (
                                    <div>
                                        <p className="section-label mb-1">Vektendring</p>
                                        <p className={`text-lg font-semibold flex items-center justify-center gap-1 ${parseFloat(weightDiff) < 0 ? 'text-emerald-600' : parseFloat(weightDiff) > 0 ? 'text-ink' : 'text-ink-muted'}`}>
                                            {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff.replace('.', ',')} kg
                                            {parseFloat(weightDiff) < 0 ? <TrendingDown size={18} /> : parseFloat(weightDiff) > 0 ? <TrendingUp size={18} /> : null}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Fullskjerm-knapp */}
                    {compareImages.before && compareImages.after && (
                        <Button 
                            variant="primary" 
                            size="md" 
                            className="w-full"
                            onClick={() => setFullscreenCompare(true)}
                        >
                            <Eye size={18} /> Se i fullskjerm
                        </Button>
                    )}

                    {/* Instruksjon eller bildevelger */}
                    {selectingFor && (
                        <Card className="p-3 bg-ink text-white">
                            <p className="text-sm text-center">
                                Trykk på et bilde nedenfor for å velge som "{selectingFor === 'before' ? 'før' : 'etter'}"-bilde
                            </p>
                        </Card>
                    )}

                    {/* Bilderutenett for valg */}
                    <div>
                        <p className="section-label mb-3">Velg bilder</p>
                        <div className="grid grid-cols-4 gap-1.5">
                            {visibleImages.map((img, idx) => {
                                const isSelected = compareImages.before?.url === img.url || compareImages.after?.url === img.url;
                                const isBefore = compareImages.before?.url === img.url;
                                return (
                                    <div 
                                        key={getImageKey(img, idx)}
                                        className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-ink' : 'border-transparent'} ${selectingFor ? 'hover:scale-105' : ''}`}
                                        onClick={() => handleCompareImageClick(img)}
                                    >
                                        <img 
                                            src={getThumbnail(img.url)} 
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover"
                                            alt={`Fremgang ${formatDateNO(img.date)}`}
                                        />
                                        {isSelected && (
                                            <div className="absolute top-1 right-1 bg-ink text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                {isBefore ? 'FØR' : 'ETTER'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {hasMoreImages && (
                            <Button variant="secondary" size="md" className="w-full mt-3" onClick={handleShowMoreImages}>
                                Vis flere bilder ({Math.min(IMAGE_BATCH_SIZE, allImages.length - visibleImageCount)})
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'grid' && (
                /* Grid-visning - kompakt oversikt */
                <>
                    <div className="grid grid-cols-3 gap-1.5">
                        {visibleImages.map((img, idx) => (
                            <div 
                                key={getImageKey(img, idx)}
                                className="relative aspect-square cursor-pointer group"
                                role="button"
                                tabIndex={0}
                                data-swipe-ignore="true"
                                onPointerDown={(e) => handleTilePointerDown(e, img, idx)}
                                onPointerUp={handleTilePointerUp}
                                onKeyDown={(e) => handleTileKeyDown(e, img, idx)}
                            >
                                <img 
                                    src={getThumbnail(img.url)} 
                                    loading={idx < 12 ? 'eager' : 'lazy'}
                                    decoding="async"
                                    fetchPriority={idx < 6 ? 'high' : 'auto'}
                                    className="w-full h-full object-cover rounded-lg"
                                    alt={img.label || `Fremgang ${formatDateNO(img.date)}`}
                                />
                                {/* Label badge for gallery-bilder */}
                                {img.isGalleryImage && img.label && (
                                    <div className="absolute top-1.5 left-1.5 bg-ink/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                                        {img.label}
                                    </div>
                                )}
                                {/* Slett-knapp for coach på gallery-bilder - alltid synlig */}
                                {isCoach && img.isGalleryImage && onDeleteGalleryImage && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteGalleryImage(img.galleryImageId); }}
                                        aria-label="Slett bilde"
                                        className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1.5 rounded-full shadow-lg active:scale-95 transition-transform z-10"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                    <div className="absolute bottom-2 left-2 right-2">
                                        <p className="text-white text-xs font-medium">{formatDateNO(img.date)}</p>
                                        {img.weight && (
                                            <p className="text-white/70 text-[10px]">{formatWeight(img.weight)} kg</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {hasMoreImages && (
                        <Button variant="secondary" size="md" className="w-full mt-4" onClick={handleShowMoreImages}>
                            Vis flere bilder ({Math.min(IMAGE_BATCH_SIZE, allImages.length - visibleImageCount)})
                        </Button>
                    )}
                </>
            )}

            {viewMode === 'timeline' && (
                /* Timeline-visning - gruppert etter måned */
                <div className="space-y-6">
                    {visibleImagesByMonth.map(([monthKey, { label, images }]) => (
                        <div key={monthKey}>
                            <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-sm font-medium text-ink-muted capitalize">{label}</h3>
                                <div className="flex-1 h-px bg-surface-200" />
                                <span className="text-xs text-ink-faint">{images.length} bilder</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                                {images.map((img, idx) => {
                                    return (
                                        <div 
                                            key={getImageKey(img, img.globalIndex)}
                                            className="relative aspect-square cursor-pointer group"
                                            role="button"
                                            tabIndex={0}
                                            data-swipe-ignore="true"
                                            onPointerDown={(e) => handleTilePointerDown(e, img, img.globalIndex)}
                                            onPointerUp={handleTilePointerUp}
                                            onKeyDown={(e) => handleTileKeyDown(e, img, img.globalIndex)}
                                        >
                                            <img 
                                                src={getThumbnail(img.url)} 
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover rounded-lg"
                                                alt={img.label || `Fremgang ${formatDateNO(img.date)}`}
                                            />
                                            {/* Label badge for gallery-bilder */}
                                            {img.isGalleryImage && img.label && (
                                                <div className="absolute top-1.5 left-1.5 bg-ink/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                                                    {img.label}
                                                </div>
                                            )}
                                            {/* Slett-knapp for coach på gallery-bilder - alltid synlig */}
                                            {isCoach && img.isGalleryImage && onDeleteGalleryImage && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteGalleryImage(img.galleryImageId); }}
                                                    aria-label="Slett bilde"
                                                    className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1.5 rounded-full shadow-lg active:scale-95 transition-transform z-10"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                                <div className="absolute bottom-2 left-2 right-2">
                                                    <p className="text-white text-xs font-medium">{formatDateNO(img.date)}</p>
                                                    {img.weight && (
                                                        <p className="text-white/70 text-[10px]">{formatWeight(img.weight)} kg</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {hasMoreImages && (
                        <Button variant="secondary" size="md" className="w-full" onClick={handleShowMoreImages}>
                            Vis flere bilder ({Math.min(IMAGE_BATCH_SIZE, allImages.length - visibleImageCount)})
                        </Button>
                    )}
                </div>
            )}

        </div>
    );
});

export default GalleryView;
