/**
 * Analytics transport layer for AnalyticsService.
 * Extracted verbatim from AnalyticsService.js (Phase 6.7): fetch keepalive,
 * fetchLater, and sendBeacon dispatch. Reads endpoint state from the service
 * via getters; success callbacks stay owned by the service.
 */
export class AnalyticsTransport {
    constructor(service) {
        this._service = service;
    }

    get analyticsEndpoint() {
        return this._service.analyticsEndpoint;
    }

    get fetchLaterController() {
        return this._service.fetchLaterController;
    }

    set fetchLaterController(value) {
        this._service.fetchLaterController = value;
    }

    async flush(payload, onSuccess, { preferDeferred = false } = {}) {
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
}

