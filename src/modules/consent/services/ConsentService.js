const STORAGE_KEY = 'csma.consent.v1';
const LEGACY_ANALYTICS_STORAGE_KEY = 'csma.analyticsConsent.v1';
const ANALYTICS_STORAGE_KEY = 'analytics';

const CATEGORY_KEYS = ['essential', 'preferences', 'analytics', 'performance', 'marketing'];
const OPTIONAL_CATEGORY_KEYS = CATEGORY_KEYS.filter((key) => key !== 'essential');
const LEGACY_SCOPE_MAP = {
    ui_analytics: 'analytics',
    performance: 'performance',
    error_tracking: 'performance',
    security: 'essential'
};

const DEFAULT_COPY = {
    title: 'Privacy preferences',
    description: 'Choose which optional browser features this app can use. Essential features are always active.',
    acceptAll: 'Accept all',
    rejectOptional: 'Reject optional',
    customize: 'Customize',
    save: 'Save preferences',
    close: 'Close',
    essentialLocked: 'Always active'
};

const DEFAULT_CATEGORY_LABELS = {
    essential: 'Essential',
    preferences: 'Preferences',
    analytics: 'Analytics',
    performance: 'Performance',
    marketing: 'Marketing'
};

const DEFAULT_CATEGORY_DESCRIPTIONS = {
    essential: 'Required for security, reliability, and core site behavior.',
    preferences: 'Stores choices that improve your experience.',
    analytics: 'Helps understand page usage and product interactions.',
    performance: 'Helps diagnose speed, errors, and reliability.',
    marketing: 'Supports campaign measurement and promotional personalization.'
};

function createDefaultState() {
    return {
        acknowledged: false,
        categories: {
            essential: true,
            preferences: false,
            analytics: false,
            performance: false,
            marketing: false
        },
        updatedAt: 0,
        migratedFrom: null
    };
}

function normalizeCategory(category) {
    return LEGACY_SCOPE_MAP[category] || category;
}

function normalizeState(raw) {
    const fallback = createDefaultState();
    if (!raw || typeof raw !== 'object') {
        return fallback;
    }

    return {
        acknowledged: Boolean(raw.acknowledged),
        categories: {
            ...fallback.categories,
            ...(raw.categories || {}),
            essential: true
        },
        updatedAt: Number(raw.updatedAt) || 0,
        migratedFrom: raw.migratedFrom || null
    };
}

function stateFromLegacy(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const scopes = raw.scopes || {};
    return normalizeState({
        acknowledged: Boolean(raw.acknowledged),
        categories: {
            essential: true,
            preferences: false,
            analytics: Boolean(scopes.ui_analytics),
            performance: Boolean(scopes.performance || scopes.error_tracking),
            marketing: false
        },
        updatedAt: Number(raw.updatedAt) || Date.now(),
        migratedFrom: LEGACY_ANALYTICS_STORAGE_KEY
    });
}

function parseStored(storage, key) {
    try {
        return JSON.parse(storage?.getItem?.(key) || 'null');
    } catch {
        return null;
    }
}

export class ConsentService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = {};
        this.storage = options.storage || globalThis.localStorage || null;
        this.storageKey = STORAGE_KEY;
        this.state = createDefaultState();
        this.copy = { ...DEFAULT_COPY };
        this.categoryLabels = { ...DEFAULT_CATEGORY_LABELS };
        this.categoryDescriptions = { ...DEFAULT_CATEGORY_DESCRIPTIONS };
    }

    init(options = {}) {
        this.options = { ...this.options, ...options };
        this.storage = options.storage || this.storage || globalThis.localStorage || null;
        this.storageKey = options.storageKey || this.storageKey;
        this.copy = { ...DEFAULT_COPY, ...(options.copy || {}) };
        this.categoryLabels = { ...DEFAULT_CATEGORY_LABELS, ...(options.categoryLabels || {}) };
        this.categoryDescriptions = { ...DEFAULT_CATEGORY_DESCRIPTIONS, ...(options.categoryDescriptions || {}) };
        this.state = this.load();
        this.setupIntentHandlers();
        return this;
    }

    setupIntentHandlers() {
        this.cleanup?.();
        const subscriptions = [];
        subscriptions.push(this.eventBus?.subscribe?.('INTENT_CONSENT_ACCEPT_ALL', (payload = {}) => {
            this.acceptAll(payload.source || 'event');
        }));
        subscriptions.push(this.eventBus?.subscribe?.('INTENT_CONSENT_REJECT_OPTIONAL', (payload = {}) => {
            this.rejectOptional(payload.source || 'event');
        }));
        subscriptions.push(this.eventBus?.subscribe?.('INTENT_CONSENT_UPDATE', (payload = {}) => {
            this.setConsent(payload.category, payload.value, payload.source || 'event');
        }));
        this.cleanup = () => {
            subscriptions.forEach((unsubscribe) => unsubscribe?.());
        };
    }

    getConsent(category) {
        return this.hasConsent(category);
    }

    hasConsent(category) {
        const normalized = normalizeCategory(category);
        if (normalized === 'essential') {
            return true;
        }
        return Boolean(this.state.categories[normalized]);
    }

    getAllCategories() {
        return {
            ...this.state.categories,
            essential: true
        };
    }

    getAllScopes() {
        return {
            ui_analytics: this.hasConsent('analytics'),
            performance: this.hasConsent('performance'),
            error_tracking: this.hasConsent('performance'),
            security: true
        };
    }

    getState() {
        return {
            acknowledged: this.wasAcknowledged(),
            categories: this.getAllCategories(),
            updatedAt: this.state.updatedAt,
            copy: { ...this.copy },
            categoryLabels: { ...this.categoryLabels },
            categoryDescriptions: { ...this.categoryDescriptions }
        };
    }

    setConsent(category, value, source = 'api') {
        const normalized = normalizeCategory(category);
        if (!OPTIONAL_CATEGORY_KEYS.includes(normalized)) {
            return this.getState();
        }

        const timestamp = Date.now();
        this.state = normalizeState({
            ...this.state,
            categories: {
                ...this.state.categories,
                [normalized]: Boolean(value)
            },
            updatedAt: timestamp
        });
        this.persist();
        this.publishUpdate({
            category: normalized,
            value: Boolean(value),
            source,
            timestamp
        });
        return this.getState();
    }

    acknowledge(source = 'api') {
        const timestamp = Date.now();
        this.state = normalizeState({
            ...this.state,
            acknowledged: true,
            updatedAt: timestamp
        });
        this.persist();
        this.eventBus?.publish?.('CONSENT_ACKNOWLEDGED', {
            categories: this.getAllCategories(),
            source,
            timestamp
        });
        return this.getState();
    }

    wasAcknowledged() {
        return Boolean(this.state.acknowledged);
    }

    acceptAll(source = 'api') {
        const timestamp = Date.now();
        this.state = normalizeState({
            acknowledged: true,
            categories: CATEGORY_KEYS.reduce((categories, key) => {
                categories[key] = true;
                return categories;
            }, {}),
            updatedAt: timestamp,
            migratedFrom: this.state.migratedFrom
        });
        this.persist();
        this.publishUpdate({ source, timestamp });
        this.eventBus?.publish?.('CONSENT_ACKNOWLEDGED', {
            categories: this.getAllCategories(),
            source,
            timestamp
        });
        return this.getState();
    }

    rejectOptional(source = 'api') {
        const timestamp = Date.now();
        this.state = normalizeState({
            acknowledged: true,
            categories: createDefaultState().categories,
            updatedAt: timestamp,
            migratedFrom: this.state.migratedFrom
        });
        this.persist();
        this.publishUpdate({ source, timestamp });
        this.eventBus?.publish?.('CONSENT_ACKNOWLEDGED', {
            categories: this.getAllCategories(),
            source,
            timestamp
        });
        return this.getState();
    }

    reset(source = 'api') {
        const timestamp = Date.now();
        this.state = {
            ...createDefaultState(),
            updatedAt: timestamp
        };
        this.persist();
        this.eventBus?.publish?.('CONSENT_RESET', {
            categories: this.getAllCategories(),
            source,
            timestamp
        });
        this.publishUpdate({ source, timestamp });
        return this.getState();
    }

    clearTelemetry() {
        this.storage?.removeItem?.(ANALYTICS_STORAGE_KEY);
    }

    load() {
        const current = parseStored(this.storage, this.storageKey);
        if (current) {
            return normalizeState(current);
        }

        const legacy = stateFromLegacy(parseStored(this.storage, LEGACY_ANALYTICS_STORAGE_KEY));
        if (legacy) {
            this.state = legacy;
            this.persist();
            return legacy;
        }

        return createDefaultState();
    }

    persist() {
        try {
            this.storage?.setItem?.(this.storageKey, JSON.stringify(this.state));
        } catch {
            // Storage may be unavailable or full.
        }
    }

    publishUpdate({ category, value, source, timestamp = Date.now() } = {}) {
        const categories = this.getAllCategories();
        this.eventBus?.publish?.('CONSENT_UPDATED', {
            category,
            value,
            categories,
            acknowledged: this.wasAcknowledged(),
            source,
            timestamp
        });
        this.eventBus?.publish?.('ANALYTICS_CONSENT_UPDATED', {
            scope: category,
            value,
            scopes: this.getAllScopes(),
            acknowledged: this.wasAcknowledged(),
            timestamp
        });
    }

    destroy() {
        this.cleanup?.();
        this.cleanup = null;
    }
}
