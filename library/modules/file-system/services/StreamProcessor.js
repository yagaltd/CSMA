export class StreamProcessor {
    ensureReadable(blob) {
        if (!blob) {
            throw new Error('Readable source required');
        }

        if (blob.stream) {
            return blob.stream();
        }

        if (typeof ReadableStream !== 'undefined') {
            return new ReadableStream({
                start(controller) {
                    controller.enqueue(blob);
                    controller.close();
                }
            });
        }

        throw new Error('Streaming is not supported in this environment');
    }

    async toBlob(input, mimeType = 'application/octet-stream') {
        if (!input) {
            throw new Error('File input is required');
        }

        if (input instanceof Blob) {
            return input;
        }

        if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
            return new Blob([input], { type: mimeType });
        }

        if (typeof input === 'string') {
            return new Blob([input], { type: mimeType || 'text/plain' });
        }

        if (input instanceof ReadableStream) {
            const response = new Response(input);
            return response.blob();
        }

        if (typeof Response !== 'undefined' && input instanceof Response) {
            return input.blob();
        }

        throw new Error('Unsupported file input type');
    }
}
