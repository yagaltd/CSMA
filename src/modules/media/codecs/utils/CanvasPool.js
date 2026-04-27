/**
 * CanvasPool — OffscreenCanvas reuse with Safari memory cleanup
 * and per-browser max-size clamping.
 *
 * Safari (WebKit #195325): canvas memory is not released until GC.
 * Workaround: zero width/height after use and let the pool hand out
 * fresh canvases.
 */

const MAX_SIZES = {
    chrome: 65536,
    firefox: 32767,
    safari: 16384,
    ios: 4096,
    unknown: 4096
};

let detectedMax = null;

/**
 * Detect the browser's maximum canvas dimension.
 * @returns {number}
 */
function detectMaxSize() {
    if (detectedMax !== null) return detectedMax;

    // User-agent heuristics
    if (typeof navigator === 'undefined') {
        detectedMax = MAX_SIZES.unknown;
        return detectedMax;
    }

    const ua = navigator.userAgent || '';

    if (/iPhone|iPad|iPod/.test(ua)) {
        detectedMax = MAX_SIZES.ios;
    } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
        detectedMax = MAX_SIZES.safari;
    } else if (/Firefox\//.test(ua)) {
        detectedMax = MAX_SIZES.firefox;
    } else {
        detectedMax = MAX_SIZES.chrome;
    }

    return detectedMax;
}

/**
 * Clamp dimensions to browser canvas max.
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number }}
 */
export function clampDimensions(width, height) {
    const max = detectMaxSize();
    if (width <= max && height <= max) return { width, height };

    const ratio = Math.min(max / width, max / height);
    return {
        width: Math.floor(width * ratio),
        height: Math.floor(height * ratio)
    };
}

/**
 * Create an OffscreenCanvas (Tier 1/2) or HTMLCanvasElement (Tier 3).
 * @param {number} width
 * @param {number} height
 * @returns {{ canvas: OffscreenCanvas|HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
 */
export function acquireCanvas(width, height) {
    const clamped = clampDimensions(width, height);

    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(clamped.width, clamped.height);
        const ctx = canvas.getContext('2d');
        return { canvas, ctx };
    }

    if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = clamped.width;
        canvas.height = clamped.height;
        const ctx = canvas.getContext('2d');
        return { canvas, ctx };
    }

    throw new Error('No canvas API available');
}

/**
 * Release a canvas. Safari cleanup: zero width/height to free GPU memory.
 * @param {OffscreenCanvas|HTMLCanvasElement} canvas
 */
export function releaseCanvas(canvas) {
    try {
        canvas.width = 0;
        canvas.height = 0;
    } catch (_) {
        // OffscreenCanvas may not allow zeroing — ignore
    }
}

/**
 * Get the detected browser max canvas dimension.
 * @returns {number}
 */
export function getMaxCanvasSize() {
    return detectMaxSize();
}
