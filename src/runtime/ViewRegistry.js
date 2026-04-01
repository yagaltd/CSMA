import { ContributionRegistry } from './ContributionRegistry.js';

const VIEW_MODES = new Set(['replace', 'append', 'prepend', 'update', 'remove']);
const SCHEMA_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array']);

function ensureString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[ViewRegistry] ${label} must be a non-empty string`);
    }

    return value.trim();
}

function ensureOptionalStringArray(value, label) {
    if (value === undefined) {
        return undefined;
    }

    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
        throw new Error(`[ViewRegistry] ${label} must be an array of non-empty strings`);
    }

    return value.map((entry) => entry.trim());
}

function ensureShapeSchema(value, label) {
    if (value === undefined) {
        return undefined;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`[ViewRegistry] ${label} must be an object`);
    }

    const normalized = {};
    Object.entries(value).forEach(([key, type]) => {
        if (typeof key !== 'string' || key.trim() === '') {
            throw new Error(`[ViewRegistry] ${label} keys must be non-empty strings`);
        }

        if (!SCHEMA_TYPES.has(type)) {
            throw new Error(`[ViewRegistry] ${label}.${key} must be one of: ${Array.from(SCHEMA_TYPES).join(', ')}`);
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

function validateShape(values, schema, requiredKeys, label) {
    if (values === undefined) {
        if ((requiredKeys || []).length > 0) {
            throw new Error(`[ViewRegistry] ${label} is required`);
        }
        return {};
    }

    if (!values || typeof values !== 'object' || Array.isArray(values)) {
        throw new Error(`[ViewRegistry] ${label} must be an object`);
    }

    const allowedKeys = new Set(Object.keys(schema || {}));

    Object.keys(values).forEach((key) => {
        if (!allowedKeys.has(key)) {
            throw new Error(`[ViewRegistry] ${label}.${key} is not allowed`);
        }

        const expectedType = schema[key];
        const actualType = getValueType(values[key]);
        if (expectedType && expectedType !== actualType) {
            throw new Error(`[ViewRegistry] ${label}.${key} must be ${expectedType}, got ${actualType}`);
        }
    });

    (requiredKeys || []).forEach((key) => {
        if (!(key in values)) {
            throw new Error(`[ViewRegistry] ${label}.${key} is required`);
        }
    });

    return { ...values };
}

export class ViewRegistry extends ContributionRegistry {
    constructor({ eventBus, serviceManager } = {}) {
        super('views', { eventBus });
        this.serviceManager = serviceManager || null;
        this.listeners = [];

        if (this.eventBus) {
            this.listeners.push(
                this.eventBus.subscribe('INTENT_VIEW_RENDER', (payload = {}) => this.handleRenderIntent(payload))
            );
        }
    }

    validate(contribution) {
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
            throw new Error('[ViewRegistry] Contribution must be an object');
        }

        const id = ensureString(contribution.id, 'id');
        const title = ensureString(contribution.title, 'title');
        const target = ensureString(contribution.target, 'target');
        const renderService = ensureString(contribution.renderService, 'renderService');
        const renderMethod = ensureString(contribution.renderMethod, 'renderMethod');
        const mode = contribution.mode === undefined ? 'replace' : ensureString(contribution.mode, 'mode');
        if (!VIEW_MODES.has(mode)) {
            throw new Error(`[ViewRegistry] mode must be one of: ${Array.from(VIEW_MODES).join(', ')}`);
        }

        const allowedTargets = ensureOptionalStringArray(contribution.allowedTargets, 'allowedTargets');
        const requiredProps = ensureOptionalStringArray(contribution.requiredProps, 'requiredProps');
        const requiredState = ensureOptionalStringArray(contribution.requiredState, 'requiredState');
        const propsSchema = ensureShapeSchema(contribution.propsSchema, 'propsSchema');
        const stateSchema = ensureShapeSchema(contribution.stateSchema, 'stateSchema');

        return {
            id,
            title,
            target,
            renderService,
            renderMethod,
            mode,
            ...(allowedTargets ? { allowedTargets } : {}),
            ...(propsSchema ? { propsSchema } : {}),
            ...(requiredProps ? { requiredProps } : {}),
            ...(stateSchema ? { stateSchema } : {}),
            ...(requiredState ? { requiredState } : {}),
            ...(typeof contribution.order === 'number' ? { order: contribution.order } : {})
        };
    }

    async render(viewId, options = {}, context = {}) {
        const view = this.get(viewId);
        if (!view) {
            throw new Error(`[ViewRegistry] Unknown view "${viewId}"`);
        }

        const mode = options.mode || view.mode;
        if (!VIEW_MODES.has(mode)) {
            throw new Error(`[ViewRegistry] Invalid render mode "${mode}"`);
        }

        const target = options.target || view.target;
        if (!target || typeof target !== 'string') {
            throw new Error(`[ViewRegistry] View "${viewId}" requires a target`);
        }

        const allowedTargets = view.allowedTargets || [view.target];
        if (!allowedTargets.includes(target)) {
            throw new Error(`[ViewRegistry] Target "${target}" is not allowed for view "${viewId}"`);
        }

        const props = validateShape(options.props, view.propsSchema || {}, view.requiredProps || [], 'props');
        const state = validateShape(options.state, view.stateSchema || {}, view.requiredState || [], 'state');

        const service = this.serviceManager?.get(view.renderService);
        if (!service) {
            throw new Error(`[ViewRegistry] Service "${view.renderService}" was not found for view "${viewId}"`);
        }

        const renderMethod = service[view.renderMethod];
        if (typeof renderMethod !== 'function') {
            throw new Error(`[ViewRegistry] Method "${view.renderMethod}" is not available on service "${view.renderService}"`);
        }

        const result = await renderMethod.call(service, {
            viewId: view.id,
            title: view.title,
            target,
            mode,
            props,
            state
        }, context);

        this.eventBus?.publishSync?.('VIEW_RENDERED', {
            viewId: view.id,
            target,
            mode,
            ...(context.source ? { source: context.source } : {}),
            timestamp: Date.now()
        });

        return result;
    }

    async handleRenderIntent(payload = {}) {
        if (!payload.viewId) {
            return null;
        }

        try {
            return await this.render(payload.viewId, {
                target: payload.target,
                props: payload.props,
                state: payload.state,
                mode: payload.mode
            }, {
                ...(payload.source ? { source: payload.source } : {})
            });
        } catch (error) {
            this.eventBus?.publishSync?.('VIEW_RENDER_FAILED', {
                viewId: payload.viewId,
                ...(typeof payload.target === 'string' ? { target: payload.target } : {}),
                error: error.message,
                ...(payload.source ? { source: payload.source } : {}),
                timestamp: Date.now()
            });
            throw error;
        }
    }

    destroy() {
        this.listeners.splice(0).forEach((unsubscribe) => unsubscribe?.());
        super.destroy();
    }
}
