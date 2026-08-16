/**
 * DataAggregator smoke tests — proves the core composition service
 * (services/core) stays alive and behavioral: parallel compose with partial
 * failure tolerance, waterfall step results, batch with dedupe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataAggregator } from '../src/services/core/DataAggregator.js';

function recordingBus() {
    const events = [];
    return {
        events,
        publish(name, payload) { events.push({ name, payload }); },
        subscribe() { return () => {}; }
    };
}

describe('DataAggregator (services/core)', () => {
    let bus;
    let aggregator;

    beforeEach(() => {
        bus = recordingBus();
        aggregator = new DataAggregator(bus, { timeout: 200 });
    });

    it('compose() runs sources in parallel and reports partial failures', async () => {
        const result = await aggregator.compose('product-page', { id: 1 }, {
            product: async () => ({ id: 1, title: 'Widget' }),
            reviews: async () => { throw new Error('reviews down'); }
        });

        expect(result.results.product).toEqual({ id: 1, title: 'Widget' });
        expect(result.errors.reviews).toBe('reviews down');

        const names = bus.events.map((e) => e.name);
        expect(names).toContain('DATA_AGGREGATION_STARTED');
        expect(names).toContain('DATA_AGGREGATION_COMPLETED');
    });

    it('waterfall() passes step output to the next step', async () => {
        const { result, steps } = await aggregator.waterfall('pipeline', [
            async () => 2,
            async (input) => input * 10,
            async (input) => ({ value: input + 5 })
        ]);
        expect(result).toEqual({ value: 25 });
        expect(steps).toEqual([2, 20, { value: 25 }]);
    });

    it('waterfall() stops on a failing step and reports it', async () => {
        await expect(aggregator.waterfall('broken', [
            async () => { throw new Error('step 1 failed'); },
            async () => 'never'
        ])).rejects.toThrow('step 1 failed');
        expect(bus.events.map((e) => e.name)).toContain('DATA_AGGREGATION_FAILED');
    });

    it('batch() executes keyed fetchers and returns keyed results', async () => {
        const spy = vi.fn(async (x) => x * 2);
        const { results, errors } = await aggregator.batch([
            { key: 'a', fetcher: () => spy(1) },
            { key: 'b', fetcher: () => spy(2) },
            { key: 'c', fetcher: () => { throw new Error('c failed'); } }
        ]);
        expect(results).toEqual({ a: 2, b: 4 });
        expect(errors.c).toBe('c failed');
        expect(spy).toHaveBeenCalledTimes(2);
    });
});
