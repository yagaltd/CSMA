/**
 * EXIF Reader tests — orientation parsing from JPEG buffers.
 */
import { describe, it, expect } from 'vitest';
import { getOrientation } from '../src/modules/media/codecs/exif/ExifReader.js';

describe('ExifReader', () => {
    it('returns 1 for non-JPEG data', () => {
        const buffer = new ArrayBuffer(10);
        const view = new DataView(buffer);
        view.setUint16(0, 0x8950); // PNG signature start
        expect(getOrientation(buffer)).toBe(1);
    });

    it('returns 1 for empty buffer', () => {
        expect(getOrientation(new ArrayBuffer(0))).toBe(1);
    });

    it('returns 1 for JPEG without EXIF', () => {
        // SOI + EOI only
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setUint16(0, 0xFFD8); // SOI
        view.setUint16(2, 0xFFD9); // EOI
        expect(getOrientation(buffer)).toBe(1);
    });

    it('returns 1 for JPEG with EXIF orientation 1', () => {
        const buffer = createJpegWithOrientation(1);
        expect(getOrientation(buffer)).toBe(1);
    });

    it('reads orientation 3 (rotate 180)', () => {
        const buffer = createJpegWithOrientation(3);
        expect(getOrientation(buffer)).toBe(3);
    });

    it('reads orientation 6 (rotate 90 CW)', () => {
        const buffer = createJpegWithOrientation(6);
        expect(getOrientation(buffer)).toBe(6);
    });

    it('reads orientation 8 (rotate 90 CCW)', () => {
        const buffer = createJpegWithOrientation(8);
        expect(getOrientation(buffer)).toBe(8);
    });

    it('reads orientation 2 (flip horizontal)', () => {
        const buffer = createJpegWithOrientation(2);
        expect(getOrientation(buffer)).toBe(2);
    });
});

/**
 * Build a minimal JPEG buffer with EXIF orientation tag.
 * Structure: SOI + APP1 (with EXIF + IFD0 orientation) + SOS
 */
function createJpegWithOrientation(orientation) {
    // Build EXIF APP1 segment
    const exifHeader = stringToBytes('Exif\0\0');

    // TIFF header: little-endian ("II"), magic 42, IFD0 offset = 8
    const tiffHeader = new Uint8Array(8);
    const tv = new DataView(tiffHeader.buffer);
    tv.setUint16(0, 0x4949, true);  // "II" little-endian
    tv.setUint16(2, 42, true);      // TIFF magic
    tv.setUint32(4, 8, true);       // IFD0 offset from TIFF start

    // IFD0: 1 entry, orientation tag
    const ifd0 = new Uint8Array(2 + 12 + 4); // count + 1 entry + next IFD offset
    const iv = new DataView(ifd0.buffer);
    iv.setUint16(0, 1, true);       // 1 entry
    // Entry: tag=0x0112, type=3 (SHORT), count=1, value=orientation
    iv.setUint16(2, 0x0112, true);  // tag
    iv.setUint16(4, 3, true);       // type SHORT
    iv.setUint32(6, 1, true);       // count
    iv.setUint16(10, orientation, true); // value
    iv.setUint16(12, 0, true);      // padding
    iv.setUint32(14, 0, true);      // next IFD offset = 0 (no IFD1)

    const app1Payload = concat(exifHeader, tiffHeader, ifd0);
    const app1Size = app1Payload.length + 2; // +2 for size field itself

    // APP1 segment
    const app1 = new Uint8Array(2 + 2 + app1Payload.length);
    const av = new DataView(app1.buffer);
    av.setUint16(0, 0xFFE1);        // APP1 marker
    av.setUint16(2, app1Size);      // segment size
    app1.set(app1Payload, 4);

    // SOS marker (signals end of metadata scanning)
    const sos = new Uint8Array(2);
    new DataView(sos.buffer).setUint16(0, 0xFFDA);

    // SOI + APP1 + SOS
    const soi = new Uint8Array([0xFF, 0xD8]);
    return concat(soi, app1, sos).buffer;
}

function stringToBytes(str) {
    return new Uint8Array(Array.from(str).map(c => c.charCodeAt(0)));
}

function concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
        result.set(a, offset);
        offset += a.length;
    }
    return result;
}
