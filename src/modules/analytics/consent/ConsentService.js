const STORAGE_KEY = 'csma.analyticsConsent.v1';
const ANALYTICS_STORAGE_KEY = 'analytics';

const DEFAULT_STATE = {
    acknowledged: false,
    scopes: {
        ui_analytics: false,
        performance: false,
        error_tracking: true,
        security: true
    },
    updatedAt: 0
};

export class ConsentService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.state = this.load();
    }

    getConsent(scope) {
        return Boolean(this.state.scopes[scope]);
    }

    setConsent(scope, value) {
        this.state = {
            ...this.state,
            scopes: {
                ...this.state.scopes,
                [scope]: Boolean(value)
            },
            updatedAt: Date.now()
        };
        this.persist();
        this.eventBus?.publish?.('ANALYTICS_CONSENT_UPDATED', {
            scope,
            value: Boolean(value),
            scopes: this.getAllScopes(),
            acknowledged: this.state.acknowledged,
            timestamp: this.state.updatedAt
        });
    }

    getAllScopes() {
        return { ...this.state.scopes };
    }

    acknowledge() {
        this.state = {
            ...this.state,
            acknowledged: true,
            updatedAt: Date.now()
        };
        this.persist();
    }

    wasAcknowledged() {
        return Boolean(this.state.acknowledged);
    }

    acceptAll() {
        Object.keys(this.state.scopes).forEach((scope) => {
            this.state.scopes[scope] = true;
        });
        this.state.acknowledged = true;
        this.state.updatedAt = Date.now();
        this.persist();
    }

    clearTelemetry() {
        localStorage.removeItem(ANALYTICS_STORAGE_KEY);
    }

    load() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!raw || typeof raw !== 'object') {
                return structuredClone(DEFAULT_STATE);
            }
            return {
                acknowledged: Boolean(raw.acknowledged),
                scopes: {
                    ...DEFAULT_STATE.scopes,
                    ...(raw.scopes || {})
                },
                updatedAt: raw.updatedAt || 0
            };
        } catch {
            return structuredClone(DEFAULT_STATE);
        }
    }

    persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }
}
