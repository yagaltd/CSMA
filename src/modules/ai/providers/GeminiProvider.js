import { AIProvider } from './AIProvider.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const JSON_MIME = 'application/json';

export class GeminiProvider extends AIProvider {
    constructor(options = {}) {
        super();
        this.apiKey = options.apiKey || null;
        this.model = options.model || DEFAULT_MODEL;
        this.fetchImpl = options.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        this.fileSizeLimit = options.fileSizeLimit || 18.5 * 1024 * 1024; // ~18.5MB inline limit
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    async isAvailable() {
        return Boolean(this.apiKey && this.fetchImpl);
    }

    get priority() {
        return 50;
    }

    getCapabilities() {
        return {
            generateText: true,
            summarize: true,
            classify: true,
            transcribe: true,
            ocr: true
        };
    }

    async generateText(params = {}) {
        await this._requireApiKey();
        const body = this._buildTextRequest(params);
        const data = await this._request('generateContent', body, params);
        const text = this._extractText(data);

        if (params.stream && typeof params.onStream === 'function' && text) {
            params.onStream({ text, done: true });
        }

        return {
            text,
            tokensUsed: this._estimateTokens(text),
            cost: this._estimateCost(text, params)
        };
    }

    async summarize(text, options = {}) {
        return this.generateText({
            ...options,
            prompt: this._buildSummaryPrompt(text, options)
        });
    }

    async classify(text, options = {}) {
        await this._requireApiKey();
        const classificationPrompt = this._buildClassificationPrompt(text, options);
        const body = {
            contents: [{
                parts: [{ text: classificationPrompt }]
            }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: JSON_MIME,
                responseSchema: this._classificationSchema()
            }
        };

        const data = await this._request('generateContent', body, options);
        const payload = this._extractText(data);
        try {
            return JSON.parse(payload);
        } catch (error) {
            return {
                category: 'reference',
                tags: [],
                reasoning: payload
            };
        }
    }

    async transcribe(input, options = {}) {
        await this._requireApiKey();

        const blob = await this._toBlob(input);
        if (!blob) {
            throw new Error('GeminiProvider.transcribe requires a Blob or File');
        }

        if (blob.size > this.fileSizeLimit) {
            throw new Error('GeminiProvider currently supports inline uploads up to ~18MB');
        }

        const base64 = await this._blobToBase64(blob);
        const prompt = this._constructPrompt(options.prompt, options.tagVocabulary);
        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: blob.type || 'audio/webm',
                            data: base64
                        }
                    }
                ]
            }],
            generationConfig: this._jsonOutputSchema()
        };

        const data = await this._request('generateContent', body, options);
        const payload = this._extractText(data);
        return this._safeJson(payload);
    }

    async ocr(blob, options = {}) {
        return this.transcribe(blob, {
            ...options,
            prompt: options.prompt || 'Extract all text from this image and describe it succinctly.'
        });
    }

    _buildTextRequest(params) {
        const system = params.system || 'You are a helpful assistant.';
        const prompt = params.prompt || 'Respond to the user request.';
        const parts = [{ text: `${system}\n\n${prompt}` }];

        return {
            contents: [{ parts }],
            generationConfig: {
                temperature: params.temperature ?? 0.7,
                maxOutputTokens: params.maxTokens ?? 512
            }
        };
    }

    _buildSummaryPrompt(text, options) {
        const maxLength = options.maxLength || 280;
        return `${options.context || ''}\nSummarize the following text in <= ${maxLength} characters:\n${text}`;
    }

    _buildClassificationPrompt(text, options) {
        const categories = options.categories || ['task', 'idea', 'reference', 'personal', 'meeting'];
        const tags = (options.existingTags || []).slice(0, 50).join(', ');
        return `Classify the following note into one of: ${categories.join(', ')}.\nReuse tags when possible.\nExisting tags: ${tags}\nReturn JSON with {"category","tags","importance"}.\nNote:\n${text}`;
    }

    _classificationSchema() {
        return {
            type: 'OBJECT',
            properties: {
                category: { type: 'STRING' },
                tags: { type: 'ARRAY', items: { type: 'STRING' } },
                importance: { type: 'NUMBER' },
                reasoning: { type: 'STRING' }
            },
            required: ['category', 'tags']
        };
    }

    _jsonOutputSchema() {
        return {
            type: 'OBJECT',
            properties: {
                text: { type: 'STRING' },
                category: { type: 'STRING' },
                tags: { type: 'ARRAY', items: { type: 'STRING' } }
            },
            required: ['text']
        };
    }

    _constructPrompt(basePrompt, tagVocabulary = {}) {
        const tagList = Object.keys(tagVocabulary);
        const header = 'You are an expert transcriber and classifier. Return JSON with {"text","category","tags"}.';
        if (!basePrompt) {
            return tagList.length ? `${header}\nKnown tags: ${tagList.join(', ')}` : header;
        }
        return `${header}\n${basePrompt}`;
    }

    async _request(operation, body, meta = {}) {
        if (!this.fetchImpl) {
            throw new Error('Fetch API is not available in this environment');
        }

        const url = `${BASE_URL}/${this.model}:${operation}?key=${this.apiKey}`;
        const response = await this.fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': JSON_MIME },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let details = 'Unknown error';
            try {
                const errorData = await response.json();
                details = errorData.error?.message || JSON.stringify(errorData);
            } catch (error) {
                details = `${response.status}`;
            }
            throw new Error(`Gemini API error: ${details}`);
        }

        return response.json();
    }

    _extractText(response) {
        return response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    _estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    _estimateCost(text, params) {
        const tokens = this._estimateTokens(text);
        const pricePerToken = params.pricePerToken ?? 0.0000005;
        return Number((tokens * pricePerToken).toFixed(6));
    }

    async _blobToBase64(blob) {
        if (typeof FileReader !== 'undefined') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = reader.result;
                    resolve(dataUrl.split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        const buffer = await blob.arrayBuffer();
        const base64Buffer = (typeof Buffer !== 'undefined')
            ? Buffer.from(buffer).toString('base64')
            : btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return base64Buffer;
    }

    async _toBlob(input) {
        if (input instanceof Blob) return input;
        if (typeof input === 'string') {
            return new Blob([input], { type: 'text/plain' });
        }
        if (input?.arrayBuffer) {
            return input;
        }
        return null;
    }

    async _requireApiKey() {
        if (!this.apiKey) {
            throw new Error('GeminiProvider requires an API key');
        }
    }

    _safeJson(payload) {
        try {
            return typeof payload === 'string' ? JSON.parse(payload) : payload;
        } catch (error) {
            return { text: payload, category: null, tags: [] };
        }
    }
}
