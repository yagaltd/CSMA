import { ContributionRegistry } from './ContributionRegistry.js';

function ensureOptionalString(value, label) {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw new Error(`[CommandRegistry] ${label} must be a string`);
    }

    return value;
}

function ensureOptionalStringArray(value, label) {
    if (value === undefined) {
        return undefined;
    }

    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
        throw new Error(`[CommandRegistry] ${label} must be an array of non-empty strings`);
    }

    return value.map((entry) => entry.trim());
}

const SCHEMA_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array']);

function ensureShapeSchema(value, label) {
    if (value === undefined) {
        return undefined;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`[CommandRegistry] ${label} must be an object`);
    }

    const normalized = {};
    Object.entries(value).forEach(([key, type]) => {
        if (typeof key !== 'string' || key.trim() === '') {
            throw new Error(`[CommandRegistry] ${label} keys must be non-empty strings`);
        }

        if (!SCHEMA_TYPES.has(type)) {
            throw new Error(`[CommandRegistry] ${label}.${key} must be one of: ${Array.from(SCHEMA_TYPES).join(', ')}`);
        }

        normalized[key.trim()] = type;
    });

    return normalized;
}

function getValueType(value) {
    if (Array.isArray(value)) {
        return 'array';
    }

    if (value === null) {
        return 'object';
    }

    return typeof value;
}

function validatePayload(payload = {}, schema = {}, requiredKeys = []) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('[CommandRegistry] payload must be an object');
    }

    const allowedKeys = new Set(Object.keys(schema));
    Object.keys(payload).forEach((key) => {
        if (!allowedKeys.has(key)) {
            throw new Error(`[CommandRegistry] payload.${key} is not allowed`);
        }

        const expectedType = schema[key];
        const actualType = getValueType(payload[key]);
        if (expectedType && expectedType !== actualType) {
            throw new Error(`[CommandRegistry] payload.${key} must be ${expectedType}, got ${actualType}`);
        }
    });

    requiredKeys.forEach((key) => {
        if (!(key in payload)) {
            throw new Error(`[CommandRegistry] payload.${key} is required`);
        }
    });

    return { ...payload };
}

function toSearchableText(parts) {
    return parts
        .flatMap((part) => (Array.isArray(part) ? part : [part]))
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function scoreCommand(command, query) {
    if (!query) {
        return Number.MAX_SAFE_INTEGER;
    }

    const title = command.title.toLowerCase();
    const keywords = command.keywords || [];
    const group = (command.group || '').toLowerCase();
    const haystack = toSearchableText([title, group, keywords]);

    if (title === query) {
        return 400;
    }

    if (title.startsWith(query)) {
        return 300;
    }

    if (title.includes(query)) {
        return 200;
    }

    if (keywords.some((keyword) => keyword.toLowerCase() === query)) {
        return 150;
    }

    if (keywords.some((keyword) => keyword.toLowerCase().includes(query))) {
        return 120;
    }

    if (group.includes(query)) {
        return 80;
    }

    if (haystack.includes(query)) {
        return 40;
    }

    return 0;
}

export class CommandRegistry extends ContributionRegistry {
    constructor({ eventBus, serviceManager } = {}) {
        super('commands', { eventBus });
        this.serviceManager = serviceManager || null;
        this.listeners = [];

        if (this.eventBus) {
            this.listeners.push(
                this.eventBus.subscribe('INTENT_COMMAND_EXECUTE', (payload = {}) => this.handleExecuteIntent(payload))
            );
            this.listeners.push(
                this.eventBus.subscribe('INTENT_COMMAND_SEARCH', (payload = {}) => this.handleSearchIntent(payload))
            );
        }
    }

    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[CommandRegistry] Contribution must be an object');
        }

        const {
            id,
            title,
            handlerService,
            handlerMethod,
            shortcut,
            group,
            order,
            keywords,
            payloadSchema,
            requiredPayload
        } = contribution;
        const normalizedShortcut = ensureOptionalString(shortcut, 'shortcut');
        const normalizedGroup = ensureOptionalString(group, 'group');
        const normalizedKeywords = ensureOptionalStringArray(keywords, 'keywords');
        const normalizedPayloadSchema = ensureShapeSchema(payloadSchema, 'payloadSchema');
        const normalizedRequiredPayload = ensureOptionalStringArray(requiredPayload, 'requiredPayload');

        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error('[CommandRegistry] id is required');
        }

        if (typeof title !== 'string' || title.trim() === '') {
            throw new Error(`[CommandRegistry] title is required for command "${id}"`);
        }

        if (typeof handlerService !== 'string' || handlerService.trim() === '') {
            throw new Error(`[CommandRegistry] handlerService is required for command "${id}"`);
        }

        if (typeof handlerMethod !== 'string' || handlerMethod.trim() === '') {
            throw new Error(`[CommandRegistry] handlerMethod is required for command "${id}"`);
        }

        if (order !== undefined && typeof order !== 'number') {
            throw new Error(`[CommandRegistry] order must be a number for command "${id}"`);
        }

        return {
            id: id.trim(),
            title: title.trim(),
            handlerService: handlerService.trim(),
            handlerMethod: handlerMethod.trim(),
            ...(normalizedShortcut ? { shortcut: normalizedShortcut } : {}),
            ...(normalizedGroup ? { group: normalizedGroup } : {}),
            ...(normalizedKeywords ? { keywords: normalizedKeywords } : {}),
            ...(normalizedPayloadSchema ? { payloadSchema: normalizedPayloadSchema } : {}),
            ...(normalizedRequiredPayload ? { requiredPayload: normalizedRequiredPayload } : {}),
            ...(typeof order === 'number' ? { order } : {})
        };
    }

    async execute(commandId, payload = {}, context = {}) {
        const command = this.get(commandId);
        if (!command) {
            throw new Error(`[CommandRegistry] Unknown command "${commandId}"`);
        }

        const normalizedPayload = command.payloadSchema
            ? validatePayload(payload, command.payloadSchema, command.requiredPayload || [])
            : payload;

        const service = this.serviceManager?.get(command.handlerService);
        const handler = service?.[command.handlerMethod];

        if (typeof handler !== 'function') {
            throw new Error(
                `[CommandRegistry] ${command.handlerService}.${command.handlerMethod} is not available for command "${commandId}"`
            );
        }

        const result = await handler.call(service, normalizedPayload, context, command);
        this.eventBus?.publishSync?.('COMMAND_EXECUTED', {
            commandId: command.id,
            command: command.title,
            payload: normalizedPayload,
            ...(context.source ? { source: context.source } : {}),
            timestamp: Date.now()
        });
        return result;
    }

    search(query = '') {
        const normalizedQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';
        const results = super
            .list()
            .map((command) => ({
                ...command,
                score: scoreCommand(command, normalizedQuery)
            }))
            .filter((command) => !normalizedQuery || command.score > 0);

        return results.sort((left, right) => {
            if (left.score !== right.score) {
                return right.score - left.score;
            }

            const leftOrder = typeof left.order === 'number' ? left.order : Number.MAX_SAFE_INTEGER;
            const rightOrder = typeof right.order === 'number' ? right.order : Number.MAX_SAFE_INTEGER;
            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }

            return left.title.localeCompare(right.title);
        });
    }

    async handleExecuteIntent(payload = {}) {
        if (!payload.commandId) {
            return null;
        }

        return this.execute(payload.commandId, payload.payload || {}, {
            ...(payload.source ? { source: payload.source } : {})
        });
    }

    handleSearchIntent(payload = {}) {
        const query = typeof payload.query === 'string' ? payload.query : '';
        const results = this.search(query).map((command) => ({
            id: command.id,
            title: command.title,
            ...(command.group ? { group: command.group } : {}),
            ...(command.shortcut ? { shortcut: command.shortcut } : {}),
            ...(typeof command.score === 'number' ? { score: command.score } : {})
        }));

        this.eventBus?.publishSync?.('COMMAND_RESULTS_UPDATED', {
            query,
            results,
            timestamp: Date.now()
        });

        return results;
    }

    destroy() {
        this.listeners.splice(0).forEach((unsubscribe) => unsubscribe());
        super.destroy();
    }
}
