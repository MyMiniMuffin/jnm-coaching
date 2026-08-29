const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_SIZE = 20 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 3.5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Kunne ikke komprimere bildet.'));
    }, 'image/jpeg', quality);
});

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Kunne ikke lese det komprimerte bildet.'));
    reader.readAsDataURL(blob);
});

const loadImage = async (file) => {
    if ('createImageBitmap' in window) {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            return {
                width: bitmap.width,
                height: bitmap.height,
                draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
                close: () => bitmap.close(),
            };
        } catch {
            // Bruk Image-element som reserve for eldre nettlesere og bildeformater.
        }
    }

    const objectUrl = URL.createObjectURL(file);
    let image;
    try {
        image = await new Promise((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error('Bildet kunne ikke åpnes.'));
            element.src = objectUrl;
        });
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
    }
    return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
        close: () => URL.revokeObjectURL(objectUrl),
    };
};

export const validateOnboardingImage = (file) => {
    if (!file) return null;
    if (!SUPPORTED_TYPES.has(file.type)) return 'Bildet må være i JPG-, PNG- eller WebP-format.';
    if (file.size > MAX_SOURCE_SIZE) return 'Originalbildet er for stort. Velg et bilde under 20 MB.';
    return null;
};

export const prepareOnboardingImage = async (file) => {
    const validationError = validateOnboardingImage(file);
    if (validationError) throw new Error(validationError);

    const source = await loadImage(file);
    try {
        let scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
        let quality = 0.84;
        let blob;

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const width = Math.max(1, Math.round(source.width * scale));
            const height = Math.max(1, Math.round(source.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('Nettleseren kunne ikke behandle bildet.');

            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            source.draw(context, width, height);
            blob = await canvasToBlob(canvas, quality);

            if (blob.size <= MAX_UPLOAD_SIZE) break;
            scale *= 0.82;
            quality = Math.max(0.62, quality - 0.06);
        }

        if (!blob || blob.size > MAX_UPLOAD_SIZE) {
            throw new Error('Bildet kunne ikke komprimeres nok. Velg et mindre bilde.');
        }

        return blobToDataUrl(blob);
    } finally {
        source.close();
    }
};

export const uploadOnboardingImage = async ({ file, position, botField = '' }) => {
    const image = await prepareOnboardingImage(file);
    const response = await fetch('/api/onboarding-image-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, position, botField }),
    });

    let data;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Bildet kunne ikke lastes opp. Prøv igjen.');
    }

    return data;
};
