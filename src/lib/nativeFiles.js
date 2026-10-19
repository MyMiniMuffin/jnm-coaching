import { Capacitor } from '@capacitor/core';

// The iOS share sheet lets the user save to Files/Photos or share the export.
// Cache files are removed after the share sheet closes, including cancellation.
export const shareNativeFile = async (blob, filename) => {
    if (!Capacitor.isNativePlatform()) return false;
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share')
    ]);
    const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Kunne ikke klargjøre filen'));
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(blob);
    });
    const path = `exports/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const file = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
    try {
        await Share.share({ files: [file.uri] });
    } finally {
        await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
    }
    return true;
};
