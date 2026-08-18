import { haptic } from './haptic';

export const getOriginalImage = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('cloudinary.com')) return url;
    return url.replace(/\/upload\/((?:(?!\/v\d+\/)[^/])+)\/(v\d+\/)/, '/upload/$2');
};

const slugPart = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const fileDate = (value) => {
    if (!value && value !== 0) return '';
    if (typeof value === 'string' && value.includes('-')) {
        const [year, month, day] = value.split('T')[0].split('-');
        if (year && month && day) return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const raw = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(raw.getTime())) return '';
    const year = raw.getFullYear();
    const month = String(raw.getMonth() + 1).padStart(2, '0');
    const day = String(raw.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const buildImageFilename = ({ date, label, suffix } = {}) => {
    const parts = ['jnm', slugPart(label), fileDate(date), suffix ? String(suffix) : ''].filter(Boolean);
    return `${parts.join('-') || 'jnm-bilde'}.jpg`;
};

const triggerAnchorDownload = (href, filename) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const downloadImageFile = async (url, filename = 'jnm-bilde.jpg') => {
    const source = getOriginalImage(url);
    if (!source) throw new Error('Mangler bildeadresse');

    haptic('save');

    try {
        const response = await fetch(source, { mode: 'cors' });
        if (!response.ok) throw new Error('Kunne ikke hente bildet');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        triggerAnchorDownload(objectUrl, filename);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        return;
    } catch {
        if (source.includes('cloudinary.com')) {
            const stem = filename.replace(/\.[a-z0-9]+$/i, '');
            const attachmentUrl = source.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(stem)}/`);
            triggerAnchorDownload(attachmentUrl, filename);
            return;
        }
        throw new Error('Kunne ikke laste ned bildet');
    }
};
