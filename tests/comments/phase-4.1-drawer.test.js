/**
 * @vitest-environment jsdom
 *
 * Phase 4.1 — CommentsDrawer + CommentsBadge.
 *
 * Verifies the drawer controller reacts to service events, renders the
 * comment list, routes user gestures through EventBus intents (never calling
 * the service directly), handles inline edit/reply, focus highlight, and the
 * badge stays in sync with COMMENT_COUNT_CHANGED.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts } from '../../src/runtime/Contracts.js';
import { CommentsService } from '../../src/modules/comments/services/CommentsService.js';
import { AnchorableCommentsService } from '../../src/modules/comments/services/AnchorableCommentsService.js';
import { CommentsContracts } from '../../src/modules/comments/contracts/comments-contracts.js';
import { createOverlayManager } from '../../src/modules/archetypes/overlay-manager/overlay-manager.js';
import { createCommentsDrawer } from '../../src/modules/comments/ui/CommentsDrawer.js';
import { wireCommentsBadge } from '../../src/modules/comments/ui/CommentsBadge.js';

// ── helpers ────────────────────────────────────────────────────────────

function bus() {
    const eventBus = new EventBus();
    eventBus.contracts = Object.assign({}, Contracts, CommentsContracts);
    return eventBus;
}

function recorder(eventBus) {
    const events = [];
    const names = [
        'INTENT_COMMENT_ADD', 'INTENT_COMMENT_REPLY', 'INTENT_COMMENT_RESOLVE',
        'INTENT_COMMENT_REOPEN', 'INTENT_COMMENT_EDIT', 'INTENT_COMMENT_DELETE',
        'INTENT_COMMENTS_FOCUS'
    ];
    names.forEach((n) => eventBus.subscribe(n, (p) => events.push({ name: n, payload: p })));
    return events;
}

function elementAnchor(id) { return { anchor_type: 'element', anchor: { id } }; }

/** Minimal fake storage matching the Storage async interface. */
function makeFakeStorage() {
    const db = new Map();
    return {
        initCalls: 0,
        schema: null,
        async init(schema) { this.initCalls += 1; this.schema = schema; for (const [store] of Object.entries(schema || {})) db.set(store, new Map()); },
        async getAll(store) { return [...(db.get(store)?.values() || [])]; },
        async get(store, id) { return db.get(store)?.get(id) || null; },
        async update(store, item) { db.get(store).set(item.id, item); return item.id; },
        async delete(store, id) { db.get(store).delete(id); },
        async clear(store) { db.get(store).clear(); },
        async count(store) { return db.get(store)?.size || 0; }
    };
}

async function makeService(eventBus) {
    const service = new AnchorableCommentsService(eventBus);
    service.setServiceManager({ get: () => makeFakeStorage() });
    await service.init({ storage: makeFakeStorage() });
    return service;
}

async function setup() {
    document.body.innerHTML = '';
    const eventBus = bus();
    const service = await makeService(eventBus);
    const overlay = createOverlayManager(document.body);
    const events = recorder(eventBus);
    const drawer = createCommentsDrawer({ eventBus, service, overlayManager: overlay });
    return { eventBus, service, overlay, drawer, events };
}

const SCOPE = 'deck:slide-3';

async function seed(service, overrides = {}) {
    return service.add({
        scope: SCOPE,
        anchor: elementAnchor('el-' + Math.random().toString(36).slice(2, 7)),
        body: 'First comment',
        ...overrides
    });
}

function publishSync(eventBus, name, payload) {
    if (typeof eventBus.publishSync === 'function') eventBus.publishSync(name, payload);
    else eventBus.publish(name, payload);
}

// ── Drawer ─────────────────────────────────────────────────────────────

describe('Phase 4.1 — CommentsDrawer', () => {
    let env;

    beforeEach(async () => {
        env = await setup();
    });

    it('opens on COMMENTS_DRAWER_OPENED and mounts the overlay drawer', () => {
        const { eventBus } = env;
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        expect(env.drawer.isOpen()).toBe(true);
        expect(document.querySelector('.csma-overlay-drawer')).toBeTruthy();
        expect(document.querySelector('.csma-comments-drawer')).toBeTruthy();
    });

    it('closes on COMMENTS_DRAWER_CLOSED', () => {
        const { eventBus } = env;
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        publishSync(eventBus, 'COMMENTS_DRAWER_CLOSED', { timestamp: Date.now() });
        expect(env.drawer.isOpen()).toBe(false);
        expect(document.querySelector('.csma-comments-drawer')).toBeNull();
    });

    it('renders seeded comments and excludes soft-deleted ones', async () => {
        const { eventBus, service } = env;
        await seed(service, { body: 'visible one' });
        const del = await seed(service, { body: 'gone' });
        service.delete(del.id);
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        const bodies = [...document.querySelectorAll('.csma-comment-body')].map((e) => e.textContent);
        expect(bodies).toContain('visible one');
        expect(bodies).not.toContain('gone');
    });

    it('re-renders live on COMMENT_ADDED while open', async () => {
        const { eventBus, service } = env;
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        expect(document.querySelectorAll('.csma-comment').length).toBe(0);
        await seed(service, { body: 'live-added' });
        const bodies = [...document.querySelectorAll('.csma-comment-body')].map((e) => e.textContent);
        expect(bodies).toContain('live-added');
    });

    it('does NOT re-render when closed (no leaked DOM)', async () => {
        const { eventBus, service } = env;
        await seed(service, { body: 'x' });
        // never opened
        await seed(service, { body: 'y' });
        expect(document.querySelector('.csma-comments-drawer')).toBeNull();
    });

    it('filter Open hides resolved; All shows them', async () => {
        const { eventBus, service } = env;
        const c1 = await seed(service, { body: 'open-1' });
        await seed(service, { body: 'open-2' });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        expect(document.querySelectorAll('.csma-comment').length).toBe(2);
        service.resolve(c1.id);
        // 'open' filter default → only 1 remains
        expect(document.querySelectorAll('.csma-comment').length).toBe(1);
        // switch to All
        const allTab = [...document.querySelectorAll('.csma-comments-filter')].find((b) => b.dataset.filter === 'all');
        allTab.click();
        expect(document.querySelectorAll('.csma-comment').length).toBe(2);
    });

    it('add composer publishes INTENT_COMMENT_ADD (does not call service directly)', () => {
        const { eventBus, events } = env;
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        const input = document.querySelector('.csma-comments-input');
        input.value = 'hello world';
        document.querySelector('.csma-comments-add-btn').click();
        const add = events.find((e) => e.name === 'INTENT_COMMENT_ADD');
        expect(add).toBeTruthy();
        expect(add.payload.body).toBe('hello world');
        expect(add.payload.scope).toBe(SCOPE);
        expect(add.payload.anchor.anchor_type).toBe('element');
        expect(input.value).toBe(''); // cleared after submit
    });

    it('resolve / reopen / delete buttons publish the right intents', async () => {
        const { eventBus, service, events } = env;
        const c = await seed(service, { body: 'target' });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        // switch to All so resolved comments stay visible through the lifecycle
        [...document.querySelectorAll('.csma-comments-filter')].find((b) => b.dataset.filter === 'all').click();
        // resolve (intent) → service resolves → re-render
        document.querySelector(`[data-id="${c.id}"] button[data-action="resolve"]`).click();
        // commit resolve so Reopen button renders on the live card
        service.resolve(c.id);
        document.querySelector(`[data-id="${c.id}"] button[data-action="reopen"]`).click();
        service.reopen(c.id);
        // re-query each time: every mutation re-renders and detaches the old card
        document.querySelector(`[data-id="${c.id}"] button[data-action="delete"]`).click();
        expect(events.find((e) => e.name === 'INTENT_COMMENT_RESOLVE').payload.id).toBe(c.id);
        expect(events.find((e) => e.name === 'INTENT_COMMENT_REOPEN').payload.id).toBe(c.id);
        expect(events.find((e) => e.name === 'INTENT_COMMENT_DELETE').payload.id).toBe(c.id);
    });

    it('inline edit swaps body for textarea and publishes INTENT_COMMENT_EDIT on save', async () => {
        const { eventBus, service, events } = env;
        const c = await seed(service, { body: 'orig' });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        document.querySelector(`[data-id="${c.id}"] button[data-action="edit"]`).click();
        const ta = document.querySelector(`[data-id="${c.id}"] .csma-comment-edit-input`);
        expect(ta).toBeTruthy();
        expect(ta.value).toBe('orig');
        ta.value = 'edited body';
        // re-query: entering edit mode re-rendered the card
        document.querySelector(`[data-id="${c.id}"] button[data-action="edit-save"]`).click();
        const edit = events.find((e) => e.name === 'INTENT_COMMENT_EDIT');
        expect(edit.payload.body).toBe('edited body');
        expect(edit.payload.id).toBe(c.id);
        // exited edit mode
        expect(document.querySelector('.csma-comment-edit-input')).toBeNull();
    });

    it('reply form publishes INTENT_COMMENT_REPLY with parentId + scope', async () => {
        const { eventBus, service, events } = env;
        const c = await seed(service, { body: 'parent' });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        document.querySelector(`[data-id="${c.id}"] button[data-action="reply"]`).click();
        const ta = document.querySelector(`[data-id="${c.id}"] .csma-comment-reply-input`);
        ta.value = 'a reply';
        // re-query: opening reply re-rendered the card
        document.querySelector(`[data-id="${c.id}"] button[data-action="reply-save"]`).click();
        const rep = events.find((e) => e.name === 'INTENT_COMMENT_REPLY');
        expect(rep.payload.parentId).toBe(c.id);
        expect(rep.payload.body).toBe('a reply');
        expect(rep.payload.scope).toBe(SCOPE);
    });

    it('renders threaded replies nested under their parent', async () => {
        const { eventBus, service } = env;
        const parent = await seed(service, { body: 'P' });
        service.reply(parent.id, 'child-1', { scope: SCOPE });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        const card = document.querySelector(`[data-id="${parent.id}"]`);
        const replies = card.querySelectorAll('.csma-comment-replies .csma-comment--reply');
        expect(replies.length).toBe(1);
        expect(replies[0].textContent).toContain('child-1');
    });

    it('INTENT_COMMENTS_FOCUS highlights + scrolls the target comment', async () => {
        const { eventBus, service } = env;
        const a = await seed(service, { body: 'A' });
        const b = await seed(service, { body: 'B' });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: b.id, timestamp: Date.now() });
        const focused = document.querySelector('.csma-comment.is-focused');
        expect(focused).toBeTruthy();
        expect(focused.dataset.id).toBe(b.id);
        // A is not focused
        const cardA = document.querySelector(`[data-id="${a.id}"]`);
        expect(cardA.classList.contains('is-focused')).toBe(false);
    });

    it('shows empty state when scope has no comments', () => {
        const { eventBus } = env;
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: 'deck:empty', timestamp: Date.now() });
        expect(document.querySelector('.csma-comments-empty')).toBeTruthy();
    });

    it('destroy unsubscribes — later OPEN does not mount', () => {
        const { eventBus, drawer } = env;
        drawer.destroy();
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        expect(drawer.isOpen()).toBe(false);
        expect(document.querySelector('.csma-comments-drawer')).toBeNull();
    });

    it('gracefully no-ops when dependencies missing', () => {
        const d = createCommentsDrawer({ eventBus: null, service: null, overlayManager: null });
        expect(() => { d.open('x'); d.close(); d.focus('y'); d.destroy(); }).not.toThrow();
        expect(d.isOpen()).toBe(false);
    });

    it('author name falls back to Anonymous when author missing', async () => {
        const { eventBus, service } = env;
        await seed(service, { body: 'no author', author: null });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: SCOPE, timestamp: Date.now() });
        expect(document.querySelector('.csma-comment-author').textContent).toBe('Anonymous');
    });
});

// ── Badge ──────────────────────────────────────────────────────────────

describe('Phase 4.1 — CommentsBadge (wireCommentsBadge)', () => {
    let env;

    beforeEach(async () => {
        env = await setup();
    });

    function button() {
        const btn = document.createElement('button');
        btn.style.position = 'relative';
        btn.textContent = '💬';
        document.body.appendChild(btn);
        return btn;
    }

    it('appends a badge showing the current open count', async () => {
        const { service } = env;
        const btn = button();
        await seed(service, { body: 'x' });
        await seed(service, { body: 'y' });
        const { badge } = wireCommentsBadge(btn, { getScope: () => SCOPE, eventBus: env.eventBus, service });
        expect(badge).toBeTruthy();
        expect(badge.textContent).toBe('2');
        expect(badge.dataset.hasOpen).toBe('true');
    });

    it('shows 0 and hides when no open comments', () => {
        const { service } = env;
        const btn = button();
        const { badge } = wireCommentsBadge(btn, { getScope: () => SCOPE, eventBus: env.eventBus, service });
        expect(badge.textContent).toBe('0');
        expect(badge.dataset.hasOpen).toBe('false');
    });

    it('updates on COMMENT_COUNT_CHANGED for matching scope', async () => {
        const { service, eventBus } = env;
        const btn = button();
        const { badge } = wireCommentsBadge(btn, { getScope: () => SCOPE, eventBus, service });
        expect(badge.textContent).toBe('0');
        await seed(service, { body: 'new' }); // service emits COMMENT_COUNT_CHANGED
        expect(badge.textContent).toBe('1');
        expect(badge.dataset.hasOpen).toBe('true');
    });

    it('ignores COMMENT_COUNT_CHANGED for a different scope', async () => {
        const { service, eventBus } = env;
        const btn = button();
        const { badge } = wireCommentsBadge(btn, { getScope: () => SCOPE, eventBus, service });
        // emit a count change scoped to a different scope
        publishSync(eventBus, 'COMMENT_COUNT_CHANGED', { scope: 'deck:other', openCount: 9, totalCount: 9, timestamp: Date.now() });
        expect(badge.textContent).toBe('0');
    });

    it('refresh() re-reads current scope count', async () => {
        const { service } = env;
        const btn = button();
        const { refresh, badge } = wireCommentsBadge(btn, { getScope: () => SCOPE, eventBus: env.eventBus, service });
        await seed(service, { body: 'a' });
        refresh();
        expect(badge.textContent).toBe('1');
    });

    it('destroy stops badge updates', async () => {
        const { service, eventBus } = env;
        const btn = button();
        const wired = wireCommentsBadge(btn, { getScope: () => SCOPE, eventBus, service });
        wired.destroy();
        await seed(service, { body: 'after destroy' });
        expect(wired.badge.textContent).toBe('0');
    });
});
