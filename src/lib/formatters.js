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

const toLocalDate = (value) => {
    if (!value && value !== 0) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
        const fromTimestamp = new Date(value);
        return Number.isNaN(fromTimestamp.getTime()) ? null : fromTimestamp;
    }
    const datePart = String(value).split('T')[0];
    if (datePart.includes('-')) {
        const [year, month, day] = datePart.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateNO = (dateString) => {
    const date = toLocalDate(dateString);
    if (!date) return '';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('no-NO', {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' })
    });
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
