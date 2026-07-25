import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { SlideDeckService } from '../../src/modules/slides/services/SlideDeckService.js';
import { SlidesContracts } from '../../src/modules/slides/contracts/slides-contracts.js';

/**
 * SlideDeckService core: init, next/prev core loop, registerMax, go(),
 * UI state mutators, annotations, notes.
 */
function makeService(slides = []) {
    const eventBus = new EventBus();
    eventBus.contracts = SlidesContracts;
    const service = new SlideDeckService(eventBus);
    service.init({ title: 'test', slides });
    return { eventBus, service };
}

describe('SlideDeckService', () => {
    let eventBus;
    let service;

    beforeEach(() => {
        ({ eventBus, service } = makeService([
            { type: 'cover', title: 'A' },
            { type: 'big-number', value: { number: 1 } },
            { type: 'cta', title: 'C' }
        ]));
    });

    describe('init', () => {
        it('publishes DECK_READY with total + config', () => {
            let captured = null;
            eventBus.subscribe('DECK_READY', (p) => { captured = p; });
            const fresh = new SlideDeckService(eventBus);
            fresh.init({ slides: [{ type: 'cover' }, { type: 'cta' }] });
            expect(captured).not.toBeNull();
            expect(captured.total).toBe(2);
            expect(captured.config.slides.length).toBe(2);
        });

        it('warns and no-ops with empty config', () => {
            const fresh = new SlideDeckService(eventBus);
            expect(() => fresh.init({ slides: [] })).not.toThrow();
            expect(fresh.slides.length).toBe(0);
        });
    });

    describe('next() — core click-build loop', () => {
        it('advances slide when no builds registered', () => {
            service.next();
            expect(service.index).toBe(1);
            expect(service.clicks).toBe(0);
        });

        it('reveals build step before advancing slide', () => {
            service.go(1);
            service.registerMax(2, 1); // slide 1 has 2 build steps
            service.go(0);
            service.go(1);
            expect(service.clicks).toBe(2); // landing on slide 1 shows all builds

            service.go(0);
            service.index = 1;
            service.clicks = 0;

            service.next();
            expect(service.clicks).toBe(1);
            service.next();
            expect(service.clicks).toBe(2);
            service.next();
            expect(service.index).toBe(2); // advance to next slide
            expect(service.clicks).toBe(0);
        });

        it('no-ops at end of deck with no builds', () => {
            service.go(2);
            service.next();
            expect(service.index).toBe(2);
        });

        it('publishes SLIDE_CHANGED on slide advance', () => {
            let captured = null;
            eventBus.subscribe('SLIDE_CHANGED', (p) => { captured = p; });
            service.next();
            expect(captured).not.toBeNull();
            expect(captured.slide).toBe(1);
            expect(captured.total).toBe(3);
            expect(captured.clicks).toBe(0);
        });

        it('publishes BUILD_ADVANCED on click reveal', () => {
            let captured = null;
            eventBus.subscribe('BUILD_ADVANCED', (p) => { captured = p; });
            service.registerMax(1, 1);
            service.go(1);
            service.clicks = 0;
            service.next();
            expect(captured).not.toBeNull();
            expect(captured.click).toBe(1);
            expect(captured.maxClicks).toBe(1);
        });
    });

    describe('prev() — reverse loop', () => {
        it('reverses build step before going back a slide', () => {
            service.registerMax(2, 1);
            service.go(1);
            service.clicks = 2;
            service.prev();
            expect(service.clicks).toBe(1);
            expect(service.index).toBe(1);
        });

        it('goes back a slide and shows all builds', () => {
            service.registerMax(2, 1);
            service.go(2);
            service.prev();
            expect(service.index).toBe(1);
            expect(service.clicks).toBe(2);
        });

        it('no-ops at start', () => {
            service.go(0);
            service.prev();
            expect(service.index).toBe(0);
        });
    });

    describe('go(target)', () => {
        it('jumps to the target slide', () => {
            service.go(2);
            expect(service.index).toBe(2);
        });

        it('clamps out-of-range indices', () => {
            service.go(99);
            expect(service.index).toBe(2);
            service.go(-5);
            expect(service.index).toBe(0);
        });

        it('no-ops on invalid target', () => {
            service.go(2);
            service.go(undefined);
            expect(service.index).toBe(2);
        });
    });

    describe('registerMax', () => {
        it('records the max build ceiling per slide', () => {
            service.registerMax(3, 1);
            service.registerMax(5, 1);
            service.registerMax(2, 1);
            expect(service.maxClicks.get(1)).toBe(5);
        });

        it('defaults slideIndex to current', () => {
            service.go(2);
            service.registerMax(4);
            expect(service.maxClicks.get(2)).toBe(4);
        });
    });

    describe('UI state mutators', () => {
        it('toggles rail and publishes UI_STATE_CHANGED', () => {
            let captured = null;
            eventBus.subscribe('UI_STATE_CHANGED', (p) => { captured = p; });
            service.toggleRail();
            expect(service.railOpen).toBe(true);
            expect(captured.railOpen).toBe(true);
        });

        it('toggles grid', () => {
            service.toggleGrid();
            expect(service.gridOpen).toBe(true);
        });

        it('toggles drawing', () => {
            service.toggleDrawing();
            expect(service.drawing).toBe(true);
        });

        it('handleEscape closes in priority order', () => {
            service.toggleGrid();
            service.toggleRail();
            service.toggleDrawing();
            service.handleEscape();
            expect(service.gridOpen).toBe(false);
            expect(service.railOpen).toBe(true); // rail still open
            service.handleEscape();
            expect(service.railOpen).toBe(false);
            service.handleEscape();
            expect(service.drawing).toBe(false);
        });
    });

    describe('annotations', () => {
        it('adds strokes and publishes ANNOTATION_UPDATED', () => {
            let captured = null;
            eventBus.subscribe('ANNOTATION_UPDATED', (p) => { captured = p; });
            service.addStroke({ slide: 0, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: 'currentColor', width: 3 });
            expect(service.getAnnotations(0).length).toBe(1);
            expect(captured.strokes.length).toBe(1);
        });

        it('undoes the last stroke', () => {
            service.addStroke({ slide: 0, points: [{ x: 1, y: 2 }] });
            service.addStroke({ slide: 0, points: [{ x: 3, y: 4 }] });
            service.undoStroke(0);
            expect(service.getAnnotations(0).length).toBe(1);
        });

        it('clears all strokes', () => {
            service.addStroke({ slide: 0, points: [{ x: 1, y: 2 }] });
            service.clearAnnotations(0);
            expect(service.getAnnotations(0).length).toBe(0);
        });
    });

    describe('notes', () => {
        it('updates and reads notes', () => {
            service.updateNote(0, 'first slide notes');
            expect(service.getNote(0)).toBe('first slide notes');
        });

        it('truncates to 5000 chars', () => {
            const long = 'x'.repeat(6000);
            service.updateNote(0, long);
            expect(service.getNote(0).length).toBe(5000);
        });
    });

    describe('destroy', () => {
        it('clears state and publishes DECK_DESTROYED', () => {
            let captured = null;
            eventBus.subscribe('DECK_DESTROYED', (p) => { captured = p; });
            service.addStroke({ slide: 0, points: [{ x: 1, y: 2 }] });
            service.destroy();
            expect(captured).not.toBeNull();
            expect(service.annotations.size).toBe(0);
            expect(service.maxClicks.size).toBe(0);
        });
    });
});
