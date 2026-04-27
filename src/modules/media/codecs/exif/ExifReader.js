/**
 * ExifReader — parse JPEG EXIF orientation tag (0x0112) from ArrayBuffer.
 *
 * JPEG structure:
 *   SOI (0xFFD8)
 *   APP1 (0xFFE1) — EXIF data
 *     "Exif\0\0" header
 *     TIFF header (byte order, IFD0 offset)
 *     IFD0 entries — orientation is tag 0x0112
 *
 * @param {ArrayBuffer} buffer
 * @returns {number} orientation value 1–8, or 1 if not found
 */
export function getOrientation(buffer) {
    try {
        const view = new DataView(buffer);

        // Validate SOI marker
        if (view.getUint16(0) !== 0xFFD8) return 1;

        let offset = 2;
        const length = view.byteLength;

        while (offset < length - 1) {
            const marker = view.getUint16(offset);

            // SOS marker — no more APP segments
            if (marker === 0xFFDA) return 1;

            // Not a marker
            if ((marker & 0xFF00) !== 0xFF00) return 1;

            const segmentSize = view.getUint16(offset + 2);

            // APP1 segment
            if (marker === 0xFFE1) {
                return readOrientationFromApp1(view, offset + 4, segmentSize);
            }

            offset += 2 + segmentSize;
        }
    } catch (_) {
        // Malformed EXIF — treat as default orientation
    }

    return 1;
}

/**
 * Read orientation from an APP1 segment payload.
 * @param {DataView} view
 * @param {number} start — first byte after marker + length
 * @param {number} segmentSize
 * @returns {number}
 */
function readOrientationFromApp1(view, start, segmentSize) {
    const end = start + segmentSize - 2;

    // Check "Exif\0\0" header
    if (end - start < 6) return 1;
    const exifHeader = String.fromCharCode(
        view.getUint8(start),
        view.getUint8(start + 1),
        view.getUint8(start + 2),
        view.getUint8(start + 3)
    );
    if (exifHeader !== 'Exif') return 1;

    const tiffStart = start + 6;

    // TIFF byte order
    const byteOrder = view.getUint16(tiffStart);
    const littleEndian = byteOrder === 0x4949; // "II"

    // IFD0 offset
    const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
    const ifd0Start = tiffStart + ifd0Offset;

    // Number of IFD0 entries
    if (ifd0Start + 2 > view.byteLength) return 1;
    const entryCount = view.getUint16(ifd0Start, littleEndian);

    // Scan entries for orientation tag (0x0112)
    for (let i = 0; i < entryCount; i++) {
        const entryOffset = ifd0Start + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) return 1;

        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag === 0x0112) {
            const value = view.getUint16(entryOffset + 8, littleEndian);
            return value >= 1 && value <= 8 ? value : 1;
        }
    }

    return 1;
}
