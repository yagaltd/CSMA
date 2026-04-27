/**
 * PngCodec — PNG encoder. Lossless, quality param ignored.
 * Extends CanvasCodec with PNG defaults.
 */

import { CanvasCodec } from './CanvasCodec.js';

export class PngCodec extends CanvasCodec {
    constructor() {
        super({ mimeType: 'image/png', defaultQuality: 1 });
    }
}
