import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { isNativeApp } from './platform';

export const APNS_ENDPOINT_PREFIX = 'apns:';

export const toApnsEndpoint = (deviceToken) => `${APNS_ENDPOINT_PREFIX}${String(deviceToken || '').replace(/\s+/g, '')}`;

export const mapNativePermission = (receive) => {
    if (receive === 'granted') return 'granted';
    if (receive === 'denied') return 'denied';
    if (receive === 'prompt' || receive === 'prompt-with-rationale') return 'default';
    return 'unsupported';
};

export const checkNativeNotificationPermission = async () => {
    if (!isNativeApp()) return 'unsupported';
    try {
        const status = await PushNotifications.checkPermissions();
        return mapNativePermission(status.receive);
    } catch (error) {
        console.error('[Push] Kunne ikke sjekke native tillatelse:', error);
        return 'unsupported';
    }
};

export const requestNativeNotificationPermission = async () => {
    if (!isNativeApp()) return 'unsupported';
    try {
        const status = await PushNotifications.requestPermissions();
        return mapNativePermission(status.receive);
    } catch (error) {
        console.error('[Push] Kunne ikke be om native tillatelse:', error);
        return 'denied';
    }
};

export const registerNativePushListeners = async ({
    onRegistration,
    onRegistrationError,
    onNotificationReceived,
    onNotificationAction
}) => {
    if (!isNativeApp()) return () => {};

    const handles = await Promise.all([
        PushNotifications.addListener('registration', (token) => {
            onRegistration?.(token?.value || '');
        }),
        PushNotifications.addListener('registrationError', (error) => {
            onRegistrationError?.(error);
        }),
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            onNotificationReceived?.(notification);
        }),
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            onNotificationAction?.(action);
        })
    ]);

    return () => {
        handles.forEach((handle) => {
            try {
                handle.remove();
            } catch (_) {
                // ignore
            }
        });
    };
};

export const registerNativePush = async () => {
    if (!isNativeApp()) {
        throw new Error('Native push er kun tilgjengelig i iOS-appen');
    }
    if (Capacitor.getPlatform() === 'web') {
        throw new Error('Native push er ikke tilgjengelig i nettleseren');
    }
    await PushNotifications.register();
};

/** Tøm Notification Center og sett iOS-badge til 0. */
export const clearNativeDeliveredNotifications = async () => {
    if (!isNativeApp()) return;
    try {
        await PushNotifications.removeAllDeliveredNotifications();
    } catch (error) {
        console.warn('[Push] Kunne ikke tømme leverte varsler:', error);
    }
};

/** Fjern leverte varsler for én utøver (uten å nullstille hele badge-tallet). */
export const removeNativeNotificationsForClient = async (clientId) => {
    if (!isNativeApp() || clientId == null) return;
    try {
        const delivered = await PushNotifications.getDeliveredNotifications();
        const matching = (delivered?.notifications || []).filter(
            (notification) => String(notification?.data?.clientId) === String(clientId)
        );
        if (!matching.length) return;
        await PushNotifications.removeDeliveredNotifications({ notifications: matching });
    } catch (error) {
        console.warn('[Push] Kunne ikke fjerne varsler for utøver:', error);
    }
};
