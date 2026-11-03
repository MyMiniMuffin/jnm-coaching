/**
 * Bridge to the native iPhone Duo rail (`ios/App/App/DuoRail.swift`).
 *
 * On a Duo the native shell registers the `jnmRail` script-message handler and
 * draws the rail itself (SwiftUI / Liquid Glass). The web app stays the source
 * of truth: it posts the active tab, back availability and visibility, and the
 * native side answers with `jnm:rail` window events ({ action: 'select' | 'back', id? }).
 *
 * Everywhere else (phone, iPad, desktop, browser `?device=duo`) the handler is
 * absent and the DOM rail in Navigation.jsx is used unchanged.
 */
export const NATIVE_RAIL_HANDLER = 'jnmRail';
export const NATIVE_RAIL_EVENT = 'jnm:rail';

const getHandler = () => {
    if (typeof window === 'undefined') return null;
    const handler = window.webkit?.messageHandlers?.[NATIVE_RAIL_HANDLER];
    return handler && typeof handler.postMessage === 'function' ? handler : null;
};

export const hasNativeRail = () => getHandler() !== null;

/** Mirror rail state to native. Returns false when there is no native rail. */
export const postNativeRailState = ({ visible, activeId, showBack, items }) => {
    const handler = getHandler();
    if (!handler) return false;
    try {
        handler.postMessage({
            type: 'state',
            visible: Boolean(visible),
            activeId: activeId ?? '',
            showBack: Boolean(showBack),
            items: items.map(({ id, label }) => ({ id, label })),
        });
        return true;
    } catch {
        return false;
    }
};

/** Subscribe to taps coming from the native rail. Returns an unsubscribe fn. */
export const onNativeRailAction = (listener) => {
    if (typeof window === 'undefined') return () => {};
    const handle = (event) => {
        const detail = event?.detail;
        if (detail && typeof detail.action === 'string') listener(detail);
    };
    window.addEventListener(NATIVE_RAIL_EVENT, handle);
    return () => window.removeEventListener(NATIVE_RAIL_EVENT, handle);
};
