/**
 * @vitest-environment jsdom
 *
 * Phase 4.2 — CommentsMarker + CommentsPopup.
 *
 * Verifies the marker renders pins on elements with open comments, stays in
 * sync with mutation events, drives INTENT_COMMENTS_FOCUS on pin click, and
 * the popup opens anchored at the element, lists anchor comments, and routes
 * add/resolve/delete through EventBus intents with the ELEMENT anchor.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts } from '../../src/runtime/Contracts.js';
import { AnchorableCommentsService } from '../../src/modules/comments/services/AnchorableCommentsService.js';
import { AnchorResolver } from '../../src/modules/comments/services/AnchorResolver.js';
import { CommentsContracts } from '../../src/modules/comments/contracts/comments-contracts.js';
import { createOverlayManager } from '../../src/modules/archetypes/overlay-manager/overlay-manager.js';
import { createCommentsMarker } from '../../src/modules/comments/ui/CommentsMarker.js';
import { createCommentsPopup } from '../../src/modules/comments/ui/CommentsPopup.js';

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
function selectorAnchor(sel) { return { anchor_type: 'element', anchor: { selector: sel } }; }
function pointAnchor() { return { anchor_type: 'point', anchor: { x: 10, y: 20 } }; }

/** Minimal fake storage matching the Storage async interface. */
function makeFakeStorage() {
    const db = new Map();
    return {
        async init(schema) { for (const [store] of Object.entries(schema || {})) db.set(store, new Map()); },
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

function publishSync(eventBus, name, payload) {
    if (typeof eventBus.publishSync === 'function') eventBus.publishSync(name, payload);
    else eventBus.publish(name, payload);
}

/** Create a real DOM element with an id so element anchors resolve to it. */
function makeTarget(id, scope = SCOPE) {
    const el = document.createElement('div');
    el.id = id;
    el.dataset.commentsScope = scope;
    el.textContent = 'target-' + id;
    document.body.appendChild(el);
    return el;
}

const SCOPE = 'deck:slide-3';

async function setupMarker() {
    document.body.innerHTML = '';
    const eventBus = bus();
    const service = await makeService(eventBus);
    const resolver = new AnchorResolver();
    const events = recorder(eventBus);
    const marker = createCommentsMarker({ eventBus, service, resolver, container: document.body, scope: SCOPE });
    return { eventBus, service, resolver, marker, events };
}

async function setupPopup() {
    document.body.innerHTML = '';
    const eventBus = bus();
    const service = await makeService(eventBus);
    const resolver = new AnchorResolver();
    const overlay = createOverlayManager(document.body);
    const events = recorder(eventBus);
    const popup = createCommentsPopup({ eventBus, service, overlayManager: overlay, resolver });
    return { eventBus, service, resolver, overlay, popup, events };
}

const pins = () => document.body.querySelectorAll('.csma-comments-marker-pin');

// ── Marker ─────────────────────────────────────────────────────────────

describe('Phase 4.2 — CommentsMarker', () => {
    let env;

    beforeEach(async () => {
        env = await setupMarker();
    });

    it('renders a pin when an open comment element anchor resolves', async () => {
        const { service } = env;
        makeTarget('headline');
        await service.add({ scope: SCOPE, anchor: elementAnchor('headline'), body: 'fix this', timestamp: Date.now() });
        expect(pins().length).toBe(1);
        expect(pins()[0].textContent).toBe('1');
    });

    it('renders no pin when the anchor does not resolve (null element)', async () => {
        const { service } = env;
        await service.add({ scope: SCOPE, anchor: elementAnchor('nonexistent'), body: 'x', timestamp: Date.now() });
        expect(pins().length).toBe(0);
    });

    it('renders no pin for non-element anchors (point resolves to null)', async () => {
        const { service } = env;
        await service.add({ scope: SCOPE, anchor: pointAnchor(), body: 'x', timestamp: Date.now() });
        expect(pins().length).toBe(0);
    });

    it('ignores resolved and deleted comments (only open gets a pin)', async () => {
        const { service } = env;
        makeTarget('h2');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('h2'), body: 'x', timestamp: Date.now() });
        expect(pins().length).toBe(1);
        service.resolve(c.id);
        expect(pins().length).toBe(0);
    });

    it('removes the pin on COMMENT_REMOVED (soft delete)', async () => {
        const { service } = env;
        makeTarget('h3');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('h3'), body: 'x', timestamp: Date.now() });
        expect(pins().length).toBe(1);
        service.delete(c.id);
        expect(pins().length).toBe(0);
    });

    it('aggregates open count per element (two comments → pin shows 2)', async () => {
        const { service } = env;
        makeTarget('shared');
        await service.add({ scope: SCOPE, anchor: elementAnchor('shared'), body: 'one', timestamp: Date.now() });
        await service.add({ scope: SCOPE, anchor: elementAnchor('shared'), body: 'two', timestamp: Date.now() });
        expect(pins().length).toBe(1);
        expect(pins()[0].textContent).toBe('2');
    });

    it('colors a reopened comment pin red (data-status=reopened)', async () => {
        const { service } = env;
        makeTarget('reop');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('reop'), body: 'x', timestamp: Date.now() });
        service.resolve(c.id);
        service.reopen(c.id);
        expect(pins().length).toBe(1);
        expect(pins()[0].dataset.status).toBe('reopened');
    });

    it('clicking a pin publishes INTENT_COMMENTS_FOCUS with a comment id', async () => {
        const { service, events } = env;
        makeTarget('clickable');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('clickable'), body: 'x', timestamp: Date.now() });
        pins()[0].click();
        const focus = events.find((e) => e.name === 'INTENT_COMMENTS_FOCUS');
        expect(focus).toBeTruthy();
        expect(focus.payload.id).toBe(c.id);
    });

    it('refresh() re-adds a pin for a comment added out-of-band', async () => {
        const { service, marker } = env;
        expect(pins().length).toBe(0);
        makeTarget('late');
        await service.add({ scope: SCOPE, anchor: elementAnchor('late'), body: 'x', timestamp: Date.now() });
        // COMMENT_ADDED already drove a refresh, but call refresh() directly too
        marker.refresh();
        expect(pins().length).toBe(1);
    });

    it('destroy removes all pins and unsubscribes', async () => {
        const { service, marker } = env;
        makeTarget('d1');
        makeTarget('d2');
        await service.add({ scope: SCOPE, anchor: elementAnchor('d1'), body: 'x', timestamp: Date.now() });
        await service.add({ scope: SCOPE, anchor: elementAnchor('d2'), body: 'y', timestamp: Date.now() });
        expect(pins().length).toBe(2);
        marker.destroy();
        expect(pins().length).toBe(0);
        // after destroy, a new comment must not add a pin
        await service.add({ scope: SCOPE, anchor: elementAnchor('d1'), body: 'z', timestamp: Date.now() });
        expect(pins().length).toBe(0);
    });

    it('only scopes comments to its own scope (other-scope comments ignored)', async () => {
        const { service } = env;
        makeTarget('scoped');
        await service.add({ scope: 'deck:slide-9', anchor: elementAnchor('scoped'), body: 'other', timestamp: Date.now() });
        expect(pins().length).toBe(0);
    });

    it('gracefully no-ops when dependencies are missing', () => {
        const m = createCommentsMarker({ eventBus: null, service: null, resolver: null, scope: SCOPE });
        expect(() => { m.refresh(); m.destroy(); }).not.toThrow();
    });
});

// ── Popup ──────────────────────────────────────────────────────────────

describe('Phase 4.2 — CommentsPopup', () => {
    let env;

    beforeEach(async () => {
        env = await setupPopup();
    });

    it('opens a popover anchored at the element on INTENT_COMMENTS_FOCUS', async () => {
        const { eventBus, service } = env;
        makeTarget('pop-headline');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('pop-headline'), body: 'visible', timestamp: Date.now() });
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: c.id, timestamp: Date.now() });
        expect(document.querySelector('.csma-overlay-popover')).toBeTruthy();
        expect(document.querySelector('.csma-comments-popup')).toBeTruthy();
        expect(document.querySelector('.csma-comment-body').textContent).toContain('visible');
    });

    it('lists all comments sharing the element anchor', async () => {
        const { eventBus, service } = env;
        makeTarget('multi');
        const a = await service.add({ scope: SCOPE, anchor: elementAnchor('multi'), body: 'first', timestamp: Date.now() });
        await service.add({ scope: SCOPE, anchor: elementAnchor('multi'), body: 'second', timestamp: Date.now() });
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: a.id, timestamp: Date.now() });
        const bodies = [...document.querySelectorAll('.csma-comments-popup .csma-comment-body')].map((e) => e.textContent);
        expect(bodies).toContain('first');
        expect(bodies).toContain('second');
    });

    it('does NOT open when the anchor resolves to null (point/text)', async () => {
        const { eventBus, service } = env;
        const c = await service.add({ scope: SCOPE, anchor: pointAnchor(), body: 'unresolvable', timestamp: Date.now() });
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: c.id, timestamp: Date.now() });
        expect(document.querySelector('.csma-comments-popup')).toBeNull();
    });

    it('add form publishes INTENT_COMMENT_ADD with the ELEMENT anchor', async () => {
        const { eventBus, service, events } = env;
        makeTarget('add-el');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('add-el'), body: 'seed', timestamp: Date.now() });
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: c.id, timestamp: Date.now() });
        const input = document.querySelector('.csma-comments-popup-input');
        input.value = 'new on element';
        document.querySelector('.csma-comments-popup-add-btn').click();
        const add = events.find((e) => e.name === 'INTENT_COMMENT_ADD');
        expect(add).toBeTruthy();
        expect(add.payload.body).toBe('new on element');
        // element anchor, NOT the scope-anchor selector the drawer uses
        expect(add.payload.anchor.anchor_type).toBe('element');
        expect(add.payload.anchor.anchor.id).toBe('add-el');
        expect(add.payload.scope).toBe(SCOPE);
    });

    it('resolve button publishes INTENT_COMMENT_RESOLVE', async () => {
        const { eventBus, service, events } = env;
        makeTarget('res-el');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('res-el'), body: 'x', timestamp: Date.now() });
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: c.id, timestamp: Date.now() });
        document.querySelector('.csma-comments-popup button[data-action="resolve"]').click();
        const res = events.find((e) => e.name === 'INTENT_COMMENT_RESOLVE');
        expect(res).toBeTruthy();
        expect(res.payload.id).toBe(c.id);
    });

    it('delete button publishes INTENT_COMMENT_DELETE', async () => {
        const { eventBus, service, events } = env;
        makeTarget('del-el');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('del-el'), body: 'x', timestamp: Date.now() });
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: c.id, timestamp: Date.now() });
        document.querySelector('.csma-comments-popup button[data-action="delete"]').click();
        const del = events.find((e) => e.name === 'INTENT_COMMENT_DELETE');
        expect(del).toBeTruthy();
        expect(del.payload.id).toBe(c.id);
    });

    it('reopen button appears for a resolved comment and publishes INTENT_COMMENT_REOPEN', async () => {
        const { eventBus, service, events } = env;
        makeTarget('reo-el');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('reo-el'), body: 'x', timestamp: Date.now() });
        service.resolve(c.id);
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: c.id, timestamp: Date.now() });
        const reopenBtn = document.querySelector('.csma-comments-popup button[data-action="reopen"]');
        expect(reopenBtn).toBeTruthy();
        reopenBtn.click();
        const reo = events.find((e) => e.name === 'INTENT_COMMENT_REOPEN');
        expect(reo).toBeTruthy();
        expect(reo.payload.id).toBe(c.id);
    });

    it('destroy unsubscribes — later FOCUS does not open a popover', async () => {
        const { eventBus, service, popup } = env;
        makeTarget('des-el');
        const c = await service.add({ scope: SCOPE, anchor: elementAnchor('des-el'), body: 'x', timestamp: Date.now() });
        popup.destroy();
        publishSync(eventBus, 'INTENT_COMMENTS_FOCUS', { id: c.id, timestamp: Date.now() });
        expect(document.querySelector('.csma-comments-popup')).toBeNull();
    });

    it('gracefully no-ops when dependencies are missing', () => {
        const p = createCommentsPopup({ eventBus: null, service: null, overlayManager: null, resolver: null });
        expect(() => p.destroy()).not.toThrow();
    });
});
