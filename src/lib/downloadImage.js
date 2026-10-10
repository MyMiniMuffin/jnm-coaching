import { haptic } from './haptic.js';

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

export const createImageArchive = async (images) => {
    if (!images.length) throw new Error('Ingen bilder valgt');
    const { default: JSZip } = await import('jszip');
    const archive = new JSZip();
    // Fetch a small batch concurrently, without opening a connection for every
    // image in a large gallery. Keep filenames tied to the original selection.
    for (let offset = 0; offset < images.length; offset += 4) {
        const batch = await Promise.all(images.slice(offset, offset + 4).map(async (image, index) => {
            const source = getOriginalImage(image.url);
            if (!source) throw new Error('Mangler bildeadresse');
            const response = await fetch(source, { mode: 'cors' });
            if (!response.ok) throw new Error('Kunne ikke hente alle bildene');
            return {
                filename: buildImageFilename({
                    date: image.date || image.timestamp,
                    label: image.label,
                    suffix: offset + index + 1
                }),
                contents: await response.arrayBuffer()
            };
        }));
        batch.forEach(({ filename, contents }) => archive.file(filename, contents));
    }
    return archive.generateAsync({ type: 'uint8array', compression: 'STORE' });
};

export const downloadImagesArchive = async (images) => {
    const contents = await createImageArchive(images);
    const objectUrl = URL.createObjectURL(new Blob([contents], { type: 'application/zip' }));
    try {
        triggerAnchorDownload(objectUrl, 'jnm-bilder.zip');
        haptic('save');
    } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    }
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
