/**
 * LogAccumulator - Analytics, error tracking, and developer tools
 * Dev panel extracted to separate module for 0KB production overhead
 */
import { LifecycleScope } from './LifecycleScope.js';

export class LogAccumulator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logs = [];
        this.maxLogs = 1000;
        this.devMode = import.meta.env.DEV;
        this.devPanel = null;

        // Web Analytics
        this.analyticsQueue = [];
        this.analyticsEndpoint = null; // Set via init()
        this.maxBatchSize = 10;
        this.batchInterval = 30000; // 30 seconds
        this.batchTimer = null;
        this.user = null;
        this.sessionId = this.getSessionId();
        this.platform = this.detectPlatform();
        this.analyticsConsent = (window.csma && window.csma.analyticsConsent) || null;
        this.source = 'csma';
        this.appVersion = window.csma?.config?.version || 'dev';
        this.serverBatchLimit = 200;
        this.lifecycle = new LifecycleScope('LogAccumulator');
        this.errorListener = this.handleError.bind(this);
        this.promiseErrorListener = this.handlePromiseError.bind(this);
        this.clickTracker = null;
        this.navigationObserver = null;
        this.beforeUnloadHandler = null;
        this.visibilityChangeHandler = null;
        this.destroyed = false;
        this.boundaryTimers = new Set();
        this.activateRuntime();
    }

    activateRuntime() {
        this.destroyed = false;
        this.setupTracking();

        if (this.devMode) {
            this.loadDevPanel();
        }

        this.startBatchTimer();
        this.setupUnloadHandler();
    }

    async loadDevPanel() {
        try {
            // Dynamic import - completely tree-shaken in production!
            const { DevPanel } = await import('./devtools/DevPanel.js');
            if (this.destroyed) {
                return;
            }
            this.devPanel = new DevPanel(this);
        } catch (error) {
            console.warn('Failed to load dev panel:', error);
        }
    }

    setupTracking() {
        // Error tracking with recovery
        this.lifecycle.listen(window, 'error', this.errorListener);
        this.lifecycle.listen(window, 'unhandledrejection', this.promiseErrorListener);

        // CSS change tracking
        this.observeCSSChanges();

        // Analytics
        this.trackClicks();
        this.trackNavigation();

        // Security events
        this.lifecycle.subscribe(this.eventBus, 'SECURITY_VIOLATION', this.logAttack.bind(this));

        // Contract violations
        this.lifecycle.subscribe(this.eventBus, 'CONTRACT_VIOLATION', this.logContractViolation.bind(this));

        // Auto-track page views on route changes
        this.lifecycle.subscribe(this.eventBus, 'PAGE_CHANGED', (payload) => {
            this.trackPageView(payload.title || document.title);
        });
    }

    handleError(error) {
        this.logError(error);

        // Show error recovery UI for critical errors
        if (this.isCriticalError(error)) {
            this.showErrorRecovery(error);
        }
    }

    handlePromiseError(event) {
        this.logPromiseError(event);
    }

    isCriticalError(error) {
        const critical = [
            'Cannot read',
            'Cannot set',
            'undefined is not',
            'null is not',
            'Failed to fetch'
        ];
        return critical.some(pattern => error.message?.includes(pattern));
    }

    showErrorRecovery(error) {
        const existingBoundary = document.querySelector('.error-boundary');
        if (existingBoundary) return; // Don't show multiple

        const boundary = document.createElement('div');
        boundary.className = 'error-boundary';

        const content = document.createElement('div');
        content.className = 'error-boundary-content';

        const heading = document.createElement('h2');
        heading.textContent = '⚠️ Something went wrong';
        content.appendChild(heading);

        const messageEl = document.createElement('p');
        messageEl.className = 'error-message';
        messageEl.textContent = this.sanitizeError(error.message);
        content.appendChild(messageEl);

        if (this.devMode) {
            const stack = document.createElement('pre');
            stack.className = 'error-stack';
            stack.textContent = error.error?.stack || 'No stack trace';
            content.appendChild(stack);
        }

        const actions = document.createElement('div');
        actions.className = 'error-actions';

        const reloadBtn = document.createElement('button');
        reloadBtn.type = 'button';
        reloadBtn.textContent = 'Reload Page';

        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.textContent = 'Dismiss';
        let autoRemoveTimer = null;
        const removeBoundary = () => {
            if (autoRemoveTimer) {
                clearTimeout(autoRemoveTimer);
                this.boundaryTimers.delete(autoRemoveTimer);
                autoRemoveTimer = null;
            }
            boundary.remove();
        };

        reloadBtn.addEventListener('click', () => {
            removeBoundary();
            window.location.reload();
        });
        dismissBtn.addEventListener('click', removeBoundary);

        actions.append(reloadBtn, dismissBtn);
        content.appendChild(actions);
        boundary.appendChild(content);
        document.body.appendChild(boundary);
        this.injectErrorStyles();

        // Auto-remove after 10s if not critical
        if (!this.isCriticalError(error)) {
            autoRemoveTimer = setTimeout(() => {
                this.boundaryTimers.delete(autoRemoveTimer);
                boundary.remove();
                autoRemoveTimer = null;
            }, 10000);
            this.boundaryTimers.add(autoRemoveTimer);
        }
    }

    sanitizeError(message) {
        // Don't leak internal paths in production
        if (!this.devMode) {
            return message.replace(/https?:\/\/[^\s]+/g, '[URL]')
                .replace(/file:\/\/[^\s]+/g, '[FILE]');
        }
        return message;
    }

    logContractViolation(details) {
        this.log('contract-violation', {
            event: details.event,
            error: details.error,
            payload: this.devMode ? details.payload : '[REDACTED]',
            timestamp: Date.now()
        });
    }

    observeCSSChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    this.log('css-change', {
                        element: mutation.target.tagName,
                        id: mutation.target.id || null,
                        oldClass: mutation.oldValue,
                        newClass: mutation.target.className,
                        timestamp: Date.now()
                    });
                }
            });
        });

        this.lifecycle.observer(observer);
        observer.observe(document.body, {
            attributes: true,
            attributeOldValue: true,
            subtree: true,
            attributeFilter: ['class', 'data-status', 'data-type', 'data-priority']
        });
    }

    trackClicks() {
        this.clickTracker = (e) => {
            const target = e.target.closest('[data-track]');
            if (target) {
                this.log('click', {
                    element: target.dataset.track,
                    tag: target.tagName,
                    text: target.textContent.substring(0, 50),
                    timestamp: Date.now()
                });
            }
        };
        this.lifecycle.listen(document, 'click', this.clickTracker);
    }

    trackNavigation() {
        let lastUrl = location.href;

        const checkUrl = () => {
            if (location.href !== lastUrl) {
                this.log('navigation', {
                    from: lastUrl,
                    to: location.href,
                    timestamp: Date.now()
                });
                lastUrl = location.href;
            }
        };

        this.navigationObserver = new MutationObserver(checkUrl);
        this.lifecycle.observer(this.navigationObserver);
        this.navigationObserver.observe(document, { subtree: true, childList: true });
        this.lifecycle.listen(window, 'popstate', checkUrl);
    }

    logAttack(details) {
        this.log('security', {
            type: details.type,
            userId: details.userId || 'anonymous',
            blocked: true,
            pattern: details.pattern,
            timestamp: Date.now()
        });

        this.sendBatch([this.logs[this.logs.length - 1]]);
    }

    logError(error) {
        this.log('error', {
            message: error.message,
            stack: error.error?.stack,
            url: error.filename,
            line: error.lineno,
            column: error.colno,
            timestamp: Date.now()
        });
    }

    logPromiseError(event) {
        this.log('promise-error', {
            reason: event.reason,
            timestamp: Date.now()
        });
    }

    log(type, data) {
        const entry = {
            type,
            data,
            sessionId: this.getSessionId(),
            timestamp: Date.now()
        };

        this.logs.push(entry);

        // Trim old logs
        if (this.logs.length > this.maxLogs) {
            this.logs.splice(0, this.maxLogs / 2);
        }

        // Publish for real-time monitoring
        this.eventBus.publish('LOG_ENTRY', entry);

        // Update dev panel if loaded
        if (this.devPanel) {
            this.devPanel.update(entry);
        }

        // Batch send every 50 logs
        if (this.logs.length % 50 === 0) {
            this.sendBatch(this.logs.slice(-50));
        }
    }

    // ========================================
    // WEB ANALYTICS
    // ========================================

    /**
     * Initialize analytics with endpoint
     */
    init(options = {}) {
        if (this.destroyed) {
            this.lifecycle = new LifecycleScope('LogAccumulator');
            this.activateRuntime();
        }

        if (options.endpoint) {
            this.analyticsEndpoint = options.endpoint;
        } else if (!this.analyticsEndpoint) {
            this.analyticsEndpoint = '/analytics';
        }

        if (options.source) {
            this.source = options.source;
        }
        if (options.appVersion) {
            this.appVersion = options.appVersion;
        }

        this.maxBatchSize = options.maxBatchSize || this.maxBatchSize || 10;
        this.batchInterval = options.batchInterval || this.batchInterval || 30000;
        this.serverBatchLimit = options.serverBatchLimit || this.serverBatchLimit || 200;

        // Restart timer with new interval
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.startBatchTimer();
        }
    }

    /**
     * Identify user for analytics
     */
    setUser(userId, traits = {}) {
        this.user = {
            id: userId,
            traits,
            identifiedAt: Date.now()
        };

        // Track identify event
        this.track('User Identified', {
            userId,
            ...traits
        });
    }

    /**
     * Track page view
     */
    trackPageView(title = document.title) {
        if (!this.isAnalyticsAllowed('ui_analytics')) return;

        const pageView = {
            type: 'pageview',
            title: this.truncate(title, 120),
            url: this.stripUrl(window.location.href),
            path: this.stripUrl(window.location.pathname),
            referrer: this.stripUrl(document.referrer),
            timestamp: Date.now()
        };

        this.addToAnalyticsQueue(pageView);

        // Also publish for other listeners
        this.eventBus.publish('ANALYTICS_PAGE_VIEW', pageView);
    }

    /**
     * Track custom event
     */
    track(eventName, properties = {}) {
        if (!this.isAnalyticsAllowed('ui_analytics')) return;

        const event = {
            type: 'event',
            name: this.truncate(eventName, 80),
            properties,
            timestamp: Date.now()
        };

        this.addToAnalyticsQueue(event);

        // Also publish for other listeners
        this.eventBus.publish('ANALYTICS_EVENT', event);
    }

    /**
     * Add to analytics queue
     */
    addToAnalyticsQueue(data) {
        if (!this.isAnalyticsAllowed('ui_analytics')) return;
        const sanitized = this.sanitizeAnalytics(data);
        this.analyticsQueue.push({
            ...sanitized,
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
        });

        // Auto-flush if batch size reached
        if (this.analyticsQueue.length >= this.maxBatchSize) {
            this.flush();
        }
    }

    /**
     * Flush analytics to server
     * 
     * Uses fetch with keepalive as primary when auth is required (sendBeacon can't send headers).
     * Falls back to sendBeacon only for unauthenticated endpoints.
     */
    flush() {
        if (this.analyticsQueue.length === 0) return;
        if (!this.isAnalyticsAllowed('ui_analytics')) return;
        if (!this.analyticsEndpoint) {
            console.warn('[Analytics] No endpoint configured. Call init({ endpoint: "/logs/batch" })');
            return;
        }

        const batch = this.buildBatchPayload();
        if (!batch) return;

        const { payload, processedCount } = batch;
        const entries = payload.entries;
        const finalize = (transport) => {
            this.analyticsQueue.splice(0, processedCount);
            this.sendBatch(entries);
            console.log(`[Analytics] Flushed ${entries.length} entries via ${transport}`);
        };

        // Use fetch for all requests (works with keepalive on page unload)
        this.flushViaFetch(payload, entries, () => finalize('fetch')).catch((error) => {
            console.error('[Analytics] Failed to flush:', error);
            // Queue remains - will retry on next flush
        });
    }

    /**
     * Flush via fetch
     * Uses keepalive: true for page unload reliability (similar to sendBeacon)
     */
    async flushViaFetch(payload, entries, onSuccess) {
        const headers = { 'Content-Type': 'application/json' };

        const response = await fetch(this.analyticsEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            keepalive: true // Keep request alive even if page unloads
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        onSuccess?.();
    }

    /**
     * Start batch timer
     */
    startBatchTimer() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        this.batchTimer = setInterval(() => {
            if (this.analyticsQueue.length > 0) {
                this.flush();
            }
        }, this.batchInterval);
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
        return clone;
    }

    stripUrl(url = '') {
        try {
            const u = new URL(url, window.location.origin);
            u.search = '';
            u.hash = '';
            return u.toString();
        } catch (e) {
            return '';
        }
    }

    truncate(value = '', max = 120) {
        const str = String(value);
        return str.length > max ? `${str.slice(0, max)}…` : str;
    }

    generateBatchId() {
        return `csma-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    buildBatchPayload() {
        if (this.analyticsQueue.length === 0) return null;
        const sliceCount = Math.min(this.analyticsQueue.length, this.serverBatchLimit);
        const slice = this.analyticsQueue.slice(0, sliceCount);
        const entries = slice.map((item) => this.formatLogEntry(item)).filter(Boolean);

        if (entries.length === 0) {
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
            meta.url = this.stripUrl(window.location.href);
        }

        if (!meta.url) {
            delete meta.url;
        }

        const payload = {
            batchId: this.generateBatchId(),
            sessionId: this.sessionId,
            userId: this.user?.id || 'anonymous',
            source: this.source,
            meta,
            entries
        };


        return { payload, processedCount: sliceCount };
    }

    formatLogEntry(item) {
        const entry = {
            event: this.formatEventName(item),
            level: 'info',
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
        if (item.type === 'pageview') {
            return 'ANALYTICS_PAGE_VIEW';
        }
        if (item.type === 'event') {
            return `ANALYTICS_EVENT_${this.slugify(item.name || 'CUSTOM')}`;
        }
        return `ANALYTICS_${this.slugify(item.type || 'UNKNOWN')}`;
    }

    formatMessage(item) {
        if (item.type === 'pageview') {
            return `Page view: ${item.title || item.path || 'unknown'}`;
        }
        if (item.type === 'event') {
            return `Event: ${item.name || 'custom'}`;
        }
        return item.type || 'analytics';
    }

    buildTags(item) {
        const tags = ['analytics'];
        if (item.type) {
            tags.push(`type:${item.type}`);
        }
        if (item.name) {
            tags.push(`event:${this.slugify(item.name)}`);
        }
        return tags;
    }

    buildEntryContext(item) {
        const context = {
            sessionId: item.sessionId || this.sessionId,
            userId: item.userId || this.user?.id || 'anonymous',
            platform: item.platform || this.platform
        };

        const fields = ['url', 'path', 'referrer', 'title', 'name', 'properties', 'screen', 'viewport', 'userAgent'];
        for (const field of fields) {
            if (item[field]) {
                context[field] = item[field];
            }
        }

        if (item.data) {
            context.data = item.data;
        }

        return context;
    }

    slugify(value = '') {
        return String(value)
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'UNKNOWN';
    }

    /**
     * Setup unload handler to flush on page leave
     */
    setupUnloadHandler() {
        // Flush analytics when page is about to unload
        this.beforeUnloadHandler = () => {
            this.flush();
        };
        this.lifecycle.listen(window, 'beforeunload', this.beforeUnloadHandler);

        // Also flush on visibility change (mobile/tab switching)
        if (document.visibilityState) {
            this.visibilityChangeHandler = () => {
                if (document.visibilityState === 'hidden') {
                    this.flush();
                }
            };
            this.lifecycle.listen(document, 'visibilitychange', this.visibilityChangeHandler);
        }
    }

    /**
     * Detect platform (web, Capacitor, Neutralino)
     */
    detectPlatform() {
        if (typeof window === 'undefined') return 'unknown';

        if (window.Capacitor) {
            return `capacitor-${window.Capacitor.getPlatform()}`; // capacitor-ios, capacitor-android
        }

        if (window.Neutralino) {
            return 'neutralino';
        }

        // Check if in iframe
        if (window.self !== window.top) {
            return 'web-iframe';
        }

        return 'web';
    }

    /**
     * Get analytics stats
     */
    getAnalyticsStats() {
        return {
            queueSize: this.analyticsQueue.length,
            sessionId: this.sessionId,
            userId: this.user?.id,
            platform: this.platform,
            endpoint: this.analyticsEndpoint
        };
    }

    sendBatch(batch) {
        const existing = JSON.parse(localStorage.getItem('analytics') || '[]');
        existing.push(...batch);

        if (existing.length > 1000) {
            existing.splice(0, existing.length - 1000);
        }

        localStorage.setItem('analytics', JSON.stringify(existing));
    }

    getSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    injectErrorStyles() {
        // Only inject if not already present
        if (document.getElementById('error-boundary-styles')) return;

        const style = document.createElement('style');
        style.id = 'error-boundary-styles';
        style.textContent = `
            .error-boundary {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000000;
            }
            .error-boundary-content {
                background: #1e1e1e;
                color: #d4d4d4;
                padding: 32px;
                border-radius: 8px;
                max-width: 600px;
                border: 2px solid #f48771;
            }
            .error-boundary-content h2 {
                color: #f48771;
                margin-top: 0;
            }
            .error-message {
                background: #2d2d30;
                padding: 12px;
                border-radius: 4px;
                font-family: monospace;
            }
            .error-stack {
                background: #1e1e1e;
                padding: 12px;
                border-radius: 4px;
                overflow-x: auto;
                max-height: 200px;
                font-size: 11px;
            }
            .error-actions {
                display: flex;
                gap: 12px;
                margin-top: 20px;
            }
            .error-actions button {
                padding: 8px 16px;
                background: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            .error-actions button:hover {
                background: #005a9e;
            }
            .error-actions button:last-child {
                background: #3e3e42;
            }
            .error-actions button:last-child:hover {
                background: #505053;
            }
        `;
        document.head.appendChild(style);
    }

    export() {
        return {
            logs: this.logs,
            sessionId: this.getSessionId()
        };
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;

        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }

        this.boundaryTimers.forEach((timerId) => clearTimeout(timerId));
        this.boundaryTimers.clear();
        document.querySelectorAll('.error-boundary').forEach((boundary) => boundary.remove());
        this.devPanel?.destroy?.();
        this.devPanel = null;
        this.lifecycle.destroy();
    }
}
