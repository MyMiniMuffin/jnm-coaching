const getBadgeApi = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
        return navigator;
    }
    return null;
};

export const setAppBadgeCount = async (count) => {
    const api = getBadgeApi();
    if (!api) return;

    try {
        const nextCount = Math.max(0, Number(count) || 0);
        if (nextCount > 0) {
            await api.setAppBadge(nextCount);
            return;
        }
        if (typeof api.clearAppBadge === 'function') {
            await api.clearAppBadge();
        }
    } catch (error) {
        console.warn('[Badge] Kunne ikke oppdatere app-ikonet:', error);
    }
};

export const clearAppBadge = () => setAppBadgeCount(0);

export const unreadCheckinTotal = (users) => {
    if (!Array.isArray(users)) return 0;
    return users
        .filter(user => user.role === 'athlete' && !user.is_archived)
        .reduce((sum, user) => sum + (Number(user.unreadCheckins) || 0), 0);
};
