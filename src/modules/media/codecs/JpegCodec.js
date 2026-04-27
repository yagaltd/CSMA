/**
 * JpegCodec — JPEG encoder with white background fill.
 *
 * Extends CanvasCodec. JPEG has no alpha channel, so transparent pixels
 * must become white before encoding.
 *
 * EXIF orientation is handled by the base CanvasCodec.
 */

import { CanvasCodec } from './CanvasCodec.js';
import { blobToImageSource, canvasToBlob } from './utils/BlobUtils.js';
import { acquireCanvas, releaseCanvas } from './utils/CanvasPool.js';
import { getOrientation } from './exif/ExifReader.js';
import { applyOrientation } from './exif/ExifOrientation.js';
import { calculateDimensions } from './resize/CanvasResize.js';

export class JpegCodec extends CanvasCodec {
    constructor() {
        super({ mimeType: 'image/jpeg', defaultQuality: 0.92 });
    }

    async encode(blob, options = {}) {
        const quality = options.quality ?? this.defaultQuality;
        const source = await blobToImageSource(blob);
        const sourceW = source.width;
        const sourceH = source.height;
        const orientation = await this.#readOrientation(blob);

        const preRotateW = orientation >= 5 ? sourceH : sourceW;
        const preRotateH = orientation >= 5 ? sourceW : sourceH;
        const { width, height } = calculateDimensions(preRotateW, preRotateH, options.resize);

        const { canvas, ctx } = acquireCanvas(width, height);

        // White background — JPEG has no alpha
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        if (orientation !== 1) {
            ctx.save();
            applyOrientation(canvas, ctx, orientation, sourceW, sourceH);
            ctx.drawImage(source, 0, 0, sourceW, sourceH);
            ctx.restore();
        } else {
            ctx.drawImage(source, 0, 0, width, height);
        }

        const encoded = await canvasToBlob(canvas, this.mimeType, quality);
        releaseCanvas(canvas);
        if (source.close) source.close();

        return {
            blob: encoded,
            metadata: {
                width, height,
                originalWidth: sourceW,
                originalHeight: sourceH,
                mimeType: this.mimeType,
                quality, orientation,
                size: encoded.size
            }
        };
    }

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
