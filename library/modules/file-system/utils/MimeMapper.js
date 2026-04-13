const EXTENSION_MAP = new Map([
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.webp', 'image/webp'],
    ['.avif', 'image/avif'],
    ['.svg', 'image/svg+xml'],
    ['.txt', 'text/plain'],
    ['.md', 'text/markdown'],
    ['.json', 'application/json'],
    ['.pdf', 'application/pdf'],
    ['.zip', 'application/zip'],
    ['.mp4', 'video/mp4'],
    ['.webm', 'video/webm'],
    ['.mp3', 'audio/mpeg'],
    ['.wav', 'audio/wav']
]);

export function detectMimeType(fileName = '', fallback = 'application/octet-stream') {
    if (!fileName || typeof fileName !== 'string') {
        return fallback;
    }

    const lower = fileName.toLowerCase();
    const dotIndex = lower.lastIndexOf('.');
    if (dotIndex === -1) {
        return fallback;
    }

    const ext = lower.slice(dotIndex);
    return EXTENSION_MAP.get(ext) || fallback;
}
