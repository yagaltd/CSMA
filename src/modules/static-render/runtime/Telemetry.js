export class TelemetryCollector {
    constructor({ budgets = {}, onUpdate = null, now = () => Date.now() } = {}) {
        this.budgets = budgets || {};
        this.onUpdate = onUpdate;
        this.now = now;
        this.metrics = {
            hydrations: 0,
            hydrationFailures: 0,
            dataReturns: 0,
            latestRoundtripMs: 0,
            avgRoundtripMs: 0,
            maxRoundtripMs: 0,
            violations: [],
            lastUpdatedAt: 0
        };
        this.inflight = new Map();
        this.#publish();
    }

    updateBudgets(budgets = {}) {
        this.budgets = budgets || {};
    }

    recordHydrationStart(key) {
        if (!key) return;
        this.metrics.hydrations += 1;
        this.inflight.set(key, this.now());
        this.#publish();
    }

    recordHydrationFailure(key, reason = 'unknown') {
        if (key) {
            this.inflight.delete(key);
        }
        this.metrics.hydrationFailures += 1;
        this.#recordViolation('hydration', reason);
        this.#publish();
    }

    recordDataReturned(key) {
        const startedAt = this.inflight.get(key);
        this.inflight.delete(key);
        this.metrics.dataReturns += 1;
        if (typeof startedAt === 'number') {
            const duration = Math.max(0, this.now() - startedAt);
            this.metrics.latestRoundtripMs = duration;
            const count = this.metrics.dataReturns;
            this.metrics.avgRoundtripMs = ((this.metrics.avgRoundtripMs * (count - 1)) + duration) / count;
            this.metrics.maxRoundtripMs = Math.max(this.metrics.maxRoundtripMs, duration);
            if (this.budgets?.hydrationToDataMs && duration > this.budgets.hydrationToDataMs) {
                this.#recordViolation('hydrationToDataMs', `Duration ${duration}ms exceeded budget of ${this.budgets.hydrationToDataMs}ms`, { duration });
            }
        }
        this.#publish();
    }

    snapshot() {
        return {
            hydrations: this.metrics.hydrations,
            hydrationFailures: this.metrics.hydrationFailures,
            dataReturns: this.metrics.dataReturns,
            latestRoundtripMs: this.metrics.latestRoundtripMs,
            avgRoundtripMs: this.metrics.avgRoundtripMs,
            maxRoundtripMs: this.metrics.maxRoundtripMs,
            violations: [...this.metrics.violations],
            lastUpdatedAt: this.metrics.lastUpdatedAt
        };
    }

    #recordViolation(type, message, meta = {}) {
        this.metrics.violations.push({
            type,
            message,
            meta,
            timestamp: this.now()
        });
    }

    #publish() {
        this.metrics.lastUpdatedAt = this.now();
        if (typeof this.onUpdate === 'function') {
            this.onUpdate(this.snapshot());
        }
    }
}
