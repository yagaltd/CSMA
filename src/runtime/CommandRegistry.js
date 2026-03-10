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

export class CommandRegistry extends ContributionRegistry {
    constructor({ eventBus, serviceManager } = {}) {
        super('commands', { eventBus });
        this.serviceManager = serviceManager || null;
    }

    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[CommandRegistry] Contribution must be an object');
        }

        const { id, title, handlerService, handlerMethod, shortcut, group, order } = contribution;

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
            ...(ensureOptionalString(shortcut, 'shortcut') ? { shortcut } : {}),
            ...(ensureOptionalString(group, 'group') ? { group } : {}),
            ...(typeof order === 'number' ? { order } : {})
        };
    }

    async execute(commandId, payload = {}, context = {}) {
        const command = this.get(commandId);
        if (!command) {
            throw new Error(`[CommandRegistry] Unknown command "${commandId}"`);
        }

        const service = this.serviceManager?.get(command.handlerService);
        const handler = service?.[command.handlerMethod];

        if (typeof handler !== 'function') {
            throw new Error(
                `[CommandRegistry] ${command.handlerService}.${command.handlerMethod} is not available for command "${commandId}"`
            );
        }

        const result = await handler.call(service, payload, context, command);
        this.eventBus?.publishSync?.('COMMAND_EXECUTED', {
            commandId: command.id,
            command: command.title,
            payload,
            timestamp: Date.now()
        });
        return result;
    }
}
