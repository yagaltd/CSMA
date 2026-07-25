/**
 * Visual Editor — AnnotationCommentSync Tests
 *
 * Tests the sync bridge between AnnotationCommentService events and
 * ActionLogService CRDT intents, plus incoming sync intent handling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnnotationCommentSync } from '../src/modules/visual-editor/services/AnnotationCommentSync.js';
import { registerAnnotationCommentCrdts } from '../src/modules/visual-editor/services/AnnotationCommentCrdt.js';

// ===========================================================================
// Test helpers
// ===========================================================================

function makeMockEventBus() {
    const listeners = new Map();

    const bus = {
        publish(name, payload) {
            const handlers = listeners.get(name);
            if (handlers) {
                for (const fn of handlers) {
                    fn(payload);
                }
            }
        },
        subscribe(eventName, handler) {
            if (!listeners.has(eventName)) {
                listeners.set(eventName, []);
            }
            listeners.get(eventName).push(handler);
            return () => {
                const arr = listeners.get(eventName);
                if (arr) {
                    const idx = arr.indexOf(handler);
                    if (idx >= 0) arr.splice(idx, 1);
                }
            };
        },
        _clear() {
            listeners.clear();
        }
    };
    return bus;
}

function makeMockActionLog() {
    const self = {
        records: [],
        record(intent, payload) {
            self.records.push({ intent, payload });
        },
        _clear() {
            self.records = [];
        }
    };
    return self;
}

function makeMockCommentService() {
    const self = {
        addCommentCalls: [],
        resolveCommentCalls: [],
        reopenCommentCalls: [],
        editCommentCalls: [],

        addComment(anchor, payload) {
            self.addCommentCalls.push({ anchor, payload });
            return 'test_id';
        },
        resolveComment(id) {
            self.resolveCommentCalls.push(id);
        },
        reopenComment(id) {
            self.reopenCommentCalls.push(id);
        },
        editComment(id, body) {
            self.editCommentCalls.push({ id, body });
        },
        _clear() {
            self.addCommentCalls = [];
            self.resolveCommentCalls = [];
            self.reopenCommentCalls = [];
            self.editCommentCalls = [];
        }
    };
    return self;
}

function makeMockRegistry() {
    const self = {
        registerCalls: [],
        registerIntent(intentName, config) {
            self.registerCalls.push({ intentName, config });
        },
        _clear() {
            self.registerCalls = [];
        }
    };
    return self;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('AnnotationCommentSync', () => {
    let eventBus;
    let actionLog;
    let commentService;
    let sync;

    beforeEach(() => {
        eventBus = makeMockEventBus();
        actionLog = makeMockActionLog();
        commentService = makeMockCommentService();
        sync = new AnnotationCommentSync(eventBus, actionLog, commentService);
    });

    // -----------------------------------------------------------------------
    // Outgoing events
    // -----------------------------------------------------------------------

    it('subscribes to ANNOTATION_COMMENT_ADDED and pushes to actionLog', () => {
        sync.init();

        const payload = { editorId: 'e1', commentId: 'c1', anchor: { type: 'text' }, payload: { body: 'hello' } };
        eventBus.publish('ANNOTATION_COMMENT_ADDED', payload);

        expect(actionLog.records).toHaveLength(1);
        expect(actionLog.records[0]).toEqual({ intent: 'ANNOTATION_COMMENT_ADD', payload });
    });

    it('subscribes to ANNOTATION_COMMENT_RESOLVED and pushes to actionLog', () => {
        sync.init();

        const payload = { editorId: 'e1', commentId: 'c1', payload: { status: 'resolved' } };
        eventBus.publish('ANNOTATION_COMMENT_RESOLVED', payload);

        expect(actionLog.records).toHaveLength(1);
        expect(actionLog.records[0]).toEqual({ intent: 'ANNOTATION_COMMENT_RESOLVE', payload });
    });

    it('subscribes to ANNOTATION_COMMENT_REOPENED and pushes to actionLog', () => {
        sync.init();

        const payload = { editorId: 'e1', commentId: 'c1', payload: { status: 'reopened' } };
        eventBus.publish('ANNOTATION_COMMENT_REOPENED', payload);

        expect(actionLog.records).toHaveLength(1);
        expect(actionLog.records[0]).toEqual({ intent: 'ANNOTATION_COMMENT_REOPEN', payload });
    });

    it('subscribes to ANNOTATION_COMMENT_UPDATED and pushes to actionLog', () => {
        sync.init();

        const payload = { editorId: 'e1', commentId: 'c1', payload: { body: 'edited' } };
        eventBus.publish('ANNOTATION_COMMENT_UPDATED', payload);

        expect(actionLog.records).toHaveLength(1);
        expect(actionLog.records[0]).toEqual({ intent: 'ANNOTATION_COMMENT_EDIT', payload });
    });

    // -----------------------------------------------------------------------
    // Incoming sync intents
    // -----------------------------------------------------------------------

    it('applies incoming ANNOTATION_COMMENT_ADD via commentService.addComment', () => {
        sync.init();

        const ev = {
            intent: 'ANNOTATION_COMMENT_ADD',
            payload: {
                commentId: 'c1',
                anchor: { type: 'text', path: 'body', start_offset: 0, end_offset: 5 },
                payload: { body: 'hello' }
            }
        };
        eventBus.publish('SYNC_INTENT_APPLIED', ev);

        expect(commentService.addCommentCalls).toHaveLength(1);
        expect(commentService.addCommentCalls[0]).toEqual({
            anchor: ev.payload.anchor,
            payload: ev.payload.payload
        });
    });

    it('applies incoming ANNOTATION_COMMENT_RESOLVE via commentService.resolveComment', () => {
        sync.init();

        const ev = {
            intent: 'ANNOTATION_COMMENT_RESOLVE',
            payload: { commentId: 'c1' }
        };
        eventBus.publish('SYNC_INTENT_APPLIED', ev);

        expect(commentService.resolveCommentCalls).toEqual(['c1']);
    });

    it('applies incoming ANNOTATION_COMMENT_REOPEN via commentService.reopenComment', () => {
        sync.init();

        const ev = {
            intent: 'ANNOTATION_COMMENT_REOPEN',
            payload: { commentId: 'c1' }
        };
        eventBus.publish('SYNC_INTENT_APPLIED', ev);

        expect(commentService.reopenCommentCalls).toEqual(['c1']);
    });

    it('applies incoming ANNOTATION_COMMENT_EDIT via commentService.editComment', () => {
        sync.init();

        const ev = {
            intent: 'ANNOTATION_COMMENT_EDIT',
            payload: {
                commentId: 'c1',
                payload: { body: 'updated text' }
            }
        };
        eventBus.publish('SYNC_INTENT_APPLIED', ev);

        expect(commentService.editCommentCalls).toHaveLength(1);
        expect(commentService.editCommentCalls[0]).toEqual({ id: 'c1', body: 'updated text' });
    });

    it('does nothing for unknown incoming intents', () => {
        sync.init();

        const ev = {
            intent: 'UNKNOWN_INTENT',
            payload: { commentId: 'c1' }
        };
        eventBus.publish('SYNC_INTENT_APPLIED', ev);

        expect(commentService.addCommentCalls).toHaveLength(0);
        expect(commentService.resolveCommentCalls).toHaveLength(0);
        expect(commentService.reopenCommentCalls).toHaveLength(0);
        expect(commentService.editCommentCalls).toHaveLength(0);
    });

    it('does nothing for null/missing event payload', () => {
        sync.init();

        eventBus.publish('SYNC_INTENT_APPLIED', null);
        eventBus.publish('SYNC_INTENT_APPLIED', {});
        eventBus.publish('SYNC_INTENT_APPLIED', undefined);

        expect(commentService.addCommentCalls).toHaveLength(0);
    });

    it('does not crash on incoming ADD with missing anchor', () => {
        sync.init();

        const ev = {
            intent: 'ANNOTATION_COMMENT_ADD',
            payload: { commentId: 'c1' }
        };
        // Should not throw
        expect(() => eventBus.publish('SYNC_INTENT_APPLIED', ev)).not.toThrow();
    });

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    it('unsubscribes on destroy', () => {
        sync.init();
        sync.destroy();

        // After destroy, publishing should not trigger record
        actionLog._clear();
        eventBus.publish('ANNOTATION_COMMENT_ADDED', { commentId: 'c1' });

        expect(actionLog.records).toHaveLength(0);
    });

    it('re-init re-subscribes after destroy', () => {
        sync.init();
        sync.destroy();
        sync.init();

        eventBus.publish('ANNOTATION_COMMENT_ADDED', { commentId: 'c2' });

        expect(actionLog.records).toHaveLength(1);
    });

    it('safe to call destroy without init', () => {
        expect(() => sync.destroy()).not.toThrow();
    });

    it('does not push to actionLog when actionLog is null', () => {
        const syncNoLog = new AnnotationCommentSync(eventBus, null, commentService);
        syncNoLog.init();

        eventBus.publish('ANNOTATION_COMMENT_ADDED', { commentId: 'c1' });

        // Should not throw, and no side effects
        expect(commentService.addCommentCalls).toHaveLength(0);
    });
});

// ===========================================================================
// CRDT Registration
// ===========================================================================

describe('registerAnnotationCommentCrdts', () => {
    it('registers all 5 intents with the CrdtReducerRegistry', () => {
        const registry = makeMockRegistry();
        registerAnnotationCommentCrdts(registry);

        expect(registry.registerCalls).toHaveLength(5);

        const intents = registry.registerCalls.map(c => c.intentName);
        expect(intents).toContain('ANNOTATION_COMMENT_ADD');
        expect(intents).toContain('ANNOTATION_COMMENT_RESOLVE');
        expect(intents).toContain('ANNOTATION_COMMENT_REOPEN');
        expect(intents).toContain('ANNOTATION_COMMENT_EDIT');
        expect(intents).toContain('ANNOTATION_COMMENT_REPLY');
    });

    it('registers with correct CRDT configs', () => {
        const registry = makeMockRegistry();
        registerAnnotationCommentCrdts(registry);

        const addCall = registry.registerCalls.find(c => c.intentName === 'ANNOTATION_COMMENT_ADD');
        expect(addCall.config).toEqual({
            reducerId: 'annotation_comment_set',
            crdt: { type: 'lww-register' }
        });

        const resolveCall = registry.registerCalls.find(c => c.intentName === 'ANNOTATION_COMMENT_RESOLVE');
        expect(resolveCall.config.reducerId).toBe('annotation_comment_status');
        expect(resolveCall.config.crdt.type).toBe('lww-register');

        const reopenCall = registry.registerCalls.find(c => c.intentName === 'ANNOTATION_COMMENT_REOPEN');
        expect(reopenCall.config.reducerId).toBe('annotation_comment_status');
        expect(reopenCall.config.crdt.type).toBe('lww-register');
    });

    it('is a no-op when registry is null/undefined', () => {
        expect(() => registerAnnotationCommentCrdts(null)).not.toThrow();
        expect(() => registerAnnotationCommentCrdts(undefined)).not.toThrow();
    });
});
