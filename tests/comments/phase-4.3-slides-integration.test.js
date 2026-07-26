/**
 * @vitest-environment jsdom
 *
 * Phase 4.3 — slides ↔ comments integration.
 *
 * Proves the dock's comments button is repurposed (opt-in) to open the
 * comments drawer with the current slide scope, the dock badge reflects +
 * refreshes the open-comment count, and each rendered slide container carries
 * a data-comments-scope attribute the AnchorResolver can target.
 *
 * The drawer-mode wiring is OPT-IN: it activates only when a commentsService is
 * passed to initDock (via mountDeck opts). Without it, the dock keeps the
 * legacy Phase 2.2 inline-surface toggle (INTENT_SLIDE_TOGGLE_COMMENTS) so
 * existing slides tests + the Phase 2.2 demo stay green.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts } from '../../src/runtime/Contracts.js';
import { SlidesContracts } from '../../src/modules/slides/contracts/slides-contracts.js';
import { CommentsContracts } from '../../src/modules/comments/contracts/comments-contracts.js';
import { SlideDeckService } from '../../src/modules/slides/services/SlideDeckService.js';
import { initDock } from '../../src/modules/slides/chrome/dock.js';
import { mountDeck } from '../../src/modules/slides/engine/deck.js';

// ── helpers ────────────────────────────────────────────────────────────

function bus() {
    const eventBus = new EventBus();
    eventBus.contracts = Object.assign({}, Contracts, SlidesContracts, CommentsContracts);
    return eventBus;
}

function makeSlidesService(eventBus, slides) {
    const svc = new SlideDeckService(eventBus);
    svc.init({
        slides: slides || [
            { type: 'cover', kicker: 'K', title: 'First', subtitle: 'S', foot: 'F' },
            { type: 'cta', title: 'Last', subtitle: 'done' }
        ]
    });
    return svc;
}

/**
 * Minimal comments-service stub exposing the surface the dock badge +
 * drawer wiring consumes (countOpen + getByScope). Real integration uses
 * AnchorableCommentsService; the stub keeps this test focused on the dock
 * wiring without spinning up IDB.
 */
function makeCommentsStub() {
    const counts = new Map();
    return {
        countOpen(scope) { return scope ? (counts.get(scope) || 0) : 0; },
        getByScope() { return []; },
        _setCount(scope, n) { counts.set(scope, n); }
    };
}

// ── dock wiring ────────────────────────────────────────────────────────

describe('Phase 4.3 — dock comments-drawer wiring', () => {
    let eventBus, host, service, comments;

    beforeEach(() => {
        document.body.innerHTML = '';
        eventBus = bus();
        host = document.createElement('div');
        document.body.appendChild(host);
        service = makeSlidesService(eventBus);
        comments = makeCommentsStub();
    });

    it('uses INTENT_COMMENTS_OPEN_DRAWER + current scope when commentsService wired', () => {
        const seen = [];
        eventBus.subscribe('INTENT_COMMENTS_OPEN_DRAWER', (p) => seen.push(p));
        initDock(host, eventBus, service, { commentsService: comments });
        const btn = host.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]');
        expect(btn).toBeTruthy();
        btn.click();
        expect(seen.length).toBe(1);
        expect(seen[0].scope).toBe('deck:slide-0');
    });

    it('keeps legacy INTENT_SLIDE_TOGGLE_COMMENTS when no commentsService (opt-in)', () => {
        initDock(host, eventBus, service);
        expect(host.querySelector('button[data-intent="INTENT_SLIDE_TOGGLE_COMMENTS"]')).toBeTruthy();
        expect(host.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]')).toBeNull();
    });

    it('tracks the current slide index in the open-drawer scope', () => {
        const seen = [];
        eventBus.subscribe('INTENT_COMMENTS_OPEN_DRAWER', (p) => seen.push(p));
        initDock(host, eventBus, service, { commentsService: comments });
        // SlideDeckService advances its index on SLIDE_CHANGED-like intents;
        // mutate index directly to simulate being on slide 1.
        service.index = 1;
        host.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]').click();
        expect(seen[0].scope).toBe('deck:slide-1');
    });

    it('attaches a count badge reflecting service.countOpen(current scope)', () => {
        comments._setCount('deck:slide-0', 3);
        initDock(host, eventBus, service, { commentsService: comments });
        const btn = host.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]');
        const badge = btn.querySelector('.csma-comments-badge');
        expect(badge).toBeTruthy();
        expect(badge.textContent).toBe('3');
        expect(badge.dataset.hasOpen).toBe('true');
    });

    it('badge hides (has-open=false) when the current scope has zero open', () => {
        initDock(host, eventBus, service, { commentsService: comments });
        const badge = host.querySelector('.csma-comments-badge');
        expect(badge.textContent).toBe('0');
        expect(badge.dataset.hasOpen).toBe('false');
    });

    it('badge refreshes to the new scope count on SLIDE_CHANGED', () => {
        comments._setCount('deck:slide-0', 1);
        comments._setCount('deck:slide-1', 5);
        initDock(host, eventBus, service, { commentsService: comments });
        const btn = host.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]');
        expect(btn.querySelector('.csma-comments-badge').textContent).toBe('1');
        // Navigate via the real intent: the service advances its index and emits
        // a contract-valid SLIDE_CHANGED, which the dock subscribes to and uses
        // to refresh the badge for the new scope.
        eventBus.publish('INTENT_SLIDE_NEXT', { timestamp: Date.now() });
        expect(btn.querySelector('.csma-comments-badge').textContent).toBe('5');
    });

    it('badge updates on COMMENT_COUNT_CHANGED for the current scope', () => {
        initDock(host, eventBus, service, { commentsService: comments });
        const btn = host.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]');
        expect(btn.querySelector('.csma-comments-badge').textContent).toBe('0');
        // The service's live count changes; the count-changed event triggers a refresh.
        comments._setCount('deck:slide-0', 2);
        eventBus.publish('COMMENT_COUNT_CHANGED', { scope: 'deck:slide-0', openCount: 2, totalCount: 2, timestamp: Date.now() });
        expect(btn.querySelector('.csma-comments-badge').textContent).toBe('2');
    });

    it('ignores COMMENT_COUNT_CHANGED for a different scope', () => {
        comments._setCount('deck:slide-1', 9);
        initDock(host, eventBus, service, { commentsService: comments });
        eventBus.publish('COMMENT_COUNT_CHANGED', { scope: 'deck:slide-1', openCount: 9, totalCount: 9, timestamp: Date.now() });
        const badge = host.querySelector('.csma-comments-badge');
        // current scope is slide-0 (count 0), the slide-1 event must not move it
        expect(badge.textContent).toBe('0');
    });

    it('cleanup tears down the dock + badge subscription', () => {
        const cleanup = initDock(host, eventBus, service, { commentsService: comments });
        expect(host.querySelector('.noir-dock')).toBeTruthy();
        cleanup();
        expect(host.querySelector('.noir-dock')).toBeNull();
        // After cleanup, a count-changed event must not throw.
        expect(() => eventBus.publish('COMMENT_COUNT_CHANGED', { scope: 'deck:slide-0', openCount: 1, totalCount: 1, timestamp: Date.now() })).not.toThrow();
    });
});

// ── slide container scope attribute ────────────────────────────────────

describe('Phase 4.3 — slide container carries data-comments-scope', () => {
    let eventBus, root, service, cleanup;

    beforeEach(() => {
        document.body.innerHTML = '';
        eventBus = bus();
        service = makeSlidesService(eventBus);
        root = document.createElement('div');
        root.id = 'deck-root';
        document.body.appendChild(root);
        cleanup = () => {};
    });

    afterEach(() => { try { cleanup(); } catch { /* best-effort */ } });

    it('tags the rendered slide with deck:slide-0', () => {
        cleanup = mountDeck(root, service, eventBus, {});
        const slide = root.querySelector('.slide-stage > [data-comments-scope]');
        expect(slide).toBeTruthy();
        expect(slide.dataset.commentsScope).toBe('deck:slide-0');
    });

    it('updates data-comments-scope when navigating to the next slide', async () => {
        cleanup = mountDeck(root, service, eventBus, {});
        eventBus.publish('INTENT_SLIDE_NEXT', { timestamp: Date.now() });
        // The animated swap (animateSlideTransition) defers the DOM swap behind
        // a ~60ms setTimeout; wait for it before asserting.
        await new Promise((r) => setTimeout(r, 130));
        const slide = root.querySelector('.slide-stage > [data-comments-scope]');
        expect(slide.dataset.commentsScope).toBe('deck:slide-1');
    });

    it('passes commentsService through opts to activate drawer mode in the mounted dock', () => {
        const comments = makeCommentsStub();
        cleanup = mountDeck(root, service, eventBus, { commentsService: comments });
        // The dock is appended to document.body (chrome escapes .deck).
        const drawerBtn = document.body.querySelector('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]');
        expect(drawerBtn).toBeTruthy();
        expect(drawerBtn.querySelector('.csma-comments-badge')).toBeTruthy();
    });
});
