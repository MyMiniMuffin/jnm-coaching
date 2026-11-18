// Rene hjelpere for å bruke pushvarsler som "hint" om hvem som har sendt ukesrapport,
// slik at coach-oversikten kan markere utøvere før serveren har svart.

const cleanId = (value) => {
    // Bruker-id-er er heltall (serial); alt annet avvises.
    if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) return null;
        const asNumber = Number(trimmed);
        return Number.isSafeInteger(asNumber) ? asNumber : null;
    }
    return null;
};

/** Trekk ut { clientId, clientName } fra en Capacitor-notification (eller action.notification). */
export const extractPushHint = (notification) => {
    const data = notification?.data;
    if (!data || typeof data !== 'object') return null;
    const clientId = cleanId(data.clientId);
    if (clientId === null) return null;
    const clientName = typeof data.clientName === 'string' ? data.clientName.trim() : '';
    return { clientId, clientName };
};

/**
 * Sett unreadCheckins = max(1, eksisterende) for hintede utøvere som finnes i lista.
 * Ukjente id-er ignoreres. Returnerer samme liste-referanse hvis ingenting endres.
 */
export const applyPushHintsToUsers = (users, hints) => {
    if (!Array.isArray(users) || !Array.isArray(hints) || !hints.length) return users;
    const hinted = new Set(hints.filter(Boolean).map((hint) => String(hint.clientId)));
    if (!hinted.size) return users;

    let changed = false;
    const next = users.map((user) => {
        if (!user || typeof user !== 'object' || !hinted.has(String(user.id))) return user;
        const existing = Number(user.unreadCheckins) || 0;
        if (existing >= 1) return user;
        changed = true;
        return { ...user, unreadCheckins: 1 };
    });
    return changed ? next : users;
};
