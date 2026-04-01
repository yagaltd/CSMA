import { AIProvider } from './AIProvider.js';

const JSON_MIME = 'application/json';
const DEFAULT_ENDPOINT = '/chat/completions';

function joinUrl(baseUrl, endpoint) {
    const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
    const normalizedEndpoint = String(endpoint || DEFAULT_ENDPOINT).startsWith('/')
        ? endpoint
        : `/${endpoint}`;
    return `${normalizedBase}${normalizedEndpoint}`;
}

function buildMessages(params = {}) {
    if (Array.isArray(params.messages) && params.messages.length > 0) {
        return params.messages.map((message) => ({
            role: message.role,
            content: message.content || message.message || ''
        }));
    }

    const messages = [];
    if (params.system) {
        messages.push({ role: 'system', content: params.system });
    }
    if (params.prompt) {
        messages.push({ role: 'user', content: params.prompt });
    }
    return messages;
}

function buildHeaders(headers = {}, apiKey = '') {
    return {
        'Content-Type': JSON_MIME,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...headers
    };
}

function estimateTokens(text = '') {
    return Math.ceil(String(text).length / 4);
}

async function readSSEStream(response, onChunk) {
    const reader = response.body?.getReader?.();
    if (!reader) {
        return '';
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        parts.forEach((part) => {
            const lines = part.split('\n').map((line) => line.trim()).filter(Boolean);
            lines.forEach((line) => {
                if (!line.startsWith('data:')) {
                    return;
                }

                const payloadText = line.slice(5).trim();
                if (!payloadText || payloadText === '[DONE]') {
                    return;
                }

                try {
                    const payload = JSON.parse(payloadText);
                    const chunk = payload?.choices?.[0]?.delta?.content
                        || payload?.choices?.[0]?.message?.content
                        || payload?.text
                        || '';
                    if (chunk) {
                        text += chunk;
                    }
                    onChunk?.({
                        text: chunk,
                        done: false,
                        meta: payload,
                        raw: payloadText
                    });
                } catch (error) {
                    text += payloadText;
                    onChunk?.({
                        text: payloadText,
                        done: false,
                        raw: payloadText
                    });
                }
            });
        });
    }

    if (buffer.trim()) {
        buffer
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('data:'))
            .forEach((line) => {
                const payloadText = line.slice(5).trim();
                if (!payloadText || payloadText === '[DONE]') {
                    return;
                }

                try {
                    const payload = JSON.parse(payloadText);
                    const chunk = payload?.choices?.[0]?.delta?.content
                        || payload?.choices?.[0]?.message?.content
                        || payload?.text
                        || '';
                    if (chunk) {
                        text += chunk;
                    }
                    onChunk?.({
                        text: chunk,
                        done: true,
                        meta: payload,
                        raw: payloadText
                    });
                } catch (error) {
                    text += payloadText;
                    onChunk?.({
                        text: payloadText,
                        done: true,
                        raw: payloadText
                    });
                }
            });
    }

    return text;
}

export class OpenAICompatibleProvider extends AIProvider {
    constructor(options = {}) {
        super();
        this.baseUrl = options.baseUrl || '';
        this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
        this.apiKey = options.apiKey || '';
        this.model = options.model || options.defaultModel || '';
        this.headers = options.headers || {};
        this.fetchImpl = options.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    async isAvailable() {
        return Boolean(this.fetchImpl && this.baseUrl && this.apiKey && this.model);
    }

    get priority() {
        return 60;
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
            throw new Error('OpenAICompatibleProvider requires fetch');
        }

        const url = joinUrl(params.baseUrl || this.baseUrl, params.endpoint || this.endpoint);
        const model = params.model || this.model;
        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: buildHeaders({
                ...(params.headers || {}),
                ...this.headers
            }, params.apiKey || this.apiKey),
            body: JSON.stringify({
                model,
                messages: buildMessages(params),
                stream: Boolean(params.stream),
                temperature: params.temperature,
                max_tokens: params.maxTokens
            })
        });

        if (!response.ok) {
            let details = `${response.status}`;
            try {
                const errorBody = await response.json();
                details = errorBody?.error?.message || JSON.stringify(errorBody);
            } catch (error) {
                // keep status text fallback
            }
            throw new Error(`OpenAI-compatible API error: ${details}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (params.stream && contentType.includes('text/event-stream')) {
            const text = await readSSEStream(response, params.onStream);
            return {
                text,
                tokensUsed: estimateTokens(text),
                cost: 0,
                model
            };
        }

        const payload = await response.json();
        const text = payload?.choices?.[0]?.message?.content
            || payload?.choices?.[0]?.text
            || payload?.text
            || '';

        if (params.stream && text) {
            params.onStream?.({
                text,
                done: true,
                meta: payload,
                raw: JSON.stringify(payload)
            });
        }

        return {
            text,
            tokensUsed: payload?.usage?.total_tokens || estimateTokens(text),
            cost: 0,
            model
        };
    }
}
