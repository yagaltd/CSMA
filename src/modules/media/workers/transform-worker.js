/**
 * transform-worker.js — Web Worker entry for image encoding.
 *
 * Receives { ab, type, format, quality, resize } where ab is an
 * ArrayBuffer (transferred, zero-copy).
 *
 * Reconstructs Blob, runs the appropriate codec, transfers the
 * result ArrayBuffer back.
 *
 * Self-terminates after 60s idle.
 */

let idleTimer = null;

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => self.close(), 60000);
}

// Codec instances — lazy initialized
const codecCache = new Map();

async function getCodec(format) {
    if (codecCache.has(format)) return codecCache.get(format);

    let CodecClass;
    switch (format) {
        case 'image/webp':
            ({ WebpCodec: CodecClass } = await import('../codecs/WebpCodec.js'));
            break;
        case 'image/jpeg':
            ({ JpegCodec: CodecClass } = await import('../codecs/JpegCodec.js'));
            break;
        case 'image/png':
            ({ PngCodec: CodecClass } = await import('../codecs/PngCodec.js'));
            break;
        default:
            throw new Error(`Unsupported format: ${format}`);
    }

    const codec = new CodecClass();
    codecCache.set(format, codec);
    return codec;
}

self.onmessage = async (event) => {
    resetIdleTimer();

    const { ab, type, format, quality, resize } = event.data;

    try {
        // Reconstruct blob from transferred ArrayBuffer
        const blob = new Blob([ab], { type });

        // Get codec and encode
        const codec = await getCodec(format);
        const result = await codec.encode(blob, { quality, resize });

        // Transfer result ArrayBuffer back
        const resultAb = await result.blob.arrayBuffer();

        self.postMessage(
            {
                ab: resultAb,
                type: result.blob.type,
                metadata: result.metadata
            },
            [resultAb]
        );
    } catch (error) {
        self.postMessage({
            error: error.message || String(error)
        });
    }
};

resetIdleTimer();
