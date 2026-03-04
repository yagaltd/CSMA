import { AIProvider } from './AIProvider.js';

/**
 * TransformersProvider
 * Lightweight wrapper that delegates to an injected pipeline factory.
 * Defaults to offline/local priority (100).
 */
export class TransformersProvider extends AIProvider {
    constructor(options = {}) {
        super();
        this.model = options.model || 'Xenova/LaMini-Flan-T5-783M';
        this.quantized = options.quantized !== false;
        this.pipelineFactory = options.pipelineFactory;
        this.instance = null;
        this.status = 'idle';
    }

    get priority() {
        return 100; // prefer local execution
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

    async isAvailable() {
        return typeof this.pipelineFactory === 'function';
    }

    async init() {
        if (!this.pipelineFactory || this.instance) {
            return;
        }
        this.status = 'loading';
        this.instance = await this.pipelineFactory(this.model, { quantized: this.quantized });
        this.status = 'ready';
    }

    async generateText(params = {}) {
        const pipeline = await this._ensurePipeline();
        const options = {
            temperature: params.temperature ?? 0.7,
            max_new_tokens: params.maxTokens ?? 256
        };
        const result = await pipeline(params.prompt, options);
        const text = Array.isArray(result)
            ? result[0]?.generated_text || result[0]?.summary_text
            : (result?.generated_text || result?.text || String(result));

        if (params.stream && typeof params.onStream === 'function') {
            params.onStream({ text, done: true });
        }

        return {
            text,
            tokensUsed: Math.ceil((text?.length || 0) / 4),
            cost: 0
        };
    }

    async summarize(text, options = {}) {
        return this.generateText({
            ...options,
            prompt: `Summarize the following text:\n${text}`
        });
    }

    async classify(text, options = {}) {
        const response = await this.generateText({
            ...options,
            prompt: `Classify the following text and return JSON {"category","tags"}:\n${text}`
        });
        return response;
    }

    async _ensurePipeline() {
        if (this.instance) return this.instance;
        if (!this.pipelineFactory) {
            throw new Error('TransformersProvider requires a pipelineFactory');
        }
        await this.init();
        if (!this.instance) {
            throw new Error('TransformersProvider failed to initialize');
        }
        return this.instance;
    }
}
