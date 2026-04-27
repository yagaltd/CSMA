/**
 * WebpCodec — WebP encoder. Primary optimization target.
 * Extends CanvasCodec with WebP defaults.
 */

import { CanvasCodec } from './CanvasCodec.js';

export class WebpCodec extends CanvasCodec {
    constructor() {
        super({ mimeType: 'image/webp', defaultQuality: 0.85 });
    }
}
