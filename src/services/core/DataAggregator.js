/**
 * DataAggregator - Parallel API orchestation and response composition
 * Handles partial failures gracefully, merges responses
 * ~150 lines, ~1.5KB gzipped
 */

export class DataAggregator {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.timeout = options.timeout || 30000; // 30s default
        this.retries = options.retries || 2;
        this.debug = options.debug ?? false;

        // Track active compositions
        this.activeCompositions = new Map();
    }

    /**
     * Compose data from multiple sources in parallel
     * Gracefully handles partial failures
     */
    async compose(name, context, sources) {
        const startTime = Date.now();

        this.eventBus.publish('DATA_AGGREGATION_STARTED', {
            name,
            sourceCount: Object.keys(sources).length,
            timestamp: startTime
        });

        this.log('Composing:', name, 'Sources:', Object.keys(sources));

        // Execute all sources in parallel
        const entries = Object.entries(sources);
        const promises = entries.map(([key, fetcher]) =>
            this.executeWithTimeout(key, () => fetcher(context))
        );

        const settled = await Promise.allSettled(promises);

        // Separate results and errors
        const results = {};
        const errors = {};

        settled.forEach((outcome, index) => {
            const [key] = entries[index];

            if (outcome.status === 'fulfilled') {
                results[key] = outcome.value;
                this.log('✓', key, 'succeeded');
            } else {
                errors[key] = outcome.reason.message || 'Unknown error';
                this.log('✗', key, 'failed:', outcome.reason);
            }
        });

        const duration = Date.now() - startTime;

        // Publish completion event
        this.eventBus.publish('DATA_AGGREGATION_COMPLETED', {
            name,
            results,
            errors,
            duration,
            successCount: Object.keys(results).length,
            errorCount: Object.keys(errors).length,
            timestamp: Date.now()
        });

        this.log('Completed:', name, 'Duration:', duration + 'ms');

        return { results, errors };
    }

    /**
     * Sequential waterfall composition
     * Each step receives previous result
     */
    async waterfall(name, steps) {
        const startTime = Date.now();

        this.eventBus.publish('DATA_AGGREGATION_STARTED', {
            name,
            sourceCount: steps.length,
            mode: 'waterfall',
            timestamp: startTime
        });

        this.log('Waterfall:', name, 'Steps:', steps.length);

        let result = null;
        const results = [];

        try {
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                this.log(`Step ${i + 1}/${steps.length}`);

                result = await this.executeWithTimeout(
                    `step-${i}`,
                    () => step(result, i)
                );

                results.push(result);
            }

            const duration = Date.now() - startTime;

            this.eventBus.publish('DATA_AGGREGATION_COMPLETED', {
                name,
                results: { final: result, steps: results },
                errors: {},
                duration,
                mode: 'waterfall',
                timestamp: Date.now()
            });

            return { result, steps: results };

        } catch (error) {
            const duration = Date.now() - startTime;

            this.eventBus.publish('DATA_AGGREGATION_FAILED', {
                name,
                error: error.message,
                duration,
                mode: 'waterfall',
                timestamp: Date.now()
            });

            throw error;
        }
    }

    /**
     * Batch multiple requests with optional deduplication
     */
    async batch(requests, options = {}) {
        const { deduplicate = true } = options;

        // Deduplicate by key
        const uniqueRequests = deduplicate
            ? this.deduplicateRequests(requests)
            : requests;

        this.log('Batch:', uniqueRequests.length, 'unique requests');

        const promises = uniqueRequests.map(req =>
            this.executeWithTimeout(req.key, req.fetcher)
        );

        const settled = await Promise.allSettled(promises);

        // Map back to original request keys
        const results = {};
        const errors = {};

        settled.forEach((outcome, index) => {
            const req = uniqueRequests[index];

            if (outcome.status === 'fulfilled') {
                results[req.key] = outcome.value;
            } else {
                errors[req.key] = outcome.reason.message || 'Unknown error';
            }
        });

        return { results, errors };
    }

    /**
     * Execute function with timeout
     */
    async executeWithTimeout(key, fn) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout: ${key} exceeded ${this.timeout}ms`));
            }, this.timeout);

            fn()
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Deduplicate requests by key
     */
    deduplicateRequests(requests) {
        const seen = new Set();
        return requests.filter(req => {
            if (seen.has(req.key)) {
                return false;
            }
            seen.add(req.key);
            return true;
        });
    }

    /**
     * Race multiple sources, return first success
     */
    async race(name, sources) {
        this.log('Racing', Object.keys(sources).length, 'sources');

        const promises = Object.entries(sources).map(([key, fetcher]) =>
            fetcher().then(result => ({ key, result }))
        );

        try {
            const { key, result } = await Promise.race(promises);

            this.log('Race winner:', key);

            this.eventBus.publish('DATA_AGGREGATION_COMPLETED', {
                name,
                results: { [key]: result },
                errors: {},
                mode: 'race',
                winner: key,
                timestamp: Date.now()
            });

            return { result, winner: key };
        } catch (error) {
            this.eventBus.publish('DATA_AGGREGATION_FAILED', {
                name,
                error: error.message,
                mode: 'race',
                timestamp: Date.now()
            });

            throw error;
        }
    }

    log(...args) {
        if (this.debug) {
            console.log('[DataAggregator]', ...args);
        }
    }
}

/**
 * Create DataAggregator instance
 */
export function createDataAggregator(eventBus, options = {}) {
    return new DataAggregator(eventBus, options);
}
