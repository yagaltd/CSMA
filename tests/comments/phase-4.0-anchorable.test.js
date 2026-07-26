import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts } from '../../src/runtime/Contracts.js';
import { CommentsService } from '../../src/modules/comments/services/CommentsService.js';
import { AnchorableCommentsService, COMMENTS_SCHEMA } from '../../src/modules/comments/services/AnchorableCommentsService.js';
import { AnchorResolver, validateAnchorShape } from '../../src/modules/comments/services/AnchorResolver.js';
import { CommentsContracts } from '../../src/modules/comments/contracts/comments-contracts.js';

// ── helpers ────────────────────────────────────────────────────────────

function bus() {
    const eventBus = new EventBus();
    eventBus.contracts = Object.assign({}, Contracts, CommentsContracts);
    return eventBus;
}

/** In-memory implementation of the Storage async interface (no IDB needed). */
function makeFakeStorage() {
    const db = new Map(); // storeName -> Map(id -> item)
    return {
        initCalls: 0,
        updateCalls: 0,
        async init(schema) {
            this.initCalls += 1;
            this.schema = schema;
            for (const store of Object.keys(schema || {})) {
                if (!db.has(store)) db.set(store, new Map());
            }
        },
        async add(store, item) { db.get(store).set(item.id, item); return item.id; },
        async get(store, id) { return db.get(store)?.get(id) ?? null; },
        async getAll(store) { return [...(db.get(store)?.values() || [])]; },
        async update(store, item) { this.updateCalls += 1; db.get(store).set(item.id, item); return item.id; },
        async delete(store, id) { db.get(store).delete(id); },
        async clear(store) { db.get(store).clear(); },
        async count(store) { return db.get(store)?.size || 0; }
    };
}

function recorder(eventBus) {
    const events = [];
    const subscribe = (name) => eventBus.subscribe(name, (p) => events.push({ name, payload: p }));
    return { events, subscribe };
}

function elementAnchor(id) { return { anchor_type: 'element', anchor: { id } }; }

describe('Phase 4.0 — AnchorableCommentsService', () => {
    let eventBus;
    let service;

    beforeEach(async () => {
        eventBus = bus();
        service = new AnchorableCommentsService(eventBus);
    });

    // ── lifecycle ──────────────────────────────────────────────────────

    it('initializes in-memory only when no storage backend is available', async () => {
        await service.init({});
        expect(service.persist).toBe(false);
        expect(service.storage).toBe(null);
        expect(service.initialized).toBe(true);
    });

    it('initializes a storage backend and records the comments schema', async () => {
        const storage = makeFakeStorage();
        await service.init({ storage });
        expect(service.persist).toBe(true);
        expect(storage.initCalls).toBe(1);
        expect(storage.schema).toBe(COMMENTS_SCHEMA);
        expect(storage.schema.comments.indexes).toEqual({ scope: 'scope', anchor_type: 'anchor_type', status: 'status', parent_id: 'parent_id' });
    });

    it('destroy unsubscribes intent handlers', async () => {
        await service.init({});
        service.destroy();
        const fired = await eventBus.publish('INTENT_COMMENT_ADD', {
            anchor: elementAnchor('x'), body: 'after destroy', timestamp: Date.now()
        });
        expect(fired).toEqual([]);
        expect(service.comments.size).toBe(0);
    });

    // ── add ────────────────────────────────────────────────────────────

    it('add() creates an anchored comment with full lifecycle fields', async () => {
        await service.init({});
        const rec = recorder(eventBus);
        rec.subscribe('COMMENT_ADDED'); rec.subscribe('COMMENT_COUNT_CHANGED');
        const c = service.add({ scope: 'deck:slide-3', anchor: elementAnchor('headline'), body: 'Fix typo', author: { id: 'u1' } });

        expect(c.id).toBeTruthy();
        expect(c.scope).toBe('deck:slide-3');
        expect(c.anchor_type).toBe('element');
        expect(c.anchor).toEqual({ id: 'headline' });
        expect(c.parent_id).toBe(null);
        expect(c.status).toBe('open');
        expect(c.author).toEqual({ id: 'u1' });
        expect(c.resolved_at).toBe(null);
        expect(c.edited_at).toBe(null);
        expect(rec.events.some((e) => e.name === 'COMMENT_ADDED')).toBe(true);
        const countEvt = rec.events.find((e) => e.name === 'COMMENT_COUNT_CHANGED');
        expect(countEvt.payload).toMatchObject({ scope: 'deck:slide-3', openCount: 1, totalCount: 1 });
    });

    it('add() throws a clear error for an invalid anchor shape', async () => {
        await service.init({});
        // element anchor with both id and selector (not XOR)
        expect(() => service.add({ anchor: { anchor_type: 'element', anchor: { id: 'a', selector: 'b' } }, body: 'x' }))
            .toThrow(/exactly one of \{ id \} or \{ selector \}/);
        // unknown type
        expect(() => service.add({ anchor: { anchor_type: 'region', anchor: {} }, body: 'x' }))
            .toThrow(/unsupported anchor_type/);
        // text missing path
        expect(() => service.add({ anchor: { anchor_type: 'text', anchor: { start: 1, end: 2 } }, body: 'x' }))
            .toThrow(/text anchor requires \{ path/);
        // point missing coords
        expect(() => service.add({ anchor: { anchor_type: 'point', anchor: { x: 1 } }, body: 'x' }))
            .toThrow(/point anchor requires/);
    });

    it('add() requires a non-empty body', async () => {
        await service.init({});
        expect(() => service.add({ anchor: elementAnchor('h'), body: '' })).toThrow(/body is required/);
    });

    // ── reply / resolve / reopen / edit / delete ───────────────────────

    it('reply() inherits parent scope + anchor and sets parent_id', async () => {
        await service.init({});
        const parent = service.add({ scope: 'deck:slide-3', anchor: elementAnchor('h'), body: 'root' });
        const r = service.reply(parent.id, 'agreed', { author: { id: 'u2' } });
        expect(r.parent_id).toBe(parent.id);
        expect(r.scope).toBe('deck:slide-3');
        expect(r.anchor).toEqual({ id: 'h' });
        expect(r.status).toBe('open');
        expect(service.getByScope('deck:slide-3')).toHaveLength(2);
    });

    it('reply() throws when the parent does not exist', async () => {
        await service.init({});
        expect(() => service.reply('nope', 'x')).toThrow(/parent "nope" not found/);
    });

    it('resolve() sets status resolved, fires COMMENT_RESOLVED, and decrements open count', async () => {
        await service.init({});
        const rec = recorder(eventBus);
        rec.subscribe('COMMENT_RESOLVED'); rec.subscribe('COMMENT_COUNT_CHANGED');
        const c = service.add({ scope: 'deck:slide-1', anchor: elementAnchor('h'), body: 'q' });
        expect(service.countOpen('deck:slide-1')).toBe(1);
        const r = service.resolve(c.id, { id: 'u1' });
        expect(r.status).toBe('resolved');
        expect(r.resolved_at).toBeGreaterThan(0);
        expect(r.resolved_by).toEqual({ id: 'u1' });
        expect(service.countOpen('deck:slide-1')).toBe(0);
        const evt = rec.events.find((e) => e.name === 'COMMENT_RESOLVED');
        expect(evt.payload).toMatchObject({ id: c.id });
    });

    it('reopen() reverses resolve and re-counts as open', async () => {
        await service.init({});
        const rec = recorder(eventBus); rec.subscribe('COMMENT_REOPENED');
        const c = service.add({ scope: 's', anchor: elementAnchor('h'), body: 'q' });
        service.resolve(c.id);
        expect(service.countOpen('s')).toBe(0);
        const r = service.reopen(c.id);
        expect(r.status).toBe('reopened');
        expect(r.resolved_at).toBe(null);
        expect(service.countOpen('s')).toBe(1);
        expect(rec.events.some((e) => e.name === 'COMMENT_REOPENED')).toBe(true);
    });

    it('edit() updates body, sets edited_at, and fires COMMENT_UPDATED', async () => {
        await service.init({});
        const rec = recorder(eventBus); rec.subscribe('COMMENT_UPDATED');
        const c = service.add({ scope: 's', anchor: elementAnchor('h'), body: 'old' });
        const r = service.edit(c.id, 'new body');
        expect(r.body).toBe('new body');
        expect(r.edited_at).toBeGreaterThan(0);
        const evt = rec.events.find((e) => e.name === 'COMMENT_UPDATED');
        expect(evt.payload.changes).toMatchObject({ body: 'new body' });
    });

    it('delete() soft-deletes (status deleted) and retains the record', async () => {
        await service.init({});
        const rec = recorder(eventBus); rec.subscribe('COMMENT_REMOVED');
        const c = service.add({ scope: 's', anchor: elementAnchor('h'), body: 'bye' });
        const r = service.delete(c.id);
        expect(r.status).toBe('deleted');
        expect(service.comments.get(c.id).status).toBe('deleted');
        expect(service.countOpen('s')).toBe(0);
        expect(rec.events.some((e) => e.name === 'COMMENT_REMOVED')).toBe(true);
    });

    // ── queries ────────────────────────────────────────────────────────

    it('getByAnchor() returns only comments matching the anchor', async () => {
        await service.init({});
        const a1 = elementAnchor('h1');
        const a2 = { anchor_type: 'element', anchor: { selector: '[data-comment-id="X"]' } };
        service.add({ scope: 's', anchor: a1, body: 'one' });
        service.add({ scope: 's', anchor: a2, body: 'two' });
        service.add({ scope: 's', anchor: a1, body: 'three' });
        expect(service.getByAnchor(a1)).toHaveLength(2);
        expect(service.getByAnchor(a2)).toHaveLength(1);
    });

    it('getByScope() filters by host context', async () => {
        await service.init({});
        service.add({ scope: 'deck:slide-3', anchor: elementAnchor('a'), body: 'x' });
        service.add({ scope: 'deck:slide-4', anchor: elementAnchor('b'), body: 'y' });
        service.add({ scope: 'deck:slide-3', anchor: elementAnchor('c'), body: 'z' });
        expect(service.getByScope('deck:slide-3')).toHaveLength(2);
        expect(service.getByScope('deck:slide-4')).toHaveLength(1);
    });

    it('countOpen(scope) scopes; countOpen() totals across all scopes', async () => {
        await service.init({});
        const c1 = service.add({ scope: 'deck:slide-3', anchor: elementAnchor('a'), body: 'x' });
        service.add({ scope: 'deck:slide-4', anchor: elementAnchor('b'), body: 'y' });
        service.resolve(c1.id);
        expect(service.countOpen('deck:slide-3')).toBe(0);
        expect(service.countOpen('deck:slide-4')).toBe(1);
        expect(service.countOpen()).toBe(1);
    });

    // ── persistence ────────────────────────────────────────────────────

    it('persists comments and restores them on reload from the same store', async () => {
        const storage = makeFakeStorage();
        const a = new AnchorableCommentsService(bus());
        await a.init({ storage });
        const c = a.add({ scope: 'deck:slide-3', anchor: elementAnchor('h'), body: 'persisted', author: { id: 'u1' } });
        await a._flushPersist();
        await a.destroy();

        // New service instance sharing the same in-memory store reloads.
        const b = new AnchorableCommentsService(bus());
        await b.init({ storage });
        const restored = b.getByScope('deck:slide-3');
        expect(restored).toHaveLength(1);
        expect(restored[0].id).toBe(c.id);
        expect(restored[0].body).toBe('persisted');
        expect(restored[0].author).toEqual({ id: 'u1' });
        expect(b.countOpen('deck:slide-3')).toBe(1);
    });

    it('debounces persist writes (coalesces mutations within 50ms)', async () => {
        vi.useFakeTimers();
        try {
            const storage = makeFakeStorage();
            const s = new AnchorableCommentsService(bus());
            await s.init({ storage });
            s.add({ scope: 's', anchor: elementAnchor('a'), body: '1' });
            s.add({ scope: 's', anchor: elementAnchor('b'), body: '2' });
            s.add({ scope: 's', anchor: elementAnchor('c'), body: '3' });
            expect(storage.updateCalls).toBe(0); // not flushed yet
            await vi.advanceTimersByTimeAsync(50);
            expect(storage.updateCalls).toBe(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it('falls back to in-memory when storage.init rejects', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const failing = { ...makeFakeStorage(), async init() { throw new Error('boom'); } };
        await service.init({ storage: failing });
        expect(service.persist).toBe(false);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    // ── back-compat with flat CommentsService ──────────────────────────

    it('base CommentsService submit()/getComments() still work unchanged', async () => {
        const base = new CommentsService(eventBus);
        base.init({ comments: [{ id: 'c1', threadId: 't1', body: 'hi', status: 'published' }] });
        const pending = base.submit({ threadId: 't1', body: 'pending' });
        expect(pending.status).toBe('pending');
        expect(base.getComments('t1')).toHaveLength(2);
        base.destroy();
    });

    it('AnchorableCommentsService keeps submit() as a back-compat alias', async () => {
        await service.init({});
        const rec = recorder(eventBus); rec.subscribe('COMMENT_SUBMITTED');
        const c = service.submit({ threadId: 't1', body: 'legacy' });
        expect(c.threadId).toBe('t1');
        expect(service.getComments('t1')).toHaveLength(1);
        expect(rec.events.some((e) => e.name === 'COMMENT_SUBMITTED')).toBe(true);
    });

    // ── contract / intent validation ──────────────────────────────────

    it('INTENT_COMMENT_ADD drives add() through the contract-validated bus', async () => {
        await service.init({});
        const rec = recorder(eventBus); rec.subscribe('COMMENT_ADDED');
        await eventBus.publish('INTENT_COMMENT_ADD', {
            scope: 'deck:slide-2', anchor: elementAnchor('h'), body: 'via intent', timestamp: Date.now()
        });
        expect(service.getByScope('deck:slide-2')).toHaveLength(1);
        expect(rec.events.some((e) => e.name === 'COMMENT_ADDED')).toBe(true);
    });

    it('intent lifecycle (reply/resolve/reopen/edit/delete) round-trips via the bus', async () => {
        await service.init({});
        const root = await eventBus.publish('INTENT_COMMENT_ADD', {
            scope: 's', anchor: elementAnchor('h'), body: 'root', timestamp: Date.now()
        });
        const id = service.getByScope('s')[0].id;
        await eventBus.publish('INTENT_COMMENT_REPLY', { parentId: id, body: 'reply', timestamp: Date.now() });
        await eventBus.publish('INTENT_COMMENT_RESOLVE', { id, resolvedBy: { id: 'u1' }, timestamp: Date.now() });
        expect(service.comments.get(id).status).toBe('resolved');
        await eventBus.publish('INTENT_COMMENT_REOPEN', { id, timestamp: Date.now() });
        expect(service.comments.get(id).status).toBe('reopened');
        await eventBus.publish('INTENT_COMMENT_EDIT', { id, body: 'edited', timestamp: Date.now() });
        expect(service.comments.get(id).body).toBe('edited');
        await eventBus.publish('INTENT_COMMENT_DELETE', { id, timestamp: Date.now() });
        expect(service.comments.get(id).status).toBe('deleted');
    });

    it('drawer open/close intents emit the matching state events', async () => {
        await service.init({});
        const rec = recorder(eventBus);
        rec.subscribe('COMMENTS_DRAWER_OPENED'); rec.subscribe('COMMENTS_DRAWER_CLOSED');
        await eventBus.publish('INTENT_COMMENTS_OPEN_DRAWER', { scope: 'deck', timestamp: Date.now() });
        await eventBus.publish('INTENT_COMMENTS_CLOSE_DRAWER', { timestamp: Date.now() });
        expect(rec.events.find((e) => e.name === 'COMMENTS_DRAWER_OPENED').payload.scope).toBe('deck');
        expect(rec.events.some((e) => e.name === 'COMMENTS_DRAWER_CLOSED')).toBe(true);
    });

    it('rejects malformed intent payloads (contract envelope)', async () => {
        await service.init({});
        // missing required timestamp → contract violation → []
        const r1 = await eventBus.publish('INTENT_COMMENT_ADD', { anchor: elementAnchor('h'), body: 'x' });
        expect(r1).toEqual([]);
        // unknown key → strict object rejects
        const r2 = await eventBus.publish('INTENT_COMMENT_DELETE', { id: 'x', bogus: true, timestamp: Date.now() });
        expect(r2).toEqual([]);
        // bad anchor_type enum at envelope level
        const r3 = await eventBus.publish('INTENT_COMMENT_ADD', {
            anchor: { anchor_type: 'region', anchor: {} }, body: 'x', timestamp: Date.now()
        });
        expect(r3).toEqual([]);
    });

    it('validateAnchorShape accepts the three canonical anchor shapes', () => {
        expect(validateAnchorShape({ anchor_type: 'element', anchor: { id: 'x' } })).toBeTruthy();
        expect(validateAnchorShape({ anchor_type: 'element', anchor: { selector: '.a' } })).toBeTruthy();
        expect(validateAnchorShape({ anchor_type: 'text', anchor: { path: ['p', 0], start: 0, end: 3 } })).toBeTruthy();
        expect(validateAnchorShape({ anchor_type: 'point', anchor: { x: 1, y: 2, scope: 'map' } })).toBeTruthy();
    });
});

describe('Phase 4.0 — AnchorResolver', () => {
    let resolver;
    beforeEach(() => { resolver = new AnchorResolver(); });

    it('resolves an element anchor by id', () => {
        document.body.innerHTML = '<div id="slide-3-headline"></div>';
        const el = resolver.resolve({ anchor_type: 'element', anchor: { id: 'slide-3-headline' } });
        expect(el).toBe(document.getElementById('slide-3-headline'));
    });

    it('resolves an element anchor by selector', () => {
        document.body.innerHTML = '<section><span class="hl" data-comment-id="X"></span></section>';
        const el = resolver.resolve({ anchor_type: 'element', anchor: { selector: '[data-comment-id="X"]' } });
        expect(el).not.toBeNull();
        expect(el.className).toBe('hl');
    });

    it('returns null when the element is not found', () => {
        document.body.innerHTML = '<div></div>';
        expect(resolver.resolve({ anchor_type: 'element', anchor: { id: 'missing' } })).toBeNull();
        expect(resolver.resolve({ anchor_type: 'element', anchor: { selector: '.nope' } })).toBeNull();
    });

    it('prefers a custom registered resolver over the built-ins', () => {
        const fake = {};
        resolver.registerResolver('element', (inner) => (inner.id === 'special' ? fake : null));
        expect(resolver.resolve({ anchor_type: 'element', anchor: { id: 'special' } })).toBe(fake);
    });

    it('returns null for text and point anchors in 4.0 (stubbed)', () => {
        expect(resolver.resolve({ anchor_type: 'text', anchor: { path: [], start: 0, end: 1 } })).toBeNull();
        expect(resolver.resolve({ anchor_type: 'point', anchor: { x: 1, y: 2 } })).toBeNull();
    });

    it('returns null for a null/invalid anchor envelope', () => {
        expect(resolver.resolve(null)).toBeNull();
        expect(resolver.resolve({})).toBeNull();
    });

    it('registerResolver rejects a non-function resolver', () => {
        expect(() => resolver.registerResolver('element', 'nope')).toThrow(/must be a function/);
    });
});
