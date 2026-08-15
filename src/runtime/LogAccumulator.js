/**
 * LogAccumulator - Local runtime diagnostics
 * Analytics extracted to AnalyticsService module (Phase 1 refactor)
 */
import { LifecycleScope } from './LifecycleScope.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { createSnapshot } from './diagnosticSnapshot.js';
import { uid } from '../utils/id.js';

export class LogAccumulator {
    constructor(eventBus, { errorBoundary } = {}) {
        this.eventBus = eventBus;
        this.logs = [];
        this.maxLogs = 1000;
        this.devMode = import.meta.env.DEV;
        this.sessionId = this.getSessionId();
        this.lifecycle = new LifecycleScope('LogAccumulator');
        this.errorBoundary = errorBoundary || new ErrorBoundary({ devMode: this.devMode });
        this.errorListener = this.handleError.bind(this);
        this.promiseErrorListener = this.handlePromiseError.bind(this);
        this.destroyed = false;
        this.activateRuntime();
    }

    activateRuntime() {
        this.destroyed = false;
        this.setupTracking();
    }

    setupTracking() {
        this.lifecycle.listen(window, 'error', this.errorListener);
        this.lifecycle.listen(window, 'unhandledrejection', this.promiseErrorListener);
        this.lifecycle.subscribe(this.eventBus, 'SECURITY_VIOLATION', this.logAttack.bind(this));
        this.lifecycle.subscribe(this.eventBus, 'CONTRACT_VIOLATION', this.logContractViolation.bind(this));
    }

    handleError(error) {
        this.logError(error);
        if (this.errorBoundary?.isCriticalError?.(error)) {
            this.errorBoundary.handleError(error);
        }
    }

    handlePromiseError(event) {
        this.logPromiseError(event);
        if (this.errorBoundary?.isCriticalError?.(event)) {
            this.errorBoundary.handleError({
                message: event?.reason?.message || String(event?.reason || 'Unhandled promise rejection'),
                reason: event?.reason,
                error: event?.reason
            });
        }
    }

    logContractViolation(details) {
        this.log('contract-violation', {
            event: details.event,
            error: details.error,
            payload: this.devMode ? details.payload : '[REDACTED]',
            timestamp: Date.now()
        });
    }

    logAttack(details) {
        this.log('security', {
            type: details.type,
            userId: details.userId || 'anonymous',
            blocked: true,
            pattern: details.pattern,
            timestamp: Date.now()
        });
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
            sessionId: this.sessionId,
            timestamp: Date.now()
        };

        this.logs.push(entry);

        // Trim old logs
        if (this.logs.length > this.maxLogs) {
            this.logs.splice(0, this.maxLogs / 2);
        }

        // Publish for runtime observers and snapshots
        this.eventBus.publish('LOG_ENTRY', entry);
    }

    getSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = uid();
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    export() {
        return {
            logs: this.logs,
            sessionId: this.sessionId
        };
    }

    diagnosticSnapshot(options = {}) {
        return createSnapshot(
            this,
            window?.serviceManager || window?.csma?.serviceManager || null,
            this.eventBus,
            options
        );
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.errorBoundary?.destroy?.();
        this.lifecycle.destroy();
    }
}
