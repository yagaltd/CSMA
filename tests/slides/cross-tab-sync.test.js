import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { SlideDeckService } from '../../src/modules/slides/services/SlideDeckService.js';
import { SlidesContracts } from '../../src/modules/slides/contracts/slides-contracts.js';

/**
 * Cross-tab sync — verify the main deck broadcasts state and the presenter
 * tab follows via PRESENTER_SYNC.
 *
 * We mock BroadcastChannel with a simple shared bus so two services in the
 * same process can talk to each other (jsdom doesn't ship a real impl).
 */

class MockBroadcastChannel {
    constructor(name) {
        this.name = name;
        this.listeners = new Set();
        MockBroadcastChannel.BY_NAME.get(name)?.forEach((ch) => ch._peerRemoved);
        if (!MockBroadcastChannel.BY_NAME.has(name)) {
            MockBroadcastChannel.BY_NAME.set(name, new Set());
        }
        MockBroadcastChannel.BY_NAME.get(name).add(this);
    }
    addEventListener(_type, fn) { this.listeners.add(fn); }
    removeEventListener(_type, fn) { this.listeners.delete(fn); }
    postMessage(msg) {
        for (const peer of MockBroadcastChannel.BY_NAME.get(this.name) || []) {
            if (peer === this) continue;
            for (const fn of peer.listeners) {
                // Async tick to mimic real BroadcastChannel dispatch
                setTimeout(() => fn({ data: msg }), 0);
            }
        }
    }
    close() {
        MockBroadcastChannel.BY_NAME.get(this.name)?.delete(this);
    }
}
MockBroadcastChannel.BY_NAME = new Map();

describe('Cross-tab presenter sync', () => {
    let originalBC;
    let originalLocalStore;

    beforeEach(() => {
        originalBC = globalThis.BroadcastChannel;
        globalThis.BroadcastChannel = MockBroadcastChannel;
        MockBroadcastChannel.BY_NAME.clear();
    });

    afterEach(() => {
        globalThis.BroadcastChannel = originalBC;
        vi.restoreAllMocks();
    });

    it('main deck broadcasts state on slide advance; presenter follows', async () => {
        const slides = [{ type: 'cover' }, { type: 'cta' }, { type: 'section', n: 1 }];

        // Main deck
        const mainBus = new EventBus();
        mainBus.contracts = SlidesContracts;
        const main = new SlideDeckService(mainBus);
        main.init({ slides });
        expect(main.isPresenter).toBe(false);

        // Presenter tab — simulate ?presenter=1
        const originalSearch = window.location.search;
        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?presenter=1', href: 'http://localhost/?presenter=1' },
            writable: true,
            configurable: true
        });

        const presenterBus = new EventBus();
        presenterBus.contracts = SlidesContracts;
        const presenter = new SlideDeckService(presenterBus);
        presenter.init({ slides });

        expect(presenter.isPresenter).toBe(true);

        let captured = null;
        presenterBus.subscribe('PRESENTER_SYNC', (p) => { captured = p; });

        // Main advances → presenter should receive sync
        main.next();
        await new Promise((r) => setTimeout(r, 10));

        expect(captured).not.toBeNull();
        expect(presenter.index).toBe(main.index);
        expect(presenter.clicks).toBe(main.clicks);

        // Restore location
        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: originalSearch, href: 'http://localhost/' },
            writable: true,
            configurable: true
        });

        main.destroy();
        presenter.destroy();
    });

    it('presenter does NOT broadcast back to main (one-way)', async () => {
        const slides = [{ type: 'cover' }, { type: 'cta' }];

        const mainBus = new EventBus();
        mainBus.contracts = SlidesContracts;
        const main = new SlideDeckService(mainBus);
        main.init({ slides });

        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?presenter=1', href: 'http://localhost/?presenter=1' },
            writable: true,
            configurable: true
        });
        const presenterBus = new EventBus();
        presenterBus.contracts = SlidesContracts;
        const presenter = new SlideDeckService(presenterBus);
        presenter.init({ slides });

        let mainChanged = false;
        mainBus.subscribe('SLIDE_CHANGED', () => { mainChanged = true; });

        // Presenter advances — main should not move
        const mainIndexBefore = main.index;
        presenter.next();
        await new Promise((r) => setTimeout(r, 10));
        expect(main.index).toBe(mainIndexBefore);
        expect(mainChanged).toBe(false);

        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '', href: 'http://localhost/' },
            writable: true,
            configurable: true
        });
        main.destroy();
        presenter.destroy();
    });

    it('gracefully degrades when BroadcastChannel is unavailable', () => {
        globalThis.BroadcastChannel = undefined;
        const bus = new EventBus();
        bus.contracts = SlidesContracts;
        const svc = new SlideDeckService(bus);
        expect(() => svc.init({ slides: [{ type: 'cover' }] })).not.toThrow();
        // Sync channel never created
        expect(svc.syncChannel).toBeNull();
        // next() still works (just doesn't broadcast)
        svc.next();
        expect(svc.index).toBe(0); // only 1 slide, can't advance
        svc.destroy();
    });
});
