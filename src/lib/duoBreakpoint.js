/**
 * Single source for the Duo / wide-shell breakpoint.
 *
 * Mirrored in:
 * - tailwind.config.js → screens.duo.raw
 * - src/index.css → @media (min-width: 700px) and (min-height: 600px)
 * - DESKTOP_QUERY / useDesktop (this module)
 *
 * Both min-width and min-height are required so closed-phone landscape
 * (e.g. 932×430) keeps bottom nav instead of the sidebar shell.
 * iPad portrait (≥700×≥600) still matches — not a regression vs width-only duo.
 */
export const DUO_MIN_WIDTH_PX = 700;
export const DUO_MIN_HEIGHT_PX = 600;

export const DUO_MEDIA_QUERY =
    `(min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px)`;

/** Inverse of duo shell: phone widths or short viewports (phone landscape). */
export const PHONE_CHROME_MEDIA_QUERY =
    `(max-width: ${DUO_MIN_WIDTH_PX - 1}px), (max-height: ${DUO_MIN_HEIGHT_PX - 1}px)`;
