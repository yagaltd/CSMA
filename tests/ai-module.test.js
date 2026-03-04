import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { AIClient } from '../src/modules/ai/client/AIClient.js';
import { AIProvider } from '../src/modules/ai/providers/AIProvider.js';
import { AIService } from '../src/modules/ai/services/AIService.js';

class MockProvider extends AIProvider {
    constructor(name, priority, capabilities) {
        super();
        this.name = name;
        this._priority = priority;
        this.capabilities = capabilities;
        this.shouldFail = false;
    }

    async isAvailable() {
        return true;
    }

    get priority() {
        return this._priority;
    }

    getCapabilities() {
        return this.capabilities;
    }

    async generateText(params = {}) {
        if (this.shouldFail) {
            this.shouldFail = false;
            throw new Error(`${this.name} failure`);
        }

        if (params.stream && typeof params.onStream === 'function') {
            params.onStream({ text: `[${this.name}] chunk` });
        }

        return {
            text: `[${this.name}] ${params.prompt}`,
            tokensUsed: 42,
            cost: 0.0001
        };
    }
}

describe('AIClient', () => {
    let eventBus;
    let client;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        client = new AIClient(eventBus);
    });

    it('prefers high-priority providers and falls back on failure', async () => {
        const local = new MockProvider('local', 100, { generateText: true });
        const cloud = new MockProvider('cloud', 50, { generateText: true });

        await client.registerProvider('local', local);
        await client.registerProvider('cloud', cloud);

        const first = await client.generateText({ prompt: 'hello world' });
        expect(first.provider).toBe('local');

        local.shouldFail = true;
        const second = await client.generateText({ prompt: 'fallback please' });
        expect(second.provider).toBe('cloud');
    });

    it('emits streaming events', async () => {
        const provider = new MockProvider('streamer', 100, { generateText: true });
        await client.registerProvider('streamer', provider);

        const chunks = [];
        eventBus.subscribe('AI_MESSAGE_STREAM', (payload) => chunks.push(payload.chunk));

        await client.generateText({
            prompt: 'stream please',
            stream: true,
            onStream: (chunk) => chunks.push(chunk.text)
        });

        expect(chunks.length).toBeGreaterThan(0);
    });
});

describe('AIService', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
    });

    it('registers configured providers via factories', async () => {
        const mockProvider = new MockProvider('factory-local', 100, { generateText: true });

        const service = new AIService(eventBus, {
            factories: {
                gemini: () => mockProvider
            }
        });

        await service.init({
            providers: {
                gemini: { enabled: true }
            }
        });

        expect(service.listProviders()).toContain('gemini');
        const response = await service.generateText({ prompt: 'hi' });
        expect(response.text).toContain('factory-local');
    });
});
