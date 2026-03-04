import { AIClient } from '../client/AIClient.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { TransformersProvider } from '../providers/TransformersProvider.js';

export class AIService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = options;
        this.client = null;
        this.factories = options.factories || {
            gemini: (config = {}) => new GeminiProvider(config),
            transformers: (config = {}) => new TransformersProvider(config)
        };
    }

    async init(options = {}) {
        this.options = { ...this.options, ...options };
        this.client = new AIClient(this.eventBus, {
            defaults: options.defaults,
            security: options.security,
            tools: options.tools
        });

        await this._registerConfiguredProviders(options.providers || {});
        return this.client;
    }

    async _registerConfiguredProviders(providerConfigs) {
        const entries = Object.entries(providerConfigs);
        for (const [name, config] of entries) {
            if (config?.enabled === false) continue;
            const factory = this.factories[name];
            if (!factory) continue;
            const provider = factory(config);
            if (!provider) continue;
            if (config.apiKey && typeof provider.setApiKey === 'function') {
                provider.setApiKey(config.apiKey);
            }
            await this.client.registerProvider(name, provider, config);
        }
    }

    registerProvider(name, provider, options = {}) {
        return this.client.registerProvider(name, provider, options);
    }

    listProviders() {
        return this.client.listProviders();
    }

    generateText(params) {
        return this.client.generateText(params);
    }

    transcribe(params) {
        return this.client.transcribe(params);
    }

    ocr(params) {
        return this.client.ocr(params);
    }

    classify(params) {
        return this.client.classify(params);
    }

    summarize(params) {
        return this.client.summarize(params);
    }

    addTool(tool) {
        return this.client.addTool(tool);
    }

    removeTool(name) {
        return this.client.removeTool(name);
    }

    executeTool(name, params) {
        return this.client.executeTool(name, params);
    }

    createChat(options) {
        return this.client.createChat(options);
    }
}
