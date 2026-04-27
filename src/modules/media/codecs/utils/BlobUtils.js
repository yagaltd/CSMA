/**
 * BlobUtils — shared blob/ImageBitmap/canvas conversion helpers.
 *
 * Three tiers of browser support are handled:
 *   Tier 1: createImageBitmap + OffscreenCanvas.convertToBlob
 *   Tier 2: createImageBitmap + OffscreenCanvas.convertToBlob (main thread only)
 *   Tier 3: Image element + HTMLCanvasElement.toDataURL
 */

/**
 * Convert a Blob to an ImageBitmap.
 * Falls back to loading via an Image element + canvas for browsers
 * where createImageBitmap is unavailable or buggy (older iOS Safari).
 *
 * @param {Blob} blob
 * @returns {Promise<ImageBitmap|HTMLImageElement>}
 */
export async function blobToImageSource(blob) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(blob);
        } catch (_) {
            // Fall through to Image element fallback
        }
    }
    return blobToImageViaElement(blob);
}

/**
 * Load a Blob as an HTMLImageElement via Object URL.
 * @param {Blob} blob
 * @returns {Promise<HTMLImageElement>}
 */
export function blobToImageViaElement(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image from blob'));
        };
        img.src = url;
    });
}

/**
 * Encode a canvas (OffscreenCanvas or HTMLCanvasElement) to a Blob.
 * Uses OffscreenCanvas.convertToBlob when available, otherwise falls back
 * to HTMLCanvasElement.toDataURL with base64 decode.
 *
 * @param {OffscreenCanvas|HTMLCanvasElement} canvas
 * @param {string} mimeType
 * @param {number} quality 0–1
 * @returns {Promise<Blob>}
 */
export async function canvasToBlob(canvas, mimeType, quality) {
    // OffscreenCanvas.convertToBlob
    if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
        try {
            return await canvas.convertToBlob({ type: mimeType, quality });
        } catch (_) {
            // Fall through
        }
    }

    // HTMLCanvasElement.toBlob (avoids base64 overhead)
    if (typeof canvas.toBlob === 'function') {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
                mimeType,
                quality
            );
        });
    }

    // Last resort: toDataURL + base64 decode
    return dataURLToBlob(canvas.toDataURL(mimeType, quality));
}

/**
 * Convert a data URL string to a Blob.
 * @param {string} dataURL
 * @returns {Blob}
 */
export function dataURLToBlob(dataURL) {
    const [header, base64] = dataURL.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
}
