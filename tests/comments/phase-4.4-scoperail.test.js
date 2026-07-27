/**
 * @vitest-environment jsdom
 *
 * Phase 4.4 — CommentsDrawer scopeRail (revised API).
 *
 * Verifies the drawer calls the host's render(railContainer) callback,
 * toggles data-active on scope change, publishes the correct intent on
 * card click, and calls the render cleanup on close/destroy. The test
 * uses FAKE DOM stubs (no slides module import) to keep the drawer
 * generic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts } from '../../src/runtime/Contracts.js';
import { AnchorableCommentsService } from '../../src/modules/comments/services/AnchorableCommentsService.js';
import { CommentsContracts } from '../../src/modules/comments/contracts/comments-contracts.js';
import { createOverlayManager } from '../../src/modules/archetypes/overlay-manager/overlay-manager.js';
import { createCommentsDrawer } from '../../src/modules/comments/ui/CommentsDrawer.js';

// ── helpers (same pattern as phase-4.1) ─────────────────────────────────

function bus() {
    const eventBus = new EventBus();
    eventBus.contracts = Object.assign({}, Contracts, CommentsContracts);
    return eventBus;
}

function recorder(eventBus) {
    const events = [];
    eventBus.subscribe('INTENT_COMMENTS_OPEN_DRAWER', (p) => events.push({ name: 'INTENT_COMMENTS_OPEN_DRAWER', payload: p }));
    return events;
}

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

function publishSync(eventBus, name, payload) {
    if (typeof eventBus.publishSync === 'function') eventBus.publishSync(name, payload);
    else eventBus.publish(name, payload);
}

// ── card builder helper (creates simple stub cards in the rail) ───────

/**
 * Append stub <div data-scope="..." data-active="false"> cards into
 * railContainer. Returns a cleanup spy so tests can assert it was called.
 */
function populateRail(railContainer, scopes, cleanupSpy = null) {
    railContainer.replaceChildren();
    for (const scope of scopes) {
        const card = document.createElement('div');
        card.dataset.scope = scope;
        card.dataset.active = 'false';
        card.textContent = scope;
        railContainer.appendChild(card);
    }
    return cleanupSpy || (() => {});
}

// ── tests ──────────────────────────────────────────────────────────────

describe('Phase 4.4 — scopeRail (revised API)', () => {
    let eventBus, service, overlay, drawer;

    beforeEach(async () => {
        document.body.innerHTML = '';
        eventBus = bus();
        service = await makeService(eventBus);
        overlay = createOverlayManager(document.body);
    });

    function openDrawer(scope = 'deck:slide-1', scopeRailOpt = null) {
        drawer = createCommentsDrawer({
            eventBus, service, overlayManager: overlay,
            scopeRail: scopeRailOpt
        });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope, timestamp: Date.now() });
    }

    it('calls scopeRail.render with the rail container element', () => {
        const renderSpy = vi.fn((container) => { populateRail(container, ['a', 'b']); });
        openDrawer('deck:slide-1', { render: renderSpy });
        expect(renderSpy).toHaveBeenCalledTimes(1);
        const arg = renderSpy.mock.calls[0][0];
        expect(arg).toBeInstanceOf(HTMLElement);
        expect(arg.classList.contains('csma-comments-scoperail')).toBe(true);
    });

    it('populates the rail container with host-provided cards', () => {
        openDrawer('deck:slide-1', {
            render: (c) => { populateRail(c, ['deck:slide-0', 'deck:slide-1', 'deck:slide-2']); }
        });
        const cards = document.querySelectorAll('.csma-comments-scoperail [data-scope]');
        expect(cards.length).toBe(3);
    });

    it('marks the current-scope card as data-active="true"', () => {
        openDrawer('deck:slide-1', {
            render: (c) => { populateRail(c, ['deck:slide-0', 'deck:slide-1', 'deck:slide-2']); }
        });
        const cards = document.querySelectorAll('.csma-comments-scoperail [data-scope]');
        expect(cards[0].dataset.active).toBe('false');
        expect(cards[1].dataset.active).toBe('true');
        expect(cards[2].dataset.active).toBe('false');
    });

    it('publishes INTENT_COMMENTS_OPEN_DRAWER on rail card click', () => {
        const events = recorder(eventBus);
        openDrawer('deck:slide-0', {
            render: (c) => { populateRail(c, ['deck:slide-0', 'deck:slide-1', 'deck:slide-2']); }
        });
        const cards = document.querySelectorAll('.csma-comments-scoperail [data-scope]');
        cards[2].click();
        const intent = events.find((e) => e.name === 'INTENT_COMMENTS_OPEN_DRAWER');
        expect(intent).toBeTruthy();
        expect(intent.payload.scope).toBe('deck:slide-2');
    });

    it('does not render rail container when scopeRail is omitted (backward compat)', () => {
        openDrawer('deck:slide-0', null);
        expect(document.querySelector('.csma-comments-scoperail')).toBeNull();
        // drawer body still renders fine
        expect(document.querySelector('.csma-comments-drawer')).toBeTruthy();
        expect(document.querySelector('.csma-comments-toolbar')).toBeTruthy();
    });

    it('calls render cleanup on drawer close', () => {
        const cleanupSpy = vi.fn();
        openDrawer('deck:slide-0', {
            render: (c) => { populateRail(c, ['a', 'b']); return cleanupSpy; }
        });
        expect(cleanupSpy).not.toHaveBeenCalled();
        publishSync(eventBus, 'COMMENTS_DRAWER_CLOSED', { timestamp: Date.now() });
        expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('calls render cleanup on destroy', () => {
        const cleanupSpy = vi.fn();
        openDrawer('deck:slide-0', {
            render: (c) => { populateRail(c, ['a', 'b']); return cleanupSpy; }
        });
        drawer.destroy();
        expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('updates active card when scope changes via open()', () => {
        openDrawer('deck:slide-0', {
            render: (c) => { populateRail(c, ['deck:slide-0', 'deck:slide-1', 'deck:slide-2']); }
        });
        // Change scope — the drawer re-opens on COMMENTS_DRAWER_OPENED.
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: 'deck:slide-2', timestamp: Date.now() });
        const cards = document.querySelectorAll('.csma-comments-scoperail [data-scope]');
        expect(cards[0].dataset.active).toBe('false');
        expect(cards[1].dataset.active).toBe('false');
        expect(cards[2].dataset.active).toBe('true');
    });

    it('renders empty rail gracefully when render appends nothing', () => {
        openDrawer('deck:slide-0', { render: () => {} });
        const container = document.querySelector('.csma-comments-scoperail');
        expect(container).toBeTruthy();
        expect(container.children.length).toBe(0);
    });

    it('calls render on each open (not just first open)', () => {
        const renderSpy = vi.fn((c) => { populateRail(c, ['deck:slide-0', 'deck:slide-1']); });
        openDrawer('deck:slide-0', { render: renderSpy });
        expect(renderSpy).toHaveBeenCalledTimes(1);

        // Close and re-open: render should be called again.
        publishSync(eventBus, 'COMMENTS_DRAWER_CLOSED', { timestamp: Date.now() });
        publishSync(eventBus, 'COMMENTS_DRAWER_OPENED', { scope: 'deck:slide-1', timestamp: Date.now() });
        expect(renderSpy).toHaveBeenCalledTimes(2);
    });
});
