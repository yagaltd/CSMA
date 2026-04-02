const DEFAULT_CRITICAL_PATTERNS = [
    'Cannot read',
    'Cannot set',
    'undefined is not',
    'null is not',
    'Failed to fetch'
];

export class EventClassifier {
    constructor(options = {}) {
        this.rules = options.rules || [];
        this.devMode = options.devMode ?? import.meta.env.DEV;
    }

    classify(event) {
        const customMatch = this.applyCustomRules(event);
        if (customMatch) {
            return this.normalizeResult(event, customMatch);
        }

        if (event.type === 'security') {
            return this.normalizeResult(event, {
                category: 'security',
                severity: 'critical',
                disposition: 'immediate'
            });
        }

        if (event.type === 'error' || event.type === 'promise-error') {
            const message = event.message || event.reason?.message || String(event.reason || '');
            const isCritical = DEFAULT_CRITICAL_PATTERNS.some((pattern) => message.includes(pattern));
            return this.normalizeResult(event, {
                category: 'error',
                severity: isCritical ? 'critical' : 'high',
                disposition: isCritical ? 'immediate' : 'batch'
            });
        }

        if (event.type === 'pageview') {
            return this.normalizeResult(event, {
                category: 'analytics',
                severity: 'info',
                disposition: 'aggregate'
            });
        }

        if (event.type === 'performance') {
            return this.normalizeResult(event, {
                category: 'performance',
                severity: 'info',
                disposition: 'aggregate'
            });
        }

        const eventName = String(event.name || '');
        if (/^DEV_/.test(eventName)) {
            return this.normalizeResult(event, {
                category: 'dev',
                severity: this.devMode ? 'info' : 'noise',
                disposition: this.devMode ? 'batch' : 'discard'
            });
        }

        return this.normalizeResult(event, {
            category: 'analytics',
            severity: 'info',
            disposition: 'batch'
        });
    }

    applyCustomRules(event) {
        for (const rule of this.rules) {
            const pattern = rule?.pattern;
            if (!pattern) continue;

            const haystack = [
                event.type,
                event.name,
                event.message,
                JSON.stringify(event.properties || {})
            ].filter(Boolean).join(' ');

            if (haystack.includes(pattern)) {
                return rule;
            }
        }
        return null;
    }

    normalizeResult(event, result) {
        return {
            category: result.category,
            severity: result.severity,
            disposition: result.disposition,
            tags: [
                `category:${result.category}`,
                `severity:${result.severity}`
            ],
            event
        };
    }
}
