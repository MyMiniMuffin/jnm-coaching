import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { getFullSizeImage } from '../lib/formatters';
import { IMAGE_ZOOM_PROPS } from '../lib/zoomConfig';

// Stil-konstanter — opprettes én gang, ikke på hver render
const WRAPPER_STYLE = { width: "100%", height: "100%" };
const CONTENT_STYLE = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" };

const ImageModal = React.memo(({ images, initialIndex, onClose }) => {
    const safeInitialIndex = Math.max(0, Math.min(initialIndex || 0, (images?.length || 1) - 1));
    const [index, setIndex] = useState(safeInitialIndex);
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState(0);

    // Bruk refs for stabile referanser i keydown-listener
    const indexRef = useRef(index);
    const onCloseRef = useRef(onClose);
    const touchStartRef = useRef(null);
    const imageRef = useRef(null);
    const scaleRef = useRef(1);
    indexRef.current = index;
    onCloseRef.current = onClose;

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

    useEffect(() => {
        if (!images || images.length === 0) return;
        [index - 1, index + 1].forEach((targetIndex) => {
            if (targetIndex < 0 || targetIndex >= images.length) return;
            const img = new Image();
            img.src = getFullSizeImage(images[targetIndex]);
        });
    }, [images, index]);

    const goToIndex = useCallback((nextIndex, nextDirection) => {
        const boundedIndex = Math.max(0, Math.min(nextIndex, (images?.length || 1) - 1));
        if (boundedIndex === indexRef.current) return;
        scaleRef.current = 1;
        setDirection(nextDirection);
        setLoading(true);
        setIndex(boundedIndex);
    }, [images?.length]);

    const handleNext = useCallback((e) => {
        if(e) e.stopPropagation();
        goToIndex(indexRef.current + 1, 1);
    }, [goToIndex]);

    const handlePrev = useCallback((e) => {
        if(e) e.stopPropagation();
        goToIndex(indexRef.current - 1, -1);
    }, [goToIndex]);

    const handleTouchStart = useCallback((e) => {
        if (e.touches?.length !== 1) {
            touchStartRef.current = null;
            return;
        }
        const touch = e.touches?.[0];
        if (!touch) return;
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }, []);

    const handleTouchEnd = useCallback((e) => {
        const start = touchStartRef.current;
        const touch = e.changedTouches?.[0];
        touchStartRef.current = null;
        if (!start || !touch) return;
        if (scaleRef.current > 1.02) return;

        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

        if (deltaX < 0 && indexRef.current < (images?.length || 1) - 1) {
            goToIndex(indexRef.current + 1, 1);
        } else if (deltaX > 0 && indexRef.current > 0) {
            goToIndex(indexRef.current - 1, -1);
        }
    }, [goToIndex, images?.length]);

    // Stabil keydown-listener — bindes kun én gang
    useEffect(() => {
        if (!images || images.length === 0) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                goToIndex(indexRef.current + 1, 1);
            } else if (e.key === 'ArrowLeft') {
                goToIndex(indexRef.current - 1, -1);
            } else if (e.key === 'Escape') {
                onCloseRef.current();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToIndex, images?.length]);

    const currentImage = images?.[index];
    const currentImageSrc = getFullSizeImage(currentImage);
    const imageLabel = `Bilde ${index + 1} av ${images?.length || 0}`;
    const hasNext = index < (images?.length || 0) - 1;
    const hasPrev = index > 0;

    useEffect(() => {
        if (!currentImageSrc) return;
        setLoading(true);
        const image = imageRef.current;
        if (!image) return;
        if (image.complete && image.naturalWidth > 0) {
            setLoading(false);
        }
    }, [currentImageSrc]);

    if (!images || images.length === 0) return null;

    const modal = (
        <div
            className="fixed inset-0 z-[100] bg-[#050504] flex flex-col animate-fade-in overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Bildevisning"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ height: '100dvh' }}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.07),transparent_28rem)] pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

            <button
                type="button"
                onClick={onClose}
                aria-label="Lukk bildevisning"
                className="absolute right-4 text-white/75 hover:text-white min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/10 hover:bg-white/18 backdrop-blur-md ring-1 ring-white/10 transition-all z-[120]"
                style={{ top: 'calc(env(safe-area-inset-top, 20px) + 12px)' }}
            >
                <X size={24} />
            </button>

            {images.length > 1 && (
                <div
                    className="absolute left-4 text-white/75 font-medium bg-white/10 px-3 py-2 rounded-full text-sm z-[120] backdrop-blur-md ring-1 ring-white/10"
                    style={{ top: 'calc(env(safe-area-inset-top, 20px) + 14px)' }}
                >
                    {index + 1} / {images.length}
                </div>
            )}

            <div className="relative z-10 flex-1 min-h-0 w-full px-0 pt-[calc(env(safe-area-inset-top,0px)+4.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:px-6">
                <TransformWrapper
                    key={index}
                    {...IMAGE_ZOOM_PROPS}
                    onTransformed={(_, state) => {
                        scaleRef.current = state.scale;
                    }}
                >
                    <TransformComponent
                        wrapperClass="lightbox-zoom-wrapper"
                        contentClass="lightbox-zoom-content"
                        wrapperStyle={WRAPPER_STYLE}
                        contentStyle={CONTENT_STYLE}
                    >
                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" aria-hidden="true">
                                <div className="w-[min(70vw,420px)] aspect-[3/4] rounded-2xl bg-white/7 border border-white/10 animate-pulse flex items-center justify-center shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                                    <Loader2 className="text-white/70 animate-spin" size={32} />
                                </div>
                                <p className="text-white/50 text-xs">Laster bilde…</p>
                            </div>
                        )}
                        <img
                            ref={imageRef}
                            key={currentImageSrc}
                            src={currentImageSrc}
                            onLoad={() => setLoading(false)}
                            onError={(event) => {
                                if (event.currentTarget.src !== currentImage) {
                                    event.currentTarget.src = currentImage;
                                    return;
                                }
                                setLoading(false);
                            }}
                            className={`block h-full w-full object-contain select-none rounded-sm shadow-[0_24px_90px_rgba(0,0,0,0.32)] transition-all duration-300 ease-out ${loading ? `opacity-0 ${direction > 0 ? 'translate-x-4' : direction < 0 ? '-translate-x-4' : 'scale-[0.99]'}` : 'opacity-100 translate-x-0 scale-100'}`}
                            alt={imageLabel}
                            draggable={false}
                        />
                    </TransformComponent>
                </TransformWrapper>

                {hasPrev && (
                    <button
                        type="button"
                        onClick={handlePrev}
                        aria-label="Vis forrige bilde"
                        className="absolute left-3 sm:left-5 min-h-[48px] min-w-[48px] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md ring-1 ring-white/10 transition-all active:scale-95 z-[110]"
                    >
                        <ChevronLeft size={26} />
                    </button>
                )}
                {hasNext && (
                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label="Vis neste bilde"
                        className="absolute right-3 sm:right-5 min-h-[48px] min-w-[48px] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md ring-1 ring-white/10 transition-all active:scale-95 z-[110]"
                    >
                        <ChevronRight size={26} />
                    </button>
                )}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/55 bg-white/10 px-3 py-1.5 rounded-full text-xs z-[110] backdrop-blur-md ring-1 ring-white/10">
                    Sveip eller knip for å navigere
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
});

export default ImageModal;
