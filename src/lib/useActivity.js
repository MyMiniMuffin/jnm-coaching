import { useEffect } from 'react';
import { api } from './api';

// Registrer faktisk bruk, med maksimalt ett kall per minutt per fane.
// Ved synlig fanebytte hentes status alltid, slik at arkivering synker uten ny innlogging.
export const useActivity = (userId, onStatus) => {
    useEffect(() => {
        if (!userId) return;
        let lastInteraction = 0;
        let lastSent = 0;
        let pending = false;
        let cancelled = false;

        const applyStatus = (data) => {
            if (cancelled || !onStatus || !data || typeof data !== 'object') return;
            if (!('isArchived' in data)) return;
            onStatus({ isArchived: Boolean(data.isArchived) });
        };

        const send = async ({ forceStatus = false } = {}) => {
            if (cancelled || document.visibilityState !== 'visible' || !navigator.onLine || pending) return;
            if (!forceStatus && (Date.now() - lastSent < 60000 || Date.now() - lastInteraction > 60000)) return;
            pending = true;
            if (!forceStatus) lastSent = Date.now();
            try {
                const result = await api.recordActivity();
                if (result?.authError) return;
                applyStatus(result?.data);
                if (forceStatus) lastSent = Date.now();
            } catch {
                // Aktivitet skal ikke forstyrre normal bruk ved nettverksfeil.
                if (!cancelled && !forceStatus) lastSent = 0;
            } finally {
                pending = false;
            }
        };
        const interact = () => {
            if (document.visibilityState !== 'visible') return;
            lastInteraction = Date.now();
            void send();
        };
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            lastInteraction = Date.now();
            void send({ forceStatus: true });
        };
        const events = ['pointerdown', 'keydown', 'scroll'];
        events.forEach(event => window.addEventListener(event, interact, { passive: true, capture: true }));
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', interact);
        const interval = window.setInterval(send, 15000);
        interact();
        return () => {
            cancelled = true;
            window.clearInterval(interval);
            events.forEach(event => window.removeEventListener(event, interact, { capture: true }));
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', interact);
        };
    }, [userId, onStatus]);
};
