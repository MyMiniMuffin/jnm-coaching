/**
 * Grense for «marker som lest»: høyeste rapport-id coach faktisk har fått lastet.
 * null betyr at ingenting ferskt er sett (feil, cache eller ingen rapporter) og at ingenting skal markeres.
 */
export const getReadBound = (result) => {
    if (!result?.data || result.networkError || result.fromCache) return null;
    const ids = (Array.isArray(result.data.checkins) ? result.data.checkins : [])
        .map((checkin) => Number(checkin?.id))
        .filter((id) => Number.isSafeInteger(id) && id > 0);
    return ids.length ? { upToId: Math.max(...ids) } : null;
};
