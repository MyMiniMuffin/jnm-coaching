/**
 * Idempotensnøkkel per utkast: lages én gang og gjenbrukes ved retry, slik at serveren kan
 * returnere den lagrede rapporten i stedet for å opprette en ny. Fjernes når utkastet er sendt.
 */
const storageName = (draftStorageKey) => `${draftStorageKey}_submission`;

const createKey = () => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
);

export const getSubmissionKey = (draftStorageKey) => {
    try {
        const existing = localStorage.getItem(storageName(draftStorageKey));
        if (existing) return existing;
    } catch (e) {
        return createKey();
    }
    const key = createKey();
    try { localStorage.setItem(storageName(draftStorageKey), key); } catch (e) {}
    return key;
};

export const clearSubmissionKey = (draftStorageKey) => {
    try { localStorage.removeItem(storageName(draftStorageKey)); } catch (e) {}
};
