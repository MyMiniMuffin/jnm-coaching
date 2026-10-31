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
 * Duo rail vs bottom nav uses DUO_RAIL_MEDIA_QUERY (size-class only — not
 * orientation APIs). Folded cover ~390–440 CSS px on the short side; unfolded
 * ~700+. Bottom nav is ONLY unfolded upright: see DUO_BOTTOM_NAV_MEDIA_QUERY.
 */
export const DUO_MIN_WIDTH_PX = 700;
export const DUO_MIN_HEIGHT_PX = 600;
export const DESKTOP_MIN_WIDTH_PX = 1024;

/** Width floor that separates folded cover (~390–440) from unfolded (~700+). */
export const DUO_UNFOLDED_MIN_WIDTH_PX = 600;

export const DUO_MEDIA_QUERY =
    `(min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px), ` +
    `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;

/**
 * Duo bottom nav (unfolded held upright / square only):
 *   (min-width: 600px) and (max-aspect-ratio: 1/1)
 *
 * - Folded portrait 390×844: width < 600 → no match → rail
 * - Folded landscape 844×390: aspect > 1 → no match → rail
 * - Unfolded portrait 760×900: width ≥ 600 and aspect ≤ 1 → match → bottom nav
 * - Unfolded landscape 900×760: aspect > 1 → no match → rail
 * - Square unfolded: aspect = 1 → match → bottom nav
 */
export const DUO_BOTTOM_NAV_MEDIA_QUERY =
    `(min-width: ${DUO_UNFOLDED_MIN_WIDTH_PX}px) and (max-aspect-ratio: 1/1)`;

/**
 * Duo rail space = NOT bottom-nav space.
 * Equivalent OR form for matchMedia (De Morgan):
 *   (max-width: 599px), (aspect-ratio > 1/1)
 */
export const DUO_RAIL_MEDIA_QUERY =
    `(max-width: ${DUO_UNFOLDED_MIN_WIDTH_PX - 1}px), (aspect-ratio > 1/1)`;
