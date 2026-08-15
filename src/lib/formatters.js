// --- Helpers ---
export const formatWeight = (val) => (!val ? '-' : parseFloat(val).toFixed(1).replace('.', ','));

export const formatWeightDelta = (current, previous) => {
    const next = parseFloat(current);
    const last = parseFloat(previous);
    if (isNaN(next) || isNaN(last)) return null;
    const delta = next - last;
    if (Math.abs(delta) < 0.05) return { text: 'uendret', tone: 'neutral' };
    return {
        text: `${delta > 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')} kg`,
        tone: delta < 0 ? 'down' : 'up'
    };
};

export const formatDateNO = (dateString) => {
    if (!dateString) return '';
    // Håndter Date-objekter
    if (dateString instanceof Date) {
        const day = String(dateString.getDate()).padStart(2, '0');
        const month = String(dateString.getMonth() + 1).padStart(2, '0');
        const year = dateString.getFullYear();
        return `${day}.${month}.${year}`;
    }
    // Håndter timestamps (tall)
    if (typeof dateString === 'number') {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    // Håndter strenger
    const datePart = String(dateString).split('T')[0];
    if (datePart.includes('-')) {
        const [year, month, day] = datePart.split('-');
        return `${day}.${month}.${year}`;
    }
    return datePart;
};

export const getThumbnail = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
};

export const getFullSizeImage = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', '/upload/w_1280,c_limit,q_auto,f_auto/');
};
