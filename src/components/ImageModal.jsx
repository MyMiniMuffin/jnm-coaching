import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { getFullSizeImage } from '../lib/formatters';

// Stil-konstanter — opprettes én gang, ikke på hver render
const WRAPPER_STYLE = { width: "100%", height: "100%" };
const CONTENT_STYLE = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" };

const ImageModal = React.memo(({ images, initialIndex, onClose }) => {
    const safeInitialIndex = Math.max(0, Math.min(initialIndex || 0, (images?.length || 1) - 1));
    const [index, setIndex] = useState(safeInitialIndex);
    const [loading, setLoading] = useState(true);

    // Bruk refs for stabile referanser i keydown-listener
    const indexRef = useRef(index);
    const onCloseRef = useRef(onClose);
    indexRef.current = index;
    onCloseRef.current = onClose;

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const handleNext = useCallback((e) => {
        if(e) e.stopPropagation();
        setLoading(true);
        setIndex(prev => Math.min(prev + 1, (images?.length || 1) - 1));
    }, [images?.length]);

    const handlePrev = useCallback((e) => {
        if(e) e.stopPropagation();
        setLoading(true);
        setIndex(prev => Math.max(prev - 1, 0));
    }, []);

    // Stabil keydown-listener — bindes kun én gang
    useEffect(() => {
        if (!images || images.length === 0) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                setLoading(true);
                setIndex(prev => Math.min(prev + 1, (images.length || 1) - 1));
            } else if (e.key === 'ArrowLeft') {
                setLoading(true);
                setIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Escape') {
                onCloseRef.current();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [images?.length]);

    if (!images || images.length === 0) return null;

    const currentImage = images[index];
    const hasNext = index < images.length - 1;
    const hasPrev = index > 0;

    return (
        <div className="fixed inset-0 z-[100] bg-ink/95 flex items-center justify-center animate-fade-in">
            <button onClick={onClose} className="absolute right-4 text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-[120]" style={{ top: 'calc(env(safe-area-inset-top, 20px) + 12px)' }}>
                <X size={28} />
            </button>

            <div className="relative w-full h-full flex items-center justify-center">
                <TransformWrapper
                    key={index}
                    initialScale={1}
                    minScale={0.5}
                    maxScale={4}
                    centerOnInit={true}
                >
                    <TransformComponent wrapperStyle={WRAPPER_STYLE} contentStyle={CONTENT_STYLE}>
                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" aria-hidden="true">
                                <div className="w-[min(70vw,420px)] aspect-[3/4] rounded-2xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center">
                                    <Loader2 className="text-white/70 animate-spin" size={32} />
                                </div>
                                <p className="text-white/50 text-xs">Laster bilde…</p>
                            </div>
                        )}
                        <img
                            src={getFullSizeImage(currentImage)}
                            onLoad={() => setLoading(false)}
                            className={`max-w-full max-h-[90vh] object-contain select-none transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                            alt="Fullskjerm"
                        />
                    </TransformComponent>
                </TransformWrapper>

                {hasPrev && (
                    <button onClick={handlePrev} className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-[110]">
                        <ChevronLeft size={28} />
                    </button>
                )}
                {hasNext && (
                    <button onClick={handleNext} className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-[110]">
                        <ChevronRight size={28} />
                    </button>
                )}
                {images.length > 1 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 font-medium bg-white/10 px-4 py-2 rounded-full text-sm z-[110]">
                        {index + 1} / {images.length}
                    </div>
                )}
            </div>
        </div>
    );
});

export default ImageModal;
