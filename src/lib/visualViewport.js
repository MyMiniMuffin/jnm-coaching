import { useEffect } from 'react';

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
