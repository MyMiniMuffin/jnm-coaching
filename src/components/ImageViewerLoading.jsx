import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { useEscapeKey, useFocusTrap } from '../hooks';

export default function ImageViewerLoading({ onClose }) {
    const ref = useFocusTrap();
    useEscapeKey(onClose);
    return createPortal(
        <div ref={ref} role="dialog" aria-modal="true" aria-label="Bildevisning" className="fixed inset-0 z-[100] bg-ink flex items-center justify-center text-white">
            <div role="status" className="flex items-center gap-3"><Loader2 className="animate-spin" size={24} />Åpner bilde…</div>
            <button type="button" onClick={onClose} aria-label="Lukk bildevisning" className="absolute right-4 min-h-11 min-w-11 flex items-center justify-center rounded-full bg-white/10" style={{ top: 'calc(env(safe-area-inset-top, 20px) + 12px)' }}><X /></button>
        </div>,
        document.body
    );
}
