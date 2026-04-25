const ALLOWED_TYPES = new Set([
    'ack',
    'replay',
    'channel.ack',
    'channel.snapshot',
    'channel.invalidate',
    'channel.replay',
    'channel.close',
    'channel.command',
    'channel.unsubscribed',
    'island.invalidate',
    'rework',
    'error'
]);

const REQUIRED_FIELDS = {
    ack: ['intents'],
    replay: ['intents'],
    'channel.ack': ['channel', 'status'],
    'channel.snapshot': ['channel'],
    'channel.invalidate': ['channel'],
    'channel.replay': ['channel'],
    'channel.close': ['channel'],
    'channel.command': ['channel'],
    'channel.unsubscribed': ['channel'],
    'island.invalidate': ['island'],
    rework: [],
    error: ['code']
};

export class TransportMessageGuard {
    constructor(options = {}) {
        this.options = {
            maxMessageBytes: 65536,
            maxJsonDepth: 12,
            maxArrayLength: 500,
            allowedOrigins: [],
            ...options
        };
        this.lastCursorByChannel = new Map();
    }

    assertEndpointAllowed(endpoint, { kind = 'ws' } = {}) {
        const url = new URL(endpoint, globalThis.location?.origin || 'http://localhost');
        const current = globalThis.location;
        if (current?.protocol === 'https:' && !['https:', 'wss:'].includes(url.protocol)) {
            throw new Error(`Insecure ${kind} endpoint rejected`);
        }
        if (current?.origin && url.origin !== current.origin && !this.options.allowedOrigins.includes(url.origin)) {
            throw new Error(`Cross-origin ${kind} endpoint rejected: ${url.origin}`);
        }
        if (kind === 'ws' && !['ws:', 'wss:'].includes(url.protocol)) {
            throw new Error('Invalid WebSocket protocol');
        }
        if (kind === 'sse' && !['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Invalid SSE protocol');
        }
    }

    parse(raw) {
        const text = typeof raw === 'string' ? raw : String(raw ?? '');
        if (new TextEncoder().encode(text).length > this.options.maxMessageBytes) {
            throw new Error('Transport message exceeds max bytes');
        }
        const message = JSON.parse(text);
        this.validate(message);
        return message;
    }

    validate(message) {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            throw new Error('Transport message must be an object');
        }
        if (!ALLOWED_TYPES.has(message.type)) {
            throw new Error(`Transport message type rejected: ${message.type}`);
        }
        this.#scan(message);
        for (const field of REQUIRED_FIELDS[message.type] || []) {
            if (message[field] === undefined || message[field] === null) {
                throw new Error(`Transport message missing field: ${field}`);
            }
        }
        this.#checkCursor(message);
    }

    #scan(value, depth = 0) {
        if (depth > this.options.maxJsonDepth) {
            throw new Error('Transport message exceeds max JSON depth');
        }
        if (Array.isArray(value)) {
            if (value.length > this.options.maxArrayLength) {
                throw new Error('Transport message exceeds max array length');
            }
            value.forEach((item) => this.#scan(item, depth + 1));
            return;
        }
        if (!value || typeof value !== 'object') {
            return;
        }
        for (const key of Object.keys(value)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) {
                throw new Error(`Transport message contains forbidden key: ${key}`);
            }
            this.#scan(value[key], depth + 1);
        }
    }

    #checkCursor(message) {
        if (!message.channel || message.cursor === undefined || message.cursor === null) {
            return;
        }
        const cursorNumber = Number(message.cursor);
        if (!Number.isFinite(cursorNumber)) {
            return;
        }
        const previous = this.lastCursorByChannel.get(message.channel);
        if (previous !== undefined && cursorNumber < previous) {
            throw new Error('Transport replay cursor moved backwards');
        }
        this.lastCursorByChannel.set(message.channel, cursorNumber);
    }
}
