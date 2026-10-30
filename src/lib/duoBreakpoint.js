/**
 * Duo / wide-shell media query (entry condition for shellMode).
 *
 * Match when:
 * - wide AND tall enough (unfolded Duo / tablet), OR
 * - desktop width ≥1024 (sidebar even if the window is short)
 *
 * Sticky keyboard behavior lives in shellMode.js (not in this query).
 * Tailwind `duo:` is an attribute variant on html[data-shell="wide"], not a media screen.
 */
export const DUO_MIN_WIDTH_PX = 700;
export const DUO_MIN_HEIGHT_PX = 600;
export const DESKTOP_MIN_WIDTH_PX = 1024;

export const DUO_MEDIA_QUERY =
    `(min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px), ` +
    `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;
