const DEFAULT_PATTERNS = [
    { threat: 'xss', severity: 'high', matcher: /<script|javascript:|onerror=|onload=/i },
    { threat: 'sql_injection', severity: 'high', matcher: /'?\s+OR\s+1=1|UNION\s+SELECT|DROP\s+TABLE/i },
    { threat: 'path_traversal', severity: 'high', matcher: /\.\.\/|\.\.%2f|\.\.\\/i },
    { threat: 'prototype_pollution', severity: 'high', matcher: /__proto__|constructor\.prototype|prototype/i }
];

export class SecurityScanner {
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.rateLimitPerSecond = options.rateLimitPerSecond || 100;
        this.customPatterns = options.customPatterns || [];
        this.rateBuckets = new Map();
    }

    scan(event, { sessionId } = {}) {
        if (!this.enabled) {
            return null;
        }

        const rateAnomaly = this.scanRate(sessionId);
        if (rateAnomaly) {
            return rateAnomaly;
        }

        const values = this.extractValues(event);
        for (const { field, value } of values) {
            if (value.length > 2048) {
                return { threat: 'oversize_input', severity: 'high', matchedPattern: 'length>2048', field };
            }
            if (value.includes('\u0000')) {
                return { threat: 'null_bytes', severity: 'high', matchedPattern: '\\u0000', field };
            }
            if (/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
                return { threat: 'control_chars', severity: 'high', matchedPattern: 'control_chars', field };
            }

            for (const pattern of [...DEFAULT_PATTERNS, ...this.customPatterns]) {
                const matcher = pattern.matcher || new RegExp(pattern.pattern, 'i');
                if (matcher.test(value)) {
                    return {
                        threat: pattern.threat,
                        severity: pattern.severity || 'high',
                        matchedPattern: pattern.pattern || matcher.source,
                        field
                    };
                }
            }
        }

        return null;
    }

    scanRate(sessionId = 'anonymous') {
        const second = Math.floor(Date.now() / 1000);
        const key = `${sessionId}:${second}`;
        const count = (this.rateBuckets.get(key) || 0) + 1;
        this.rateBuckets.set(key, count);
        if (count > this.rateLimitPerSecond) {
            return {
                threat: 'rate_anomaly',
                severity: 'high',
                matchedPattern: `>${this.rateLimitPerSecond}/sec`,
                field: 'session'
            };
        }
        return null;
    }

    extractValues(event) {
        const values = [];
        const inspect = (prefix, value) => {
            if (typeof value === 'string') {
                values.push({ field: prefix, value });
                return;
            }
            if (Array.isArray(value)) {
                value.forEach((item, index) => inspect(`${prefix}[${index}]`, item));
                return;
            }
            if (value && typeof value === 'object') {
                Object.entries(value).forEach(([key, nested]) => inspect(`${prefix}.${key}`, nested));
            }
        };

        inspect('event', event);
        return values;
    }
}
