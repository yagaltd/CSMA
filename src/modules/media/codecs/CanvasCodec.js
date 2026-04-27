/**
 * CanvasCodec — base image codec using browser Canvas API.
 *
 * Pipeline:
 *   Blob → ImageBitmap/Image → OffscreenCanvas → convertToBlob
 *
 * All format-specific codecs extend this class.
 */

import { blobToImageSource, canvasToBlob } from './utils/BlobUtils.js';
import { acquireCanvas, releaseCanvas } from './utils/CanvasPool.js';
import { getOrientation } from './exif/ExifReader.js';
import { applyOrientation } from './exif/ExifOrientation.js';
import { calculateDimensions } from './resize/CanvasResize.js';

export class CanvasCodec {
    /**
     * @param {object} config
     * @param {string} config.mimeType
     * @param {number} [config.defaultQuality=0.85]
     */
    constructor({ mimeType, defaultQuality = 0.85 }) {
        this.mimeType = mimeType;
        this.defaultQuality = defaultQuality;
    }

    /**
     * Encode a blob to this codec's format.
     *
     * @param {Blob} blob — source image
     * @param {object} [options]
     * @param {number} [options.quality] — 0–1, overrides default
     * @param {object} [options.resize] — resize constraints
     * @returns {Promise<{ blob: Blob, metadata: object }>}
     */
    async encode(blob, options = {}) {
        const quality = options.quality ?? this.defaultQuality;

        // Step 1: Load image source
        const source = await blobToImageSource(blob);
        const sourceW = source.width;
        const sourceH = source.height;

        // Step 2: Read EXIF orientation (JPEG only)
        const orientation = await this.#readOrientation(blob);

        // Step 3: Calculate dimensions (resize + EXIF rotation may swap)
        const preRotateW = orientation >= 5 ? sourceH : sourceW;
        const preRotateH = orientation >= 5 ? sourceW : sourceH;
        const { width, height } = calculateDimensions(preRotateW, preRotateH, options.resize);

        // Step 4: Create canvas and draw
        const { canvas, ctx } = acquireCanvas(width, height);

        // Pre-transform: apply EXIF orientation if needed
        if (orientation !== 1) {
            ctx.save();
            applyOrientation(canvas, ctx, orientation, sourceW, sourceH);
            ctx.drawImage(source, 0, 0, sourceW, sourceH);
            ctx.restore();
        } else {
            ctx.drawImage(source, 0, 0, width, height);
        }

        // Step 5: Encode
        const encoded = await canvasToBlob(canvas, this.mimeType, quality);

        // Step 6: Cleanup
        releaseCanvas(canvas);
        if (source.close) source.close(); // ImageBitmap cleanup

        return {
            blob: encoded,
            metadata: {
                width,
                height,
                originalWidth: sourceW,
                originalHeight: sourceH,
                mimeType: this.mimeType,
                quality,
                orientation,
                size: encoded.size
            }
        };
    }

    /**
     * Decode a blob to an ImageBitmap.
     * @param {Blob} blob
     * @returns {Promise<ImageBitmap>}
     */
    async decode(blob) {
        const source = await blobToImageSource(blob);
        return source;
    }

    /**
     * Read EXIF orientation from a blob, if JPEG.
     * @param {Blob} blob
     * @returns {Promise<number>}
     */
    async #readOrientation(blob) {
        if (blob.type && !blob.type.startsWith('image/jpeg')) return 1;
        try {
            const buffer = await blob.arrayBuffer();
            return getOrientation(buffer);
        } catch (_) {
            return 1;
        }
    }
}
