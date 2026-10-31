/**
 * Duo / wide-shell media query (entry condition for shellMode).
 *
 * Match when:
 * - wide AND tall enough (unfolded Duo / tablet), OR
 * - desktop width ≥1024 (sidebar even if the window is short)
 *
 * Sticky keyboard behavior lives in shellMode.js (not in this query).
 * Tailwind `duo:` is an attribute variant on html[data-shell="wide"], not a media screen.
 *
 * Duo rail uses DUO_RAIL_MEDIA_QUERY: same wide threshold AND landscape-shaped
 * viewport (width ≥ height via min-aspect-ratio). Portrait Duo (folded or
 * unfolded upright) stays on the normal bottom nav — size-class decision, not
 * device orientation APIs.
 */
export const DUO_MIN_WIDTH_PX = 700;
export const DUO_MIN_HEIGHT_PX = 600;
export const DESKTOP_MIN_WIDTH_PX = 1024;

export const DUO_MEDIA_QUERY =
    `(min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px), ` +
    `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;

/**
 * Live space for the Duo right-hand rail.
 * Width ≥ height (`min-aspect-ratio: 1/1`) AND the existing wide threshold.
 * Folded landscape (~844×390) fails the height/desktop branch → bottom nav.
 */
export const DUO_RAIL_MEDIA_QUERY =
    `(min-aspect-ratio: 1/1) and (min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px), ` +
    `(min-aspect-ratio: 1/1) and (min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;
