import { AIProvider } from './AIProvider.js';

const JSON_MIME = 'application/json';
const DEFAULT_QUERY_NAME = 'ai.generate';

function headersWithJson(headers = {}) {
    return {
        'Content-Type': JSON_MIME,
        ...headers
    };
}

function buildQueryEndpoint(queryName) {
    return `/query/${encodeURIComponent(queryName)}`;
}

function buildQueryStreamEndpoint(queryName) {
    return `/query/${encodeURIComponent(queryName)}/stream`;
}

function buildPayload(params = {}) {
    return {
        system: params.system,
        prompt: params.prompt,
        messages: params.messages,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
        stream: Boolean(params.stream)
    };
}

async function readStream(response, onChunk) {
    const reader = response.body?.getReader?.();
    if (!reader) {
        return '';
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return;
            }

            const normalized = trimmed.startsWith('data:')
                ? trimmed.slice(5).trim()
                : trimmed;

            try {
                const payload = JSON.parse(normalized);
                const chunk = payload.delta || payload.chunk || payload.text || '';
                if (chunk) {
                    output += chunk;
                    onChunk?.({ text: chunk, done: false, meta: payload });
                }
            } catch (error) {
                output += normalized;
                onChunk?.({ text: normalized, done: false });
            }
        });
    }

    if (buffer.trim()) {
        const normalized = buffer.trim().replace(/^data:\s*/, '');
        try {
            const payload = JSON.parse(normalized);
            const chunk = payload.delta || payload.chunk || payload.text || '';
            if (chunk) {
                output += chunk;
                onChunk?.({ text: chunk, done: true, meta: payload });
            }
        } catch (error) {
            output += normalized;
            onChunk?.({ text: normalized, done: true });
        }
    }

    return output;
}

export class SSMAGatewayProvider extends AIProvider {
    constructor(options = {}) {
        super();
        this.queryName = options.queryName || DEFAULT_QUERY_NAME;
        this.endpoint = options.endpoint || buildQueryEndpoint(this.queryName);
        this.streamEndpoint = options.streamEndpoint || buildQueryStreamEndpoint(this.queryName);
        this.fetchImpl = options.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        this.headers = options.headers || {};
    }

    async isAvailable() {
        return Boolean(this.fetchImpl && this.endpoint);
    }

    get priority() {
        return 75;
    }

    getCapabilities() {
        return {
            generateText: true,
            summarize: true,
            classify: true,
            transcribe: false,
            ocr: false
        };
    }

    async generateText(params = {}) {
        if (!this.fetchImpl) {
            throw new Error('SSMAGatewayProvider requires fetch');
        }

        const endpoint = params.stream ? (this.streamEndpoint || this.endpoint) : this.endpoint;
        const response = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: headersWithJson(this.headers),
            body: JSON.stringify({
                payload: buildPayload(params)
            })
        });

        if (!response.ok) {
            throw new Error(`SSMA gateway error: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (params.stream && (contentType.includes('application/x-ndjson') || contentType.includes('text/event-stream'))) {
            const text = await readStream(response, params.onStream);
            return {
                text,
                tokensUsed: Math.ceil(text.length / 4),
                cost: 0
            };
        }

        const payload = await response.json();
        const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
        if (params.stream && Array.isArray(data.chunks)) {
            data.chunks.forEach((chunk) => {
                params.onStream?.({ text: chunk, done: false });
            });
        } else if (params.stream && data.text) {
            params.onStream?.({ text: data.text, done: true });
        }

        return {
            text: data.text || '',
            tokensUsed: data.tokensUsed || Math.ceil((data.text || '').length / 4),
            cost: data.cost || 0
        };
    }
}
