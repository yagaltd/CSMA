/**
 * CanvasResize — dimension-constrained resize via canvas drawImage scaling.
 *
 * Supports:
 *   - maxWidth/maxHeight: scale down if exceeded, maintain aspect ratio
 *   - width/height: exact dimensions (may distort if both set without maintainAspect)
 *   - maintainAspect: default true
 */

import { clampDimensions } from '../utils/CanvasPool.js';

/**
 * Calculate target dimensions respecting constraints.
 * @param {number} sourceW
 * @param {number} sourceH
 * @param {object} options
 * @returns {{ width: number, height: number }}
 */
export function calculateDimensions(sourceW, sourceH, options = {}) {
    const {
        width,
        height,
        maxWidth,
        maxHeight,
        maintainAspect = true
    } = options;

    let targetW = sourceW;
    let targetH = sourceH;

    // Exact dimensions
    if (width && height && !maintainAspect) {
        targetW = width;
        targetH = height;
    } else if (width || height) {
        // One dimension specified, or both with aspect ratio
        const ratio = sourceW / sourceH;
        if (width && !height) {
            targetW = width;
            targetH = Math.round(width / ratio);
        } else if (height && !width) {
            targetH = height;
            targetW = Math.round(height * ratio);
        } else {
            // Both specified with maintainAspect — fit within
            const scaleW = width / sourceW;
            const scaleH = height / sourceH;
            const scale = Math.min(scaleW, scaleH, 1); // never upscale
            targetW = Math.round(sourceW * scale);
            targetH = Math.round(sourceH * scale);
        }
    }

    // Max constraints (scale down only)
    if (maxWidth && targetW > maxWidth) {
        const scale = maxWidth / targetW;
        targetW = maxWidth;
        targetH = Math.round(targetH * scale);
    }
    if (maxHeight && targetH > maxHeight) {
        const scale = maxHeight / targetH;
        targetH = maxHeight;
        targetW = Math.round(targetW * scale);
    }

    // Clamp to browser max
    return clampDimensions(targetW, targetH);
}
