/**
 * CJS mirror of duoBreakpoint.js for tailwind.config.js (CommonJS).
 * Keep values identical — tests/iphone-duo.mjs asserts parity.
 */
const DUO_MIN_WIDTH_PX = 700;
const DUO_MIN_HEIGHT_PX = 600;

const DUO_MEDIA_QUERY = `(min-width: ${DUO_MIN_WIDTH_PX}px) and (min-height: ${DUO_MIN_HEIGHT_PX}px)`;
const PHONE_CHROME_MEDIA_QUERY = `(max-width: ${DUO_MIN_WIDTH_PX - 1}px), (max-height: ${DUO_MIN_HEIGHT_PX - 1}px)`;

module.exports = {
    DUO_MIN_WIDTH_PX,
    DUO_MIN_HEIGHT_PX,
    DUO_MEDIA_QUERY,
    PHONE_CHROME_MEDIA_QUERY,
};
