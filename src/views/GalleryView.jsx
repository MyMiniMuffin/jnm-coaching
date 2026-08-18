import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, Loader2, Plus, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Card, Button, EmptyState, IconButton, TextField } from '../components/ui';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useEscapeKey, useFocusTrap } from '../hooks';
import { api } from '../lib/api';
import { formatDateNO, formatWeight, getThumbnail, getFullSizeImage } from '../lib/formatters';
import { IMAGE_ZOOM_PROPS } from '../lib/zoomConfig';
import { haptic } from '../lib/haptic';

const ImageModal = React.lazy(() => import('../components/ImageModal'));

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

const ComparePanel = React.memo(({ image, label, align = 'left' }) => (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black/10">
        <CompareZoomImage image={image} label={label} />
        <div className={`absolute top-3 ${align === 'right' ? 'right-3' : 'left-3'} bg-white/10 text-white px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md ring-1 ring-white/10 pointer-events-none`}>
            {label}
        </div>
        <div className="absolute bottom-3 left-3 right-3 bg-black/45 backdrop-blur-md rounded-lg p-2.5 sm:p-3 ring-1 ring-white/10 pointer-events-none">
            <p className="text-white text-sm sm:text-base font-medium">{formatDateNO(image.date)}</p>
            {image.weight && (
                <p className="text-white/70 text-xs sm:text-sm">{formatWeight(image.weight)} kg</p>
            )}
        </div>
    </div>
));

const FullscreenCompareModal = React.memo(({ before, after, daysDiff, weightDiff, onClose }) => {
    const modalRef = useFocusTrap(true);
    useEscapeKey(onClose, true);

    useEffect(() => {
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, []);

    return createPortal(
        <div
            ref={modalRef}
            className="fixed inset-0 z-[100] isolate bg-ink animate-fade-in overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fullscreen-compare-title"
            style={{ width: '100vw', height: '100dvh', top: 0, left: 0, overscrollBehavior: 'contain' }}
        >
            <h2 id="fullscreen-compare-title" className="sr-only">Sammenligning i fullskjerm</h2>
            <div className="absolute inset-x-0 top-0 z-[105] h-28 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 z-[105] h-32 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />

            <header className="absolute inset-x-0 top-0 z-[120] safe-area-pt">
                <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
                    <div className="min-w-0 text-white">
                        <p className="text-xs sm:text-sm text-white/60">Sammenligning</p>
                        <p className="font-medium">{daysDiff ?? 0} dager</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Lukk fullskjerm"
                        className="text-white/75 hover:text-white min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/10 hover:bg-white/18 backdrop-blur-md ring-1 ring-white/10 transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>

            <main className="relative z-10 h-full w-full pt-[calc(env(safe-area-inset-top,0px)+4.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)]">
                <div className="flex h-full min-h-0 w-full flex-col sm:flex-row">
                    <ComparePanel image={before} label="Før" />
                    <div className="h-px w-full shrink-0 bg-white/20 sm:h-full sm:w-px" />
                    <ComparePanel image={after} label="Etter" align="right" />
                </div>
            </main>

            <footer className="absolute inset-x-0 bottom-0 z-[120] safe-area-pb">
                <div className="flex items-center justify-center gap-2 sm:gap-4 p-3 sm:p-4">
                    {weightDiff && (
                        <div className="flex items-center gap-2 py-2 px-3 sm:px-4 rounded-full backdrop-blur-md ring-1 ring-white/10 bg-white/10 text-white">
                            {parseFloat(weightDiff) < 0 ? <TrendingDown size={18} /> : parseFloat(weightDiff) > 0 ? <TrendingUp size={18} /> : <Minus size={18} />}
                            <span className="font-semibold text-sm sm:text-base">
                                {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff.replace('.', ',')} kg
                            </span>
                        </div>
                    )}
                    <div className="bg-white/10 text-white/65 py-2 px-3 sm:px-4 rounded-full text-xs sm:text-sm backdrop-blur-md ring-1 ring-white/10">
                        Zoom og panorer
                    </div>
                </div>
            </footer>
        </div>,
        document.body
    );
});

// GalleryView - samler alle bilder fra checkins for lett sammenligning
const GalleryView = React.memo(({ checkins = [], galleryImages = [], isCoach = false, uploadUserId, onAddGalleryImage, onDeleteGalleryImage }) => {
    const toast = useToast();
    const confirmDialog = useConfirm();
    const [lightbox, setLightbox] = useState({ isOpen: false, images: [], index: 0 });
    const [viewMode, setViewMode] = useState('grid');
    const [compareImages, setCompareImages] = useState({ before: null, after: null });
    const [selectingFor, setSelectingFor] = useState(null); // 'before' eller 'after'
    const [fullscreenCompare, setFullscreenCompare] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ label: 'Startbilde', date: new Date().toISOString().split('T')[0], weight: '' });
    const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
    const [visibleImageCount, setVisibleImageCount] = useState(IMAGE_BATCH_SIZE);
    const [deletingImageId, setDeletingImageId] = useState(null);
    const tilePointerRef = React.useRef(null);
    const compareTopRef = React.useRef(null);

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

    useEffect(() => {
        setVisibleImageCount(IMAGE_BATCH_SIZE);
    }, [allImages.length, viewMode]);

    useEffect(() => {
        if (viewMode !== 'compare') return;
        window.requestAnimationFrame(() => {
            compareTopRef.current?.scrollIntoView({ block: 'start' });
        });
    }, [viewMode]);

    const visibleImages = useMemo(
        () => allImages.slice(0, visibleImageCount),
        [allImages, visibleImageCount]
    );

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

    const handleImageSelection = useCallback((e) => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        if (files.length === 0) return;
        if (files.length > 5) {
            toast('Maks 5 bilder om gangen', 'error');
            return;
        }

        setSelectedUploadFiles(files);
        setUploadProgress('');
    }, [toast]);

    const handleImageUpload = useCallback(async (e) => {
        e.preventDefault();
        const files = selectedUploadFiles;
        if (files.length === 0) {
            toast('Velg minst ett bilde', 'error');
            return;
        }
        if (!uploadUserId) {
            toast('Mangler bruker for opplasting', 'error');
            return;
        }

        haptic('save');
        setIsUploading(true);
        try {
            let completedUploads = 0;
            setUploadProgress(`0 av ${files.length}`);
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
                    completedUploads += 1;
                    setUploadProgress(`${completedUploads} av ${files.length}`);
                    return result.data.url;
                })
            );

            const { label, date, weight } = uploadForm;
            const results = await Promise.allSettled(
                uploadedUrls.map(url => onAddGalleryImage(url, label, date, weight))
            );
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.error('Noen bilder kunne ikke lagres:', failed);
                toast(`${failed.length} av ${uploadedUrls.length} bilder kunne ikke lagres`, 'error');
            } else {
                toast(`${uploadedUrls.length} bilde${uploadedUrls.length > 1 ? 'r' : ''} lagt til`);
            }

            setShowUploadModal(false);
            setSelectedUploadFiles([]);
            setUploadForm({ label: 'Startbilde', date: new Date().toISOString().split('T')[0], weight: '' });
        } catch (err) {
            console.error(err);
            toast(err.message || 'Bildeopplasting feilet', 'error');
        } finally {
            setIsUploading(false);
            setUploadProgress('');
        }
    }, [onAddGalleryImage, selectedUploadFiles, uploadForm, uploadUserId, toast]);

    const handleDeleteGalleryImage = useCallback(async (imageId) => {
        if (await confirmDialog('Slett dette bildet fra galleriet?', { title: 'Slett bilde', confirmText: 'Slett', destructive: true })) {
            setDeletingImageId(imageId);
            try {
                await onDeleteGalleryImage(imageId);
            } catch (err) {
                console.error(err);
                toast(err.message || 'Kunne ikke slette bildet', 'error');
            } finally {
                setDeletingImageId(null);
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
        if (isUploading) return;
        setShowUploadModal(false);
        setSelectedUploadFiles([]);
        setUploadProgress('');
        setUploadForm({ label: 'Startbilde', date: new Date().toISOString().split('T')[0], weight: '' });
    }, [isUploading]);

    const closeFullscreenCompare = useCallback(() => {
        setFullscreenCompare(false);
    }, []);

    useEscapeKey(closeUploadModal, showUploadModal);
    const uploadModalRef = useFocusTrap(showUploadModal);

    // Felles upload-modal (brukes i både tom- og normal-visning)
    const uploadModal = showUploadModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <Card ref={uploadModalRef} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="upload-images-title">
                <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
                    <h2 id="upload-images-title" className="section-title text-[1.05rem]">Last opp bilder</h2>
                    <IconButton onClick={closeUploadModal} aria-label="Lukk" disabled={isUploading}>
                        <X size={20} />
                    </IconButton>
                </div>

                <form className="min-h-0 space-y-4 overflow-y-auto px-6 pb-6" onSubmit={handleImageUpload}>
                    <label htmlFor="gallery-upload-files" className={`flex min-h-[132px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-200 p-5 text-center transition-all hover:border-surface-300 hover:bg-surface-50 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                        {isUploading ? (
                            <>
                                <Loader2 className="animate-spin text-ink-muted" size={24} />
                                <span className="mt-2 text-sm font-medium text-ink-muted">Laster opp {uploadProgress}</span>
                            </>
                        ) : selectedUploadFiles.length > 0 ? (
                            <>
                                <Camera size={24} className="mb-2 text-ink-muted" />
                                <span className="font-medium text-ink">{selectedUploadFiles.length} bilde{selectedUploadFiles.length > 1 ? 'r' : ''} valgt</span>
                                <span className="mt-1 max-w-full truncate text-xs text-ink-muted">
                                    {selectedUploadFiles.map(file => file.name).join(', ')}
                                </span>
                                <span className="mt-2 text-xs font-medium text-accent">Trykk for å velge på nytt</span>
                            </>
                        ) : (
                            <>
                                <Camera size={24} className="text-ink-muted mb-2" />
                                <span className="font-medium text-ink">Velg bilder</span>
                                <span className="mt-1 text-xs text-ink-muted">Maks 5 bilder (JPG, PNG, HEIC)</span>
                            </>
                        )}
                        <input id="gallery-upload-files" type="file" accept="image/*" multiple className="sr-only" onChange={handleImageSelection} disabled={isUploading} />
                    </label>

                    <div className="space-y-4">
                        <p className="text-xs text-ink-muted">Detaljene gjelder alle valgte bilder og kan endres før opplasting.</p>
                        <TextField id="gallery-upload-label" label="Bildetekst" type="text" value={uploadForm.label} onChange={handleLabelChange} placeholder="F.eks. Startbilde" disabled={isUploading} />
                        <TextField id="gallery-upload-date" label="Dato" type="date" value={uploadForm.date} onChange={handleDateChange} disabled={isUploading} />
                        <TextField id="gallery-upload-weight" label="Vekt (kg, valgfritt)" type="number" inputMode="decimal" step="0.1" value={uploadForm.weight} onChange={handleWeightChange} placeholder="0,0" disabled={isUploading} />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <Button variant="secondary" size="md" className="flex-1" onClick={closeUploadModal} disabled={isUploading}>
                            Avbryt
                        </Button>
                        <Button type="submit" variant="primary" size="md" className="flex-1" disabled={selectedUploadFiles.length === 0 || isUploading}>
                            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                            {isUploading ? 'Laster opp' : 'Last opp'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );

    if (allImages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] lg:h-auto lg:py-24 animate-fade-in">
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
        <div className="space-y-5 pb-32 lg:pb-8 animate-slide-up">
            {uploadModal}

            {lightbox.isOpen && (
                <React.Suspense fallback={null}>
                    <ImageModal
                        images={lightbox.images}
                        initialIndex={lightbox.index}
                        onClose={closeLightbox}
                    />
                </React.Suspense>
            )}

            {/* Fullskjerm sammenligning */}
            {fullscreenCompare && compareImages.before && compareImages.after && (
                <FullscreenCompareModal
                    before={compareImages.before}
                    after={compareImages.after}
                    daysDiff={daysDiff}
                    weightDiff={weightDiff}
                    onClose={closeFullscreenCompare}
                />
            )}

            {/* Header med visningsvalg */}
            <div ref={compareTopRef} className="space-y-3 scroll-mt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 mr-auto">
                        <h2 className="text-[1.7rem] leading-none font-display">
                            {viewMode === 'compare' ? 'Sammenlign' : 'Fremgangsgalleri'}
                        </h2>
                        <p className="text-sm text-ink-muted mt-1">
                            {viewMode === 'compare' ? 'Velg bilder å sammenligne' : `${allImages.length} bilder`}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {viewMode === 'compare' ? (
                            <Button variant="secondary" size="sm" onClick={clearCompare}>
                                <X size={16} /> Lukk
                            </Button>
                        ) : (
                            <>
                                {allImages.length >= 2 && (
                                    <Button variant="secondary" size="sm" onClick={startCompare}>
                                        <Eye size={16} /> Sammenlign
                                    </Button>
                                )}
                                {isCoach && onAddGalleryImage && (
                                    <Button variant="primary" size="sm" onClick={() => setShowUploadModal(true)}>
                                        <Plus size={16} /> Last opp
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Sammenlign-modus */}
            {viewMode === 'compare' && (
                <div className="space-y-4">
                    {/* Sammenligning side-by-side */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Før-bilde */}
                        <div className="space-y-2">
                            <p className="section-label text-center">Før</p>
                            <button
                                type="button"
                                className={`relative aspect-[4/5] max-h-[42vh] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectingFor === 'before' ? 'border-ink ring-2 ring-ink/20' : 'border-surface-200'}`}
                                onClick={() => setSelectingFor(selectingFor === 'before' ? null : 'before')}
                                aria-pressed={selectingFor === 'before'}
                                aria-label={compareImages.before ? `Bytt før-bilde, valgt ${formatDateNO(compareImages.before.date)}` : 'Velg før-bilde'}
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
                            </button>
                        </div>

                        {/* Etter-bilde */}
                        <div className="space-y-2">
                            <p className="section-label text-center">Etter</p>
                            <button
                                type="button"
                                className={`relative aspect-[4/5] max-h-[42vh] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectingFor === 'after' ? 'border-ink ring-2 ring-ink/20' : 'border-surface-200'}`}
                                onClick={() => setSelectingFor(selectingFor === 'after' ? null : 'after')}
                                aria-pressed={selectingFor === 'after'}
                                aria-label={compareImages.after ? `Bytt etter-bilde, valgt ${formatDateNO(compareImages.after.date)}` : 'Velg etter-bilde'}
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
                            </button>
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
                                        <p className={`text-lg font-semibold flex items-center justify-center gap-1 ${parseFloat(weightDiff) === 0 ? 'text-ink-muted' : 'text-ink'}`}>
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
                                    <button
                                        type="button"
                                        key={getImageKey(img, idx)}
                                        className={`relative aspect-square min-h-[44px] cursor-pointer rounded-lg overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${isSelected ? 'border-ink' : 'border-transparent'} ${selectingFor ? 'hover:scale-[1.02]' : ''}`}
                                        onClick={() => handleCompareImageClick(img)}
                                        aria-pressed={isSelected}
                                        aria-label={`${isSelected ? (isBefore ? 'Valgt som før-bilde' : 'Valgt som etter-bilde') : 'Velg bilde'} fra ${formatDateNO(img.date)}`}
                                    >
                                        <img 
                                            src={getThumbnail(img.url)} 
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover"
                                            alt={`Fremgang ${formatDateNO(img.date)}`}
                                        />
                                        {isSelected && (
                                            <div className="absolute top-1 right-1 bg-ink text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                                {isBefore ? 'FØR' : 'ETTER'}
                                            </div>
                                        )}
                                    </button>
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
                    <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-5 lg:gap-2">
                        {visibleImages.map((img, idx) => (
                            <div 
                                key={getImageKey(img, idx)}
                                className="relative aspect-square group"
                            >
                                <button
                                    type="button"
                                    className="absolute inset-0 w-full overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                                    data-swipe-ignore="true"
                                    onPointerDown={(e) => handleTilePointerDown(e, img, idx)}
                                    onPointerUp={handleTilePointerUp}
                                    onKeyDown={(e) => handleTileKeyDown(e, img, idx)}
                                    aria-label={`Vis ${img.label || 'fremgangsbilde'} fra ${formatDateNO(img.date)}`}
                                >
                                    <img
                                        src={getThumbnail(img.url)}
                                        loading={idx < 12 ? 'eager' : 'lazy'}
                                        decoding="async"
                                        fetchPriority={idx < 6 ? 'high' : 'auto'}
                                        className="w-full h-full object-cover"
                                        alt=""
                                    />
                                    {img.isGalleryImage && img.label && (
                                        <span className={`absolute top-1.5 left-1.5 ${isCoach && onDeleteGalleryImage ? 'right-12' : 'right-1.5'} truncate bg-ink/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm`}>
                                            {img.label}
                                        </span>
                                    )}
                                    <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent rounded-lg">
                                        <span className="absolute bottom-2 left-2 right-2">
                                            <span className="block text-white text-xs font-medium">{formatDateNO(img.date)}</span>
                                            {img.weight && (
                                                <span className="block text-white/75 text-[10px]">{formatWeight(img.weight)} kg</span>
                                            )}
                                        </span>
                                    </span>
                                </button>
                                {/* Slett-knapp for coach på gallery-bilder - alltid synlig */}
                                {isCoach && img.isGalleryImage && onDeleteGalleryImage && (
                                    <IconButton
                                        onClick={(e) => { e.stopPropagation(); handleDeleteGalleryImage(img.galleryImageId); }}
                                        aria-label={String(img.galleryImageId).startsWith('temp_') ? 'Bildet lagres fortsatt' : `Slett ${img.label || 'bilde'} fra ${formatDateNO(img.date)}`}
                                        tone="danger"
                                        disabled={String(img.galleryImageId).startsWith('temp_') || deletingImageId === img.galleryImageId}
                                        className="absolute top-1 right-1 z-10 min-h-[40px] min-w-[40px] rounded-lg bg-white/90 text-error shadow-sm backdrop-blur-sm active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                                    >
                                        {String(img.galleryImageId).startsWith('temp_') || deletingImageId === img.galleryImageId
                                            ? <Loader2 size={18} className="animate-spin" />
                                            : <X size={18} />}
                                    </IconButton>
                                )}
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

        </div>
    );
});

export default GalleryView;
