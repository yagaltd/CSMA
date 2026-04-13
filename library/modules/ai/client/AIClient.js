import { ToolRegistry } from './ToolRegistry.js';
import { ChatSession } from './ChatSession.js';
import { createRequestId } from '../utils/id.js';

/**
 * AIClient - Orchestrates multiple AI providers with capability-based routing.
 */
export class AIClient {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.providers = new Map();
        this.defaults = {
            maxTokens: 512,
            temperature: 0.7,
            timeout: 30_000,
            ...options.defaults
        };
        this.security = {
            sanitizeInputs: true,
            ...options.security
        };
        this.toolRegistry = new ToolRegistry(options.tools || []);
    }

    async registerProvider(name, provider, options = {}) {
        if (!provider || typeof provider.getCapabilities !== 'function') {
            throw new Error(`Invalid provider for ${name}`);
        }

        if (typeof provider.init === 'function') {
            await provider.init(options);
        }

        const capabilities = provider.getCapabilities() || {};
        this.providers.set(name, {
            instance: provider,
            capabilities,
            options
        });

        this._publish('AI_PROVIDER_REGISTERED', {
            name,
            capabilities,
            priority: provider.priority || 0,
            timestamp: Date.now()
        });
    }

    listProviders() {
        return Array.from(this.providers.keys());
    }

    getProvider(name) {
        return this.providers.get(name)?.instance ?? null;
    }

    async generateText(params = {}) {
        const requestId = params.requestId || createRequestId('gen');
        const result = await this._executeOperation({
            method: 'generateText',
            capability: 'generateText',
            params,
            requestId,
            events: {
                start: 'AI_GENERATE_STARTED',
                stream: 'AI_MESSAGE_STREAM',
                complete: 'AI_GENERATE_COMPLETE',
                error: 'AI_GENERATE_ERROR'
            }
        });
        return { ...result, requestId };
    }

    async transcribe(params = {}) {
        return this._executeOperation({
            method: 'transcribe',
            capability: 'transcribe',
            params,
            requestId: params.requestId || createRequestId('transcribe')
        });
    }

    async ocr(params = {}) {
        return this._executeOperation({
            method: 'ocr',
            capability: 'ocr',
            params,
            requestId: params.requestId || createRequestId('ocr')
        });
    }

    async classify(params = {}) {
        return this._executeOperation({
            method: 'classify',
            capability: 'classify',
            params,
            requestId: params.requestId || createRequestId('classify')
        });
    }

    async summarize(params = {}) {
        return this._executeOperation({
            method: 'summarize',
            capability: 'summarize',
            params,
            requestId: params.requestId || createRequestId('summarize')
        });
    }

    createChat(options = {}) {
        return new ChatSession(this, options);
    }

    addTool(tool) {
        return this.toolRegistry.addTool(tool);
    }

    removeTool(name) {
        this.toolRegistry.removeTool(name);
    }

    executeTool(name, params = {}) {
        const requestId = createRequestId('tool');
        this._publish('AI_TOOL_CALLED', {
            requestId,
            tool: name,
            parameters: params,
            timestamp: Date.now()
        });

        const start = Date.now();
        return this.toolRegistry.execute(name, params)
            .then((result) => {
                this._publish('AI_TOOL_RESULT', {
                    requestId,
                    tool: name,
                    result,
                    duration: Date.now() - start,
                    timestamp: Date.now()
                });
                return result;
            })
            .catch((error) => {
                this._publish('AI_TOOL_ERROR', {
                    requestId,
                    tool: name,
                    error: error.message,
                    timestamp: Date.now()
                });
                throw error;
            });
    }

    async _executeOperation({ method, capability, params = {}, requestId, events = {} }) {
        const execParams = this._prepareParams(params);
        const providers = await this._resolveProviders(capability, execParams.provider);

        if (!providers.length) {
            throw new Error(`No providers available for capability "${capability}"`);
        }

        const allowFallback = execParams.fallback !== false;
        let lastError;

        for (let index = 0; index < providers.length; index += 1) {
            const providerInfo = providers[index];
            const providerName = providerInfo.name;
            const provider = providerInfo.instance;
            const startTime = Date.now();

            const onStream = execParams.stream && typeof execParams.onStream === 'function'
                ? (chunk) => {
                    execParams.onStream(chunk, providerName);
                    if (events.stream) {
                        this._publish(events.stream, {
                            requestId,
                            provider: providerName,
                            chunk: chunk?.text ?? chunk,
                            timestamp: Date.now()
                        });
                    }
                }
                : null;

            const payload = {
                ...this.defaults,
                ...execParams,
                provider: providerName,
                onStream
            };

            if (events.start) {
                this._publish(events.start, {
                    requestId,
                    provider: providerName,
                    promptLength: payload.prompt?.length || 0,
                    estimatedTokens: payload.maxTokens || this.defaults.maxTokens,
                    timestamp: Date.now()
                });
            }

            try {
                const result = await provider[method](payload);

                if (events.complete) {
                        this._publish(events.complete, {
                        requestId,
                        provider: providerName,
                        tokensUsed: result?.tokensUsed ?? 0,
                        cost: result?.cost ?? 0,
                        duration: Date.now() - startTime,
                            fallback: index > 0,
                        timestamp: Date.now()
                    });
                }

                return {
                    ...result,
                    provider: providerName
                };
            } catch (error) {
                lastError = error;
                this._publish('AI_PROVIDER_ERROR', {
                    requestId,
                    provider: providerName,
                    capability,
                    error: error.message,
                    timestamp: Date.now()
                });

                if (!allowFallback || index === providers.length - 1) {
                    if (events.error) {
                        this._publish(events.error, {
                            requestId,
                            provider: providerName,
                            error: error.message,
                            timestamp: Date.now()
                        });
                    }
                    throw error;
                }
            }
        }

        if (events.error) {
            this._publish(events.error, {
                requestId,
                provider: 'unavailable',
                error: lastError?.message || 'Unknown provider error',
                timestamp: Date.now()
            });
        }

        throw lastError || new Error('All providers failed');
    }

    async _resolveProviders(capability, requestedProvider = 'auto') {
        if (requestedProvider && requestedProvider !== 'auto') {
            const entry = this.providers.get(requestedProvider);
            if (!entry) {
                throw new Error(`Provider "${requestedProvider}" not registered`);
            }
            const available = await entry.instance.isAvailable();
            if (!available) {
                throw new Error(`Provider "${requestedProvider}" is not available`);
            }
            return [{ name: requestedProvider, instance: entry.instance, didFallback: false }];
        }

        const candidates = [];
        for (const [name, entry] of this.providers.entries()) {
            if (!entry.capabilities?.[capability]) continue;
            // eslint-disable-next-line no-await-in-loop
            const available = await entry.instance.isAvailable();
            if (available) {
                candidates.push({
                    name,
                    instance: entry.instance,
                    priority: entry.instance.priority || 0,
                    didFallback: candidates.length > 0
                });
            }
        }

        candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        return candidates;
    }

    _prepareParams(params) {
        const sanitized = { ...params };

        if (this.security.sanitizeInputs && typeof sanitized.prompt === 'string') {
            sanitized.prompt = sanitized.prompt.replaceAll('\u0000', '');
        }

        if (!sanitized.prompt && Array.isArray(sanitized.messages) && sanitized.messages.length) {
            sanitized.prompt = this._messagesToPrompt(sanitized.system, sanitized.messages);
        }

        return sanitized;
    }

    _messagesToPrompt(system = 'You are a helpful assistant.', messages = []) {
        const transcript = messages
            .map((msg) => `${msg.role?.toUpperCase() || 'USER'}: ${msg.content}`)
            .join('\n');
        return `${system}\n\n${transcript}\nASSISTANT:`;
    }

    _publish(eventName, payload) {
        if (!this.eventBus || !eventName) return;
        this.eventBus.publish(eventName, payload);
    }
}

export function createAIClient(eventBus, config = {}) {
    return new AIClient(eventBus, config);
}
