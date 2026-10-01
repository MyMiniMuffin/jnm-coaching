import { useEffect } from 'react';
import { api } from './api';

// Registrer faktisk bruk, med maksimalt ett kall per minutt per fane.
export const useActivity = (userId) => {
    useEffect(() => {
        if (!userId) return;
        let lastInteraction = 0;
        let lastSent = 0;
        let pending = false;
        let cancelled = false;

        const send = async () => {
            if (cancelled || document.visibilityState !== 'visible' || !navigator.onLine || pending
                || Date.now() - lastSent < 60000 || Date.now() - lastInteraction > 60000) return;
            pending = true;
            lastSent = Date.now();
            try {
                await api.recordActivity();
            } catch {
                // Aktivitet skal ikke forstyrre normal bruk ved nettverksfeil.
                if (!cancelled) lastSent = 0;
            } finally {
                pending = false;
            }
        };
        const interact = () => {
            if (document.visibilityState !== 'visible') return;
            lastInteraction = Date.now();
            void send();
        };
        const events = ['pointerdown', 'keydown', 'scroll'];
        events.forEach(event => window.addEventListener(event, interact, { passive: true, capture: true }));
        document.addEventListener('visibilitychange', interact);
        window.addEventListener('online', interact);
        const interval = window.setInterval(send, 15000);
        interact();
        return () => {
            cancelled = true;
            window.clearInterval(interval);
            events.forEach(event => window.removeEventListener(event, interact, { capture: true }));
            document.removeEventListener('visibilitychange', interact);
            window.removeEventListener('online', interact);
        };
    }, [userId]);
};
