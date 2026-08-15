const VIEW_PREFETCHERS = [
    () => import('../views/DashboardView'),
    () => import('../views/CheckInView'),
    () => import('../views/PlanSection'),
    () => import('../views/GalleryView'),
    () => import('../views/WeightProgressView')
];

const shouldPrefetchViews = () => {
    if (typeof navigator === 'undefined') return true;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return !['slow-2g', '2g'].includes(connection.effectiveType);
};

export const prefetchViews = (role) => {
    if (!shouldPrefetchViews()) return;
    const prefetchers = role === 'coach'
        ? [() => import('../views/CoachDashboard'), ...VIEW_PREFETCHERS]
        : VIEW_PREFETCHERS;
    prefetchers.forEach((prefetch, index) => {
        setTimeout(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            prefetch();
        }, index * 180);
    });
};

export const supportsPushNotifications = () => (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
);

export const getNotificationPermission = () => (
    supportsPushNotifications() ? Notification.permission : 'unsupported'
);

export const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from(rawData, char => char.charCodeAt(0));
};
