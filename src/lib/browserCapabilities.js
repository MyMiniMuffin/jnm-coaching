import { isNativeApp } from './platform';

const shouldPrefetchViews = () => {
    if (typeof navigator === 'undefined') return true;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return !['slow-2g', '2g'].includes(connection.effectiveType);
};

// Preload lazyView chunks one by one so a tap after load renders without a skeleton.
export const prefetchViews = (views) => {
    if (!shouldPrefetchViews()) return;
    views.forEach((view, index) => {
        setTimeout(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            view.preload().catch(() => {});
        }, index * 180);
    });
};

export const supportsWebPushNotifications = () => (
    !isNativeApp() &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
);

export const supportsPushNotifications = () => (
    isNativeApp() || supportsWebPushNotifications()
);

export const getNotificationPermission = () => {
    if (isNativeApp()) {
        // Native permission is refreshed asynchronously via checkPermissions().
        return 'default';
    }
    return supportsWebPushNotifications() ? Notification.permission : 'unsupported';
};

export const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from(rawData, char => char.charCodeAt(0));
};
