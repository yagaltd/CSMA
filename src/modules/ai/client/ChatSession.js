import { createRequestId } from '../utils/id.js';

/**
 * ChatSession - lightweight helper that manages a rolling conversation
 * and delegates generation work to the shared AIClient instance.
 */
export class ChatSession {
    constructor(client, options = {}) {
        this.client = client;
        this.eventBus = client?.eventBus;
        this.chatId = options.chatId || createRequestId('chat');
        this.provider = options.provider || 'auto';
        this.systemPrompt = options.system || 'You are a helpful assistant.';
        this.maxHistory = options.maxHistory || 10;
        this.metadata = options.metadata || {};
        this.history = [];

        this._publish('AI_CHAT_CREATED', {
            chatId: this.chatId,
            provider: this.provider,
            systemPrompt: this.systemPrompt,
            metadata: this.metadata,
            timestamp: Date.now()
        });
    }

    _publish(eventName, payload) {
        if (this.eventBus) {
            this.eventBus.publish(eventName, payload);
        }
    }

    _appendMessage(role, content) {
        this.history.push({ role, content, timestamp: Date.now() });
        const maxEntries = this.maxHistory * 2; // user + assistant pairs
        if (this.history.length > maxEntries) {
            this.history.splice(0, this.history.length - maxEntries);
        }
        this._publish(role === 'user' ? 'AI_MESSAGE_SENT' : 'AI_MESSAGE_RECEIVED', {
            chatId: this.chatId,
            role,
            message: content,
            timestamp: Date.now()
        });
    }

    getHistory() {
        return [...this.history];
    }

    reset() {
        this.history = [];
        this._publish('AI_CHAT_RESET', {
            chatId: this.chatId,
            timestamp: Date.now()
        });
    }

    async sendMessage(content, params = {}) {
        this._appendMessage('user', content);

        const response = await this.client.generateText({
            ...params,
            provider: params.provider || this.provider,
            system: params.system || this.systemPrompt,
            messages: this.getHistory()
        });

        const reply = typeof response === 'string' ? response : (response?.text ?? '');
        this._appendMessage('assistant', reply);
        return response;
    }
}
