/**
 * AnalyticsService - Web analytics tracking, batching, flushing, and production pipeline
 */
import { LifecycleScope } from '../../../runtime/LifecycleScope.js';
import { auditPage } from '../../../runtime/seoAudit.js';
import { EventClassifier } from './EventClassifier.js';
import { EventAggregator } from './EventAggregator.js';
import { SecurityScanner } from './SecurityScanner.js';

function mergePipelineConfig(config = {}) {
    return {
        classifier: {
            rules: config.classifier?.rules || []
        },
        aggregator: {
            maxGroups: config.aggregator?.maxGroups || 100,
            flushInterval: config.aggregator?.flushInterval || 30000,
            maxBufferedEntries: config.aggregator?.maxBufferedEntries || 200
        },
        security: {
            enabled: config.security?.enabled ?? true,
            rateLimitPerSecond: config.security?.rateLimitPerSecond || 100,
            customPatterns: config.security?.customPatterns || []
        }
    };
}

export class AnalyticsService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = options;
        this.analyticsQueue = [];
        this.sessionEvents = [];
        this.analyticsEndpoint = options.endpoint || '/logs/batch';
        this.maxBatchSize = options.maxBatchSize || 10;
        this.serverBatchLimit = options.serverBatchLimit || 200;
        this.batchInterval = options.batchInterval || 30000;
        this.batchTimer = null;
        this.sessionId = this.getSessionId();
        this.platform = this.detectPlatform();
        this.source = options.source || 'csma';
        this.appVersion = options.appVersion || window.csma?.config?.version || 'dev';
        this.user = null;
        this.analyticsConsent = options.consent || window.csma?.analyticsConsent || null;
        this.runtimeLogConfig = this.normalizeRuntimeLogConfig(options.runtimeLogs || options.collectRuntimeLogs);
        this.runtimeLogUnsubscribe = null;
        this.fetchLaterController = null;
        this.pipelineConfig = mergePipelineConfig(options.pipeline);
        this.classifier = new EventClassifier({
            rules: this.pipelineConfig.classifier.rules,
            devMode: import.meta.env.DEV
        });
        this.aggregator = new EventAggregator(this.pipelineConfig.aggregator);
        this.securityScanner = new SecurityScanner(this.pipelineConfig.security);
        this.lifecycle = new LifecycleScope('AnalyticsService');
        this.destroyed = false;
    }

    init(options = {}) {
        this.options = { ...this.options, ...options };
        this.analyticsEndpoint = options.endpoint || this.analyticsEndpoint;
        this.source = options.source || this.source;
        this.appVersion = options.appVersion || this.appVersion;
        this.maxBatchSize = options.maxBatchSize || this.maxBatchSize;
        this.batchInterval = options.batchInterval || this.batchInterval;
        this.serverBatchLimit = options.serverBatchLimit || this.serverBatchLimit;
        this.analyticsConsent = options.consent || this.analyticsConsent || window.csma?.analyticsConsent || null;
        this.runtimeLogConfig = this.normalizeRuntimeLogConfig(options.runtimeLogs ?? options.collectRuntimeLogs ?? this.runtimeLogConfig);
        this.pipelineConfig = mergePipelineConfig(options.pipeline || this.pipelineConfig);
        this.classifier = new EventClassifier({
            rules: this.pipelineConfig.classifier.rules,
            devMode: import.meta.env.DEV
        });
        this.aggregator = new EventAggregator(this.pipelineConfig.aggregator);
        this.securityScanner = new SecurityScanner(this.pipelineConfig.security);

        this.startBatchTimer();
        this.setupUnloadHandler();
        this.setupClickTracking();
        this.setupNavigationTracking();
        this.setupRuntimeLogBridge();
        this.lifecycle.subscribe(this.eventBus, 'PAGE_CHANGED', (payload) => {
            this.trackPageView(payload.title || document.title);
        });

        return this;
    }

    setUser(userId, traits = {}) {
        this.user = {
            id: userId,
            traits,
            identifiedAt: Date.now()
        };
        this.track('User Identified', { userId, ...traits });
    }

    trackPageView(title = document.title) {
        const pageView = {
            type: 'pageview',
            title: this.truncate(title, 120),
            url: this.stripUrl(window.location.href),
            path: this.stripUrl(window.location.pathname),
            referrer: this.stripUrl(document.referrer),
            seo: auditPage(),
            timestamp: Date.now()
        };

        const tracked = this.processTrackedEvent(pageView);
        if (tracked) {
            this.eventBus.publish('ANALYTICS_PAGE_VIEW', pageView);
        }
    }

    track(eventName, properties = {}) {
        const event = {
            type: properties.metricName ? 'performance' : 'event',
            name: this.truncate(eventName, 80),
            properties,
            metricName: properties.metricName,
            timestamp: Date.now()
        };

        const tracked = this.processTrackedEvent(event);
        if (tracked) {
            this.eventBus.publish('ANALYTICS_EVENT', {
                type: 'event',
                name: event.name,
                properties,
                timestamp: event.timestamp
            });
        }
    }

    setupRuntimeLogBridge() {
        this.runtimeLogUnsubscribe?.();
        this.runtimeLogUnsubscribe = null;

        if (!this.runtimeLogConfig.enabled) {
            return;
        }

        this.runtimeLogUnsubscribe = this.eventBus.subscribe('LOG_ENTRY', (entry) => {
            this.trackRuntimeLog(entry);
        });
    }

    normalizeRuntimeLogConfig(config) {
        if (config === true) {
            return {
                enabled: true,
                types: ['error', 'promise-error', 'security', 'contract-violation'],
                includeStack: false,
                includePayloads: false
            };
        }

        if (!config || config === false) {
            return {
                enabled: false,
                types: [],
                includeStack: false,
                includePayloads: false
            };
        }

        return {
            enabled: Boolean(config.enabled ?? true),
            types: Array.isArray(config.types)
                ? config.types
                : ['error', 'promise-error', 'security', 'contract-violation'],
            includeStack: Boolean(config.includeStack),
            includePayloads: Boolean(config.includePayloads)
        };
    }

    trackRuntimeLog(entry = {}) {
        if (!this.runtimeLogConfig.enabled || !this.runtimeLogConfig.types.includes(entry.type)) {
            return null;
        }

        const data = entry.data && typeof entry.data === 'object' ? entry.data : {};
        const runtimeEvent = {
            type: entry.type,
            name: `runtime_${entry.type}`,
            message: this.truncate(data.message || data.reason?.message || data.type || entry.type, 200),
            reason: this.truncate(data.reason?.message || (typeof data.reason === 'string' ? data.reason : ''), 200),
            timestamp: entry.timestamp || Date.now(),
            sourceSessionId: entry.sessionId,
            data: this.sanitizeRuntimeLogData(data)
        };

        return this.processTrackedEvent(runtimeEvent);
    }

    sanitizeRuntimeLogData(data = {}) {
        const allowed = ['type', 'message', 'url', 'line', 'column', 'blocked', 'pattern', 'event', 'error'];
        const sanitized = {};

        for (const key of allowed) {
            if (data[key] === undefined) continue;
            sanitized[key] = typeof data[key] === 'string' ? this.truncate(data[key], 300) : data[key];
        }

        if (this.runtimeLogConfig.includeStack && data.stack) {
            sanitized.stack = this.truncate(data.stack, 2000);
        }

        if (this.runtimeLogConfig.includePayloads && data.payload !== undefined) {
            sanitized.payload = data.payload;
        }

        return sanitized;
    }

    processTrackedEvent(data) {
        const sanitized = this.decorateEvent(this.sanitizeAnalytics(data));
        let classification = this.classifier.classify(sanitized);
        const scanResult = this.securityScanner.scan(sanitized, { sessionId: this.sessionId });

        if (scanResult) {
            classification = {
                category: 'security',
                severity: 'high',
                disposition: classification.disposition === 'immediate' ? 'immediate' : 'batch',
                tags: [...classification.tags, `threat:${scanResult.threat}`],
                event: {
                    ...sanitized,
                    threat: scanResult
                }
            };
        }

        const processed = {
            ...classification.event,
            category: classification.category,
            severity: classification.severity,
            disposition: classification.disposition,
            threat: classification.event.threat || null,
            tags: classification.tags
        };

        if (!this.isAnalyticsAllowed(this.scopeFor(processed))) {
            return null;
        }

        this.sessionEvents.push(processed);

        if (processed.disposition === 'discard') {
            return processed;
        }

        if (processed.disposition === 'immediate') {
            this.flushProcessedEntries([processed]);
            return processed;
        }

        this.analyticsQueue.push(processed);
        const aggregateEntries = this.analyticsQueue.filter((entry) => entry.disposition === 'aggregate');
        if (
            this.analyticsQueue.length >= this.maxBatchSize ||
            this.aggregator.shouldFlush(aggregateEntries) ||
            this.analyticsQueue.length >= this.pipelineConfig.aggregator.maxBufferedEntries
        ) {
            this.flush();
        }

        return processed;
    }

    flush({ preferDeferred = false } = {}) {
        if (this.analyticsQueue.length === 0) return;
        if (!this.analyticsEndpoint) {
            console.warn('[Analytics] No endpoint configured. Call init({ endpoint: "/logs/batch" })');
            return;
        }

        const batch = this.buildBatchPayload();
        if (!batch) return;

        const { payload, processedCount } = batch;
        const entries = payload.entries;
        const finalize = () => {
            this.analyticsQueue.splice(0, processedCount);
            this.storeBatch(entries);
            this.eventBus.publish('ANALYTICS_BATCH_FLUSH', {
                batchId: payload.batchId,
                entryCount: entries.length,
                source: this.source,
                timestamp: Date.now()
            });
        };

        this.flushViaTransport(payload, finalize, { preferDeferred }).catch((error) => {
            console.error('[Analytics] Failed to flush:', error);
            this.eventBus.publish('ANALYTICS_FLUSH_ERROR', {
                error: error.message,
                queueSize: this.analyticsQueue.length,
                willRetry: true,
                timestamp: Date.now()
            });
        });
    }

    flushProcessedEntries(entries) {
        const payload = this.buildPayloadFromEntries(entries.map((item) => this.formatLogEntry(item)).filter(Boolean));
        if (!payload) {
            return;
        }

        this.flushViaTransport(payload, () => {
            this.storeBatch(payload.entries);
            this.eventBus.publish('ANALYTICS_BATCH_FLUSH', {
                batchId: payload.batchId,
                entryCount: payload.entries.length,
                source: this.source,
                timestamp: Date.now()
            });
        }).catch((error) => {
            console.error('[Analytics] Failed to flush immediate entry:', error);
            this.eventBus.publish('ANALYTICS_FLUSH_ERROR', {
                error: error.message,
                queueSize: this.analyticsQueue.length,
                willRetry: true,
                timestamp: Date.now()
            });
        });
    }

    async flushViaTransport(payload, onSuccess, { preferDeferred = false } = {}) {
        const body = JSON.stringify(payload);

        if (preferDeferred && this.flushViaFetchLater(body, onSuccess)) {
            return;
        }

        if (preferDeferred && this.flushViaBeacon(body, onSuccess)) {
            return;
        }

        const response = await fetch(this.analyticsEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        onSuccess?.();
    }

    flushViaFetchLater(body, onSuccess) {
        if (typeof globalThis.fetchLater !== 'function' || typeof AbortController === 'undefined') {
            return false;
        }

        try {
            this.fetchLaterController?.abort?.();
            this.fetchLaterController = new AbortController();
            globalThis.fetchLater(this.analyticsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: this.fetchLaterController.signal,
                activateAfter: 0
            });
            onSuccess?.();
            return true;
        } catch {
            return false;
        }
    }

    flushViaBeacon(body, onSuccess) {
        if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
            return false;
        }

        try {
            const blob = new Blob([body], { type: 'application/json' });
            if (navigator.sendBeacon(this.analyticsEndpoint, blob)) {
                onSuccess?.();
                return true;
            }
        } catch {
            // Fall through to fetch keepalive.
        }

        return false;
    }

    startBatchTimer() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        const interval = this.pipelineConfig.aggregator.flushInterval || this.batchInterval;
        this.batchTimer = setInterval(() => {
            if (this.analyticsQueue.length > 0) {
                this.flush();
            }
        }, interval);
    }

    buildBatchPayload() {
        if (this.analyticsQueue.length === 0) return null;
        const sliceCount = Math.min(this.analyticsQueue.length, this.serverBatchLimit);
        const slice = this.analyticsQueue.slice(0, sliceCount);
        const batchEntries = slice.filter((item) => item.disposition === 'batch').map((item) => this.formatLogEntry(item)).filter(Boolean);
        const aggregateEntries = this.aggregator.aggregate(slice.filter((item) => item.disposition === 'aggregate'))
            .map((item) => this.formatLogEntry(item))
            .filter(Boolean);
        const entries = [...batchEntries, ...aggregateEntries];

        if (entries.length === 0) {
            return null;
        }

        return {
            payload: this.buildPayloadFromEntries(entries),
            processedCount: sliceCount
        };
    }

    buildPayloadFromEntries(entries) {
        if (!entries?.length) {
            return null;
        }

        const meta = {
            clientTime: Date.now(),
            appVersion: this.appVersion,
            platform: this.platform
        };

        if (typeof navigator !== 'undefined') {
            meta.locale = navigator.language || 'en';
            meta.userAgent = navigator.userAgent;
        }

        if (typeof window !== 'undefined') {
            const url = this.stripUrl(window.location.href);
            if (url) meta.url = url;
        }

        return {
            batchId: this.generateBatchId(),
            sessionId: this.sessionId,
            userId: this.user?.id || 'anonymous',
            source: this.source,
            meta,
            entries
        };
    }

    formatLogEntry(item) {
        if (item.aggregate) {
            return {
                event: item.event,
                level: item.severity === 'critical' ? 'error' : 'info',
                message: `${item.event} x${item.count}`,
                tags: item.tags || [],
                context: {
                    category: item.category,
                    severity: item.severity,
                    count: item.count,
                    firstSeen: item.firstSeen,
                    lastSeen: item.lastSeen,
                    samplePayload: this.buildEntryContext(item.samplePayload)
                },
                timestamp: item.lastSeen
            };
        }

        const entry = {
            event: this.formatEventName(item),
            level: item.severity === 'critical' ? 'error' : item.category === 'security' ? 'warn' : 'info',
            message: this.formatMessage(item),
            tags: this.buildTags(item),
            context: this.buildEntryContext(item),
            timestamp: item.timestamp || Date.now()
        };

        const duration = item.duration || item.durationMs;
        if (typeof duration === 'number') {
            entry.durationMs = duration;
        }

        return entry;
    }

    formatEventName(item) {
        if (item.category === 'security' && item.threat?.threat) {
            return `SECURITY_${this.slugify(item.threat.threat)}`;
        }
        if (item.type === 'pageview') return 'ANALYTICS_PAGE_VIEW';
        if (item.type === 'performance') return `PERFORMANCE_${this.slugify(item.metricName || item.name || 'METRIC')}`;
        if (item.type === 'event') return `ANALYTICS_EVENT_${this.slugify(item.name || 'CUSTOM')}`;
        return `ANALYTICS_${this.slugify(item.type || 'UNKNOWN')}`;
    }

    formatMessage(item) {
        if (item.type === 'pageview') return `Page view: ${item.title || item.path || 'unknown'}`;
        if (item.type === 'performance') return `Performance metric: ${item.metricName || item.name || 'metric'}`;
        if (item.type === 'event') return `Event: ${item.name || 'custom'}`;
        if (item.threat?.threat) return `Security anomaly: ${item.threat.threat}`;
        return item.type || 'analytics';
    }

    buildTags(item) {
        const tags = ['analytics'];
        if (item.type) tags.push(`type:${item.type}`);
        if (item.category) tags.push(`category:${item.category}`);
        if (item.severity) tags.push(`severity:${item.severity}`);
        if (item.name) tags.push(`event:${this.slugify(item.name)}`);
        if (item.threat?.threat) tags.push(`threat:${item.threat.threat}`);
        return [...new Set([...(item.tags || []), ...tags])];
    }

    buildEntryContext(item) {
        const context = {
            sessionId: item.sessionId || this.sessionId,
            userId: item.userId || this.user?.id || 'anonymous',
            platform: item.platform || this.platform
        };

        const fields = ['url', 'path', 'referrer', 'title', 'name', 'properties', 'screen', 'viewport', 'userAgent', 'metricName', 'seo'];
        for (const field of fields) {
            if (item[field] !== undefined) {
                context[field] = item[field];
            }
        }

        if (item.threat) {
            context.threat = item.threat;
        }

        if (item.data) {
            context.data = item.data;
        }

        return context;
    }

    setupClickTracking() {
        const tracker = (e) => {
            const target = e.target.closest('[data-track]');
            if (target) {
                this.track('element_click', {
                    element: target.dataset.track,
                    tag: target.tagName,
                    text: target.textContent.substring(0, 50)
                });
            }
        };
        this.lifecycle.listen(document, 'click', tracker);
    }

    setupNavigationTracking() {
        const locationRef = window.location;
        let lastUrl = locationRef.href;
        const checkUrl = () => {
            if (locationRef.href !== lastUrl) {
                this.track('navigation', {
                    from: this.stripUrl(lastUrl),
                    to: this.stripUrl(locationRef.href)
                });
                lastUrl = locationRef.href;
            }
        };

        const observer = new MutationObserver(checkUrl);
        this.lifecycle.observer(observer);
        observer.observe(document, { subtree: true, childList: true });
        this.lifecycle.listen(window, 'popstate', checkUrl);
    }

    setupUnloadHandler() {
        this.lifecycle.listen(window, 'pagehide', () => this.flush({ preferDeferred: true }));
        this.lifecycle.listen(window, 'beforeunload', () => this.flush({ preferDeferred: true }));
        if ('visibilityState' in document) {
            this.lifecycle.listen(document, 'visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flush({ preferDeferred: true });
                }
            });
        }
    }

    storeBatch(batch) {
        try {
            const existing = JSON.parse(localStorage.getItem('analytics') || '[]');
            existing.push(...batch);
            if (existing.length > 1000) {
                existing.splice(0, existing.length - 1000);
            }
            localStorage.setItem('analytics', JSON.stringify(existing));
        } catch {
            // localStorage may be unavailable.
        }
    }

    scopeFor(event) {
        if (event.category === 'performance') return 'performance';
        if (event.category === 'error') return 'error_tracking';
        if (event.category === 'security') return 'security';
        return 'ui_analytics';
    }

    isAnalyticsAllowed(scope = 'ui_analytics') {
        if (!this.analyticsConsent) return true;
        if (typeof this.analyticsConsent.getConsent === 'function') {
            return this.analyticsConsent.getConsent(scope);
        }
        return false;
    }

    sanitizeAnalytics(data) {
        const clone = { ...data };
        if (clone.url) clone.url = this.stripUrl(clone.url);
        if (clone.path) clone.path = this.stripUrl(clone.path);
        if (clone.referrer) clone.referrer = this.stripUrl(clone.referrer);
        if (clone.title) clone.title = this.truncate(clone.title, 120);
        if (clone.name) clone.name = this.truncate(clone.name, 80);
        if (clone.properties && typeof clone.properties === 'object') {
            clone.properties = Object.fromEntries(Object.entries(clone.properties).map(([key, value]) => [
                key,
                typeof value === 'string' ? this.truncate(value, 200) : value
            ]));
        }
        return clone;
    }

    decorateEvent(data) {
        return {
            ...data,
            sessionId: this.sessionId,
            userId: this.user?.id,
            platform: this.platform,
            userAgent: navigator.userAgent,
            screen: {
                width: window.screen.width,
                height: window.screen.height
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    }

    stripUrl(url = '') {
        try {
            const u = new URL(url, window.location.origin);
            u.search = '';
            u.hash = '';
            return u.toString();
        } catch {
            return '';
        }
    }

    truncate(value = '', max = 120) {
        const str = String(value);
        return str.length > max ? `${str.slice(0, max)}…` : str;
    }

    slugify(value = '') {
        return String(value)
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'UNKNOWN';
    }

    generateBatchId() {
        return `csma-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    getSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    detectPlatform() {
        if (typeof window === 'undefined') return 'unknown';
        if (window.Capacitor) return `capacitor-${window.Capacitor.getPlatform()}`;
        if (window.Neutralino) return 'neutralino';
        if (window.self !== window.top) return 'web-iframe';
        return 'web';
    }

    getStats() {
        return {
            queueSize: this.analyticsQueue.length,
            sessionId: this.sessionId,
            userId: this.user?.id,
            platform: this.platform,
            endpoint: this.analyticsEndpoint,
            sessionEventCount: this.sessionEvents.length
        };
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;

        if (this.analyticsQueue.length > 0) {
            this.flush({ preferDeferred: true });
        }

        this.fetchLaterController?.abort?.();
        this.runtimeLogUnsubscribe?.();
        this.runtimeLogUnsubscribe = null;

        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }

        this.lifecycle.destroy();
    }
}
