import { isNativeApp } from './platform';
import { clearNativeDeliveredNotifications } from './nativePush';

const getBadgeApi = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
        return navigator;
    }
    return null;
};

const clearWebNotifications = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        if (typeof registration.getNotifications !== 'function') return;
        const notifications = await registration.getNotifications();
        notifications.forEach((notification) => notification.close());
    } catch (error) {
        console.warn('[Badge] Kunne ikke lukke web-varsler:', error);
    }
};

export const setAppBadgeCount = async (count) => {
    const nextCount = Math.max(0, Number(count) || 0);
    const api = getBadgeApi();

    if (api) {
        try {
            if (nextCount > 0) {
                await api.setAppBadge(nextCount);
            } else if (typeof api.clearAppBadge === 'function') {
                await api.clearAppBadge();
            }
        } catch (error) {
            console.warn('[Badge] Kunne ikke oppdatere app-ikonet:', error);
        }
    }

    // iOS APNs setter badge utenfor Badging API. Når alt er lest, tøm
    // både Notification Center og applicationIconBadgeNumber.
    if (nextCount === 0) {
        if (isNativeApp()) {
            await clearNativeDeliveredNotifications();
        } else {
            await clearWebNotifications();
        }
    }
};

export const clearAppBadge = () => setAppBadgeCount(0);

export const unreadCheckinTotal = (users) => {
    if (!Array.isArray(users)) return 0;
    return users
        .filter(user => user.role === 'athlete' && !user.is_archived)
        .reduce((sum, user) => sum + (Number(user.unreadCheckins) || 0), 0);
};
