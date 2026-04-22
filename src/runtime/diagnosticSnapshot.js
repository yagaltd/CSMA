function sliceRecent(entries, limit, { includeStacks = false } = {}) {
    return entries
        .slice(-limit)
        .reverse()
        .map((entry) => {
            const payload = {
                type: entry.type,
                timestamp: entry.timestamp,
                data: includeStacks ? entry.data : stripStacks(entry.data)
            };
            return payload;
        });
}

function stripStacks(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
    }

    const clone = { ...value };
    delete clone.stack;
    delete clone.reason?.stack;
    return clone;
}

function toRate(count, startedAt, now) {
    const minutes = Math.max((now - startedAt) / 60000, 1 / 60);
    return Number((count / minutes).toFixed(2));
}

export function createSnapshot(logAccumulator, serviceManager, eventBus, options = {}) {
    const mode = options.mode === 'verbose' ? 'verbose' : 'compact';
    const includeStacks = mode === 'verbose';
    const logs = logAccumulator?.logs || [];
    const now = Date.now();
    const startedAt = logs[0]?.timestamp || now;
    const errorLogs = logs.filter((entry) => ['error', 'promise-error'].includes(entry.type));
    const criticalErrors = errorLogs.filter((entry) => {
        const message = entry?.data?.message || entry?.data?.reason?.message || String(entry?.data?.reason || '');
        return ['Cannot read', 'Cannot set', 'undefined is not', 'null is not', 'Failed to fetch']
            .some((pattern) => message.includes(pattern));
    });
    const degradedErrors = errorLogs.filter((entry) => !criticalErrors.includes(entry));
    const securityLogs = logs.filter((entry) => entry.type === 'security');
    const contractLogs = logs.filter((entry) => entry.type === 'contract-violation');
    const serviceStatuses = serviceManager?.getAllStatus?.() || [];
    const analyticsService = serviceManager?.get?.('analytics') || null;
    const pageViews = (analyticsService?.sessionEvents || []).filter((entry) => entry.type === 'pageview' && entry.seo);

    const services = Object.fromEntries(serviceStatuses.map((service) => [
        service.name,
        {
            status: service.status,
            initTime: service.initTime,
            errorCount: service.errorCount,
            ...(includeStacks ? { dependencies: service.dependencies || [] } : {})
        }
    ]));

    return {
        session: {
            id: logAccumulator?.sessionId || null,
            startedAt,
            durationSec: Math.max(0, Math.round((now - startedAt) / 1000)),
            platform: typeof navigator !== 'undefined' ? navigator.userAgentData?.platform || navigator.platform || 'unknown' : 'unknown',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        },
        errors: {
            total: errorLogs.length,
            critical: sliceRecent(criticalErrors, includeStacks ? criticalErrors.length : 5, { includeStacks }),
            degraded: sliceRecent(degradedErrors, includeStacks ? degradedErrors.length : 10, { includeStacks })
        },
        security: {
            total: securityLogs.length,
            recent: sliceRecent(securityLogs, includeStacks ? securityLogs.length : 5, { includeStacks })
        },
        contracts: {
            total: contractLogs.length,
            recent: sliceRecent(contractLogs, includeStacks ? contractLogs.length : 5, { includeStacks })
        },
        services,
        seo: {
            pagesAudited: pageViews.length,
            pagesMissingDescription: pageViews.filter((entry) => !entry.seo?.hasDescription).length,
            pagesMissingOgImage: pageViews.filter((entry) => !entry.seo?.hasOgImage).length,
            pagesMissingCanonical: pageViews.filter((entry) => !entry.seo?.canonicalUrl).length,
            pagesWithMultipleH1: pageViews.filter((entry) => (entry.seo?.h1Count || 0) > 1).length,
            pagesWithoutStructuredData: pageViews.filter((entry) => (entry.seo?.structuredDataTypes || []).length === 0).length
        },
        performance: {
            errorRate: toRate(errorLogs.length, startedAt, now),
            securityIncidents: securityLogs.length,
            contractViolations: contractLogs.length,
            uptimeSec: Math.max(0, Math.round((now - startedAt) / 1000))
        },
        meta: {
            generatedAt: now,
            version: window?.csma?.config?.version || 'dev',
            environment: import.meta.env.DEV ? 'development' : 'production',
            observedEvents: eventBus?.listeners?.size || 0,
            mode
        }
    };
}
