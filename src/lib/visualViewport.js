import { useEffect } from 'react';

/**
 * While `active`, keep the focused field in view when the visual viewport
 * shrinks (software keyboard) or the window resizes (iPhone Duo fold/unfold).
 * `scroll-margin-top` on the field clears the sticky header; `block: 'nearest'`
 * never scrolls a field that is already visible. Does nothing unless `ref.current`
 * has focus, so a resize never steals focus or moves the page for other fields.
 */
export const useKeepFieldVisible = (ref, active) => {
    useEffect(() => {
        if (!active || typeof window === 'undefined') return undefined;
        const vv = window.visualViewport;
        let frame = 0;
        const reveal = () => {
            frame = 0;
            const el = ref.current;
            if (el && document.activeElement === el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(reveal);
        };
        vv?.addEventListener('resize', schedule);
        window.addEventListener('resize', schedule);
        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            vv?.removeEventListener('resize', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, [ref, active]);
};

/**
 * `position: fixed` is laid out against the layout viewport. iOS WebKit shrinks
 * and pans the visual viewport instead (keyboard open, scrolling while it is
 * open, relayout under it), so a fixed element drifts out of what the user sees.
 *
 * While `active`, mirror the visual viewport's top and height onto `ref.current`
 * as `--app-vv-top` / `--app-vv-height` so CSS can pin the element to it.
 * Writes go straight to the element style; no React state, no re-render.
 */
export const useVisualViewportVars = (ref, active) => {
    useEffect(() => {
        const el = ref.current;
        const vv = typeof window === 'undefined' ? null : window.visualViewport;
        if (!active || !el || !vv) return undefined;

        let frame = 0;
        const sync = () => {
            frame = 0;
            el.style.setProperty('--app-vv-top', `${vv.offsetTop}px`);
            el.style.setProperty('--app-vv-height', `${vv.height}px`);
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(sync);
        };

        sync();
        vv.addEventListener('resize', schedule);
        vv.addEventListener('scroll', schedule);
        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            vv.removeEventListener('resize', schedule);
            vv.removeEventListener('scroll', schedule);
            el.style.removeProperty('--app-vv-top');
            el.style.removeProperty('--app-vv-height');
        };
    }, [ref, active]);
};
