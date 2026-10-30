/**
 * Single source for the Duo / wide-shell breakpoint.
 *
 * Imported by:
 * - tailwind.config.mjs → screens.duo.raw
 * - DESKTOP_QUERY / useDesktop (hooks.jsx)
 *
 * CSS in src/index.css must mirror DUO_MEDIA_QUERY (parity-tested).
 *
 * Match when:
 * - wide AND tall enough (unfolded Duo / tablet), OR
 * - desktop width ≥1024 (sidebar stays even if the window is short)
 *
 * Closed-phone landscape (e.g. 932×430) does not match.
 * Keyboard height shrink on 700–1023 is handled in useDesktop (sticky),
 * which sets html[data-duo-shell] so the shell does not flip.
 */
export const DUO_MIN_WIDTH_PX = 700;
export const DUO_MIN_HEIGHT_PX = 600;
export const DESKTOP_MIN_WIDTH_PX = 1024;

export const DUO_MEDIA_QUERY =
    `(min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px), ` +
    `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;
