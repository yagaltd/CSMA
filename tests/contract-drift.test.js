/**
 * Contract Drift Check Tests (plan item 0.1)
 *
 * Exercises the Phase 0 publish-vs-registry collector functions from
 * tooling/scripts/check-security.js against fixture pairs: one registered
 * event name, one not. Importing the script must NOT run its CLI main body.
 */
import { describe, it, expect } from 'vitest';
import {
    scanPublishCalls,
    collectPublishedNames,
    findContractDrift,
    loadContractCollections,
    mergeContractExports
} from '../tooling/scripts/check-security.js';

const FIXTURE = `
    eventBus.publish('REGISTERED_EVENT', { ok: true });
    eventBus.publish('UNREGISTERED_EVENT', { ok: true });
    eventBus.publishSync("UNREGISTERED_EVENT", { ok: true });
    eventBus._publish('UNREGISTERED_EVENT');
    eventBus.publish(dynamicName, { ok: true });
    eventBus.publish(\`TEMPLATE_EVENT\`, { ok: true });
`;

describe('scanPublishCalls', () => {
    it('collects literal publish/publishSync/_publish names', () => {
        const names = scanPublishCalls(FIXTURE).map((site) => site.name);
        expect(names).toEqual([
            'REGISTERED_EVENT',
            'UNREGISTERED_EVENT',
            'UNREGISTERED_EVENT',
            'UNREGISTERED_EVENT'
        ]);
    });

    it('skips dynamic publishes and template literals by design', () => {
        const names = scanPublishCalls(FIXTURE).map((site) => site.name);
        expect(names).not.toContain('dynamicName');
        expect(names).not.toContain('TEMPLATE_EVENT');
    });
});

describe('collectPublishedNames', () => {
    it('aggregates occurrence counts across files', () => {
        const counts = collectPublishedNames([FIXTURE, FIXTURE]);
        expect(counts.get('REGISTERED_EVENT')).toBe(2);
        expect(counts.get('UNREGISTERED_EVENT')).toBe(6);
    });
});

describe('findContractDrift', () => {
    const registered = new Set(['REGISTERED_EVENT']);

    it('flags the unregistered fixture name with its occurrence count', () => {
        const counts = collectPublishedNames([FIXTURE]);
        const drift = findContractDrift(counts, registered);
        expect(drift.unregistered).toEqual({ UNREGISTERED_EVENT: 3 });
        expect(drift.distinctUnregistered).toBe(1);
        expect(drift.totalOccurrences).toBe(3);
    });

    it('reports no drift when every published name is registered', () => {
        const drift = findContractDrift(new Map([['REGISTERED_EVENT', 2]]), registered);
        expect(drift.unregistered).toEqual({});
        expect(drift.distinctUnregistered).toBe(0);
        expect(drift.totalOccurrences).toBe(0);
    });
});

describe('mergeContractExports', () => {
    // Deterministic fixture test for the share-contracts regression: the merge
    // helper is the part of the loader whose behavior was previously order/
    // walk-dependent. Pinning it with a pure fixture means the contract
    // survives even if the filesystem walk is perturbed by concurrent edits.
    const SHARE_LIMITS = { REQUEST: 60, WINDOW_MS: 60000 };
    const ShareContractsFixture = {
        SHARE_COMPLETED: { type: 'event', schema: {} },
        SHARE_FAILED: { type: 'event', schema: {} }
    };

    it('merges contract-shaped exports and skips non-contract helpers', () => {
        const merged = mergeContractExports({ ShareContracts: ShareContractsFixture, SHARE_LIMITS });
        expect(merged.SHARE_COMPLETED).toBeDefined();
        expect(merged.SHARE_FAILED).toBeDefined();
        expect(merged.REQUEST).toBeUndefined();
        expect(merged.WINDOW_MS).toBeUndefined();
    });

    it('falls back to the first plain object export when nothing is contract-shaped', () => {
        const merged = mergeContractExports({ ONLY_LIMITS: SHARE_LIMITS, OTHER: { A: 1 } });
        expect(merged).toEqual({ REQUEST: 60, WINDOW_MS: 60000 });
    });
});

describe('loadContractCollections', () => {
    it('includes names from every contract-shaped export (share contracts regression)', async () => {
        const collections = await loadContractCollections();
        const registered = new Set();
        for (const { contracts } of collections) {
            for (const name of Object.keys(contracts)) registered.add(name);
        }
        // SHARE_COMPLETED lives in ShareContracts, which shares a file with
        // the SHARE_LIMITS helper export — the loader must merge both shapes.
        expect(registered.has('SHARE_COMPLETED')).toBe(true);
        expect(registered.has('SHARE_FAILED')).toBe(true);
        expect(registered.has('THEME_CHANGED')).toBe(true);
    });
});
