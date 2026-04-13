function stableSerialize(value) {
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
    }

    if (!value || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function fingerprintEvent(entry) {
    const sample = { ...entry };
    delete sample.timestamp;
    delete sample.sessionId;
    delete sample.userId;
    delete sample.platform;
    delete sample.userAgent;
    delete sample.screen;
    delete sample.viewport;
    return stableSerialize(sample);
}

export class EventAggregator {
    constructor(options = {}) {
        this.maxGroups = options.maxGroups || 100;
    }

    countGroups(entries = []) {
        return new Set(entries.map((entry) => this.getAggregateKey(entry))).size;
    }

    shouldFlush(entries = []) {
        return this.countGroups(entries) >= this.maxGroups;
    }

    aggregate(entries = []) {
        const groups = new Map();

        entries.forEach((entry) => {
            const key = this.getAggregateKey(entry);
            const existing = groups.get(key);
            if (existing) {
                existing.count += 1;
                existing.lastSeen = entry.timestamp;
            } else {
                groups.set(key, {
                    aggregate: true,
                    event: this.getAggregateEventName(entry),
                    category: entry.category,
                    severity: entry.severity,
                    count: 1,
                    firstSeen: entry.timestamp,
                    lastSeen: entry.timestamp,
                    samplePayload: entry,
                    tags: entry.tags || []
                });
            }
        });

        return Array.from(groups.values());
    }

    getAggregateKey(entry) {
        if (entry.category === 'analytics' && entry.type === 'pageview') {
            return `analytics:pageview:${entry.path || 'unknown'}`;
        }
        if (entry.category === 'performance') {
            return `performance:${entry.metricName || entry.name || 'metric'}`;
        }
        return `${entry.category}:${entry.severity}:${fingerprintEvent(entry)}`;
    }

    getAggregateEventName(entry) {
        if (entry.category === 'analytics' && entry.type === 'pageview') {
            return 'ANALYTICS_PAGE_VIEW_SUMMARY';
        }
        if (entry.category === 'performance') {
            return 'PERFORMANCE_METRIC_SUMMARY';
        }
        return `${String(entry.category || 'analytics').toUpperCase()}_${String(entry.severity || 'info').toUpperCase()}_SUMMARY`;
    }
}
