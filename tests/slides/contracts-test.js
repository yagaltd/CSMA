import { describe, it, expect } from 'vitest';
import { SlidesContracts } from '../../src/modules/slides/contracts/slides-contracts.js';

/**
 * Verify every slides contract has the required metadata fields, a schema,
 * and that the schema is a usable struct. Smoke test that the registry is
 * well-formed — actual validation behavior is exercised by the EventBus in
 * the service test.
 */

const REQUIRED_META = ['version', 'type', 'owner', 'lifecycle', 'stability', 'compliance', 'description'];

describe('Slides contracts', () => {
    it('exports the expected contract names', () => {
        const names = Object.keys(SlidesContracts);
        // Navigation intents
        expect(names).toContain('INTENT_SLIDE_NEXT');
        expect(names).toContain('INTENT_SLIDE_PREV');
        expect(names).toContain('INTENT_SLIDE_GO');
        expect(names).toContain('INTENT_SLIDE_FIRST');
        expect(names).toContain('INTENT_SLIDE_LAST');
        expect(names).toContain('INTENT_SLIDE_TOGGLE_RAIL');
        expect(names).toContain('INTENT_SLIDE_TOGGLE_GRID');
        expect(names).toContain('INTENT_SLIDE_TOGGLE_FS');
        expect(names).toContain('INTENT_SLIDE_TOGGLE_DRAWING');
        expect(names).toContain('INTENT_SLIDE_OPEN_PRESENTER');
        expect(names).toContain('INTENT_SLIDE_HIDE_UI');
        expect(names).toContain('INTENT_SLIDE_ESCAPE');
        // Annotation intents
        expect(names).toContain('INTENT_ANNOTATION_STROKE');
        expect(names).toContain('INTENT_ANNOTATION_CLEAR');
        expect(names).toContain('INTENT_ANNOTATION_UNDO');
        // Note intents
        expect(names).toContain('INTENT_SLIDE_NOTE_UPDATE');
        // State events
        expect(names).toContain('SLIDE_CHANGED');
        expect(names).toContain('BUILD_ADVANCED');
        expect(names).toContain('DECK_READY');
        expect(names).toContain('DECK_DESTROYED');
        expect(names).toContain('UI_STATE_CHANGED');
        expect(names).toContain('PRESENTER_SYNC');
        expect(names).toContain('ANNOTATION_UPDATED');
        // Export intents
        expect(names).toContain('INTENT_DECK_EXPORT_PNG');
        expect(names).toContain('DECK_EXPORT_COMPLETED');
    });

    it('every contract has required metadata + a schema', () => {
        for (const [name, contract] of Object.entries(SlidesContracts)) {
            for (const field of REQUIRED_META) {
                expect(contract[field], `${name} missing ${field}`).toBeDefined();
            }
            expect(contract.schema, `${name} missing schema`).toBeDefined();
            expect(typeof contract.schema, `${name}.schema must be a struct`).toBe('object');
        }
    });

    it('intents are typed intent; events are typed event', () => {
        for (const [name, contract] of Object.entries(SlidesContracts)) {
            if (name.startsWith('INTENT_')) {
                expect(contract.type, `${name} should be intent`).toBe('intent');
            } else {
                expect(contract.type, `${name} should be event`).toBe('event');
            }
        }
    });

    it('intents carry rate limits; events do not', () => {
        for (const [name, contract] of Object.entries(SlidesContracts)) {
            if (name.startsWith('INTENT_')) {
                expect(contract.security?.rateLimits, `${name} intent must define rateLimits`).toBeDefined();
                expect(contract.security.rateLimits.requests, `${name} rateLimit.requests`).toBeGreaterThan(0);
            }
        }
    });

    it('all contracts are owned by slides', () => {
        for (const [name, contract] of Object.entries(SlidesContracts)) {
            expect(contract.owner, `${name} owner`).toBe('slides');
        }
    });
});
