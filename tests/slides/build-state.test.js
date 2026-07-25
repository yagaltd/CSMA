import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { SlideDeckService } from '../../src/modules/slides/services/SlideDeckService.js';
import { SlidesContracts } from '../../src/modules/slides/contracts/slides-contracts.js';
import { createBuildElement, bindBuildToService, syncBuildVisibility } from '../../src/modules/slides/engine/build.js';

/**
 * Build (click-reveal) state machine — verify the element's data-visible
 * toggles correctly as the service click count advances.
 */

describe('Build (click-reveal) elements', () => {
    let eventBus;
    let service;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = SlidesContracts;
        service = new SlideDeckService(eventBus);
        service.init({ slides: [{ type: 'cover' }, { type: 'cta' }] });
        service.index = 0;
        service.clicks = 0;
    });

    it('createBuildElement stamps step + initial visibility', () => {
        const visible = createBuildElement({ at: 1, currentClicks: 1 });
        expect(visible.dataset.buildStep).toBe('1');
        expect(visible.dataset.visible).toBe('true');

        const hidden = createBuildElement({ at: 2, currentClicks: 0 });
        expect(hidden.dataset.buildStep).toBe('2');
        expect(hidden.dataset.visible).toBe('false');
    });

    it('clamps at to minimum 1', () => {
        const b = createBuildElement({ at: 0 });
        expect(b.dataset.buildStep).toBe('1');
    });

    it('appends children', () => {
        const child = document.createElement('p');
        child.textContent = 'hello';
        const b = createBuildElement({ at: 1, children: [child] });
        expect(b.children.length).toBe(1);
        expect(b.children[0].tagName).toBe('P');
    });

    it('registers max with the service', () => {
        createBuildElement({ at: 3, service, slideIndex: 1 });
        expect(service.maxClicks.get(1)).toBe(3);
    });

    it('bindBuildToService toggles visibility on BUILD_ADVANCED', () => {
        const build = createBuildElement({ at: 2, currentClicks: 0 });
        const unbind = bindBuildToService(build, eventBus, 0);
        expect(build.dataset.visible).toBe('false');

        // First click — not yet visible (step=2, click=1)
        eventBus.publish('BUILD_ADVANCED', { slide: 0, click: 1, maxClicks: 2 });
        expect(build.dataset.visible).toBe('false');

        // Second click — now visible
        eventBus.publish('BUILD_ADVANCED', { slide: 0, click: 2, maxClicks: 2 });
        expect(build.dataset.visible).toBe('true');

        unbind();
        // After unbind, no more updates
        eventBus.publish('BUILD_ADVANCED', { slide: 0, click: 1, maxClicks: 2 });
        expect(build.dataset.visible).toBe('true');
    });

    it('bindBuildToService ignores events for other slides', () => {
        const build = createBuildElement({ at: 1, currentClicks: 0 });
        bindBuildToService(build, eventBus, 5);
        eventBus.publish('BUILD_ADVANCED', { slide: 0, click: 5, maxClicks: 5 });
        expect(build.dataset.visible).toBe('false');
    });

    it('syncBuildVisibility forces a re-render from raw clicks', () => {
        const build = createBuildElement({ at: 3, currentClicks: 0 });
        expect(build.dataset.visible).toBe('false');
        syncBuildVisibility(build, 3);
        expect(build.dataset.visible).toBe('true');
        syncBuildVisibility(build, 2);
        expect(build.dataset.visible).toBe('false');
    });

    it('service.next() walks through build steps then advances slide', () => {
        // slide 0: 2 build steps
        service.registerMax(2, 0);
        // First click: build step 1
        service.next();
        expect(service.clicks).toBe(1);
        expect(service.index).toBe(0);
        // Second click: build step 2
        service.next();
        expect(service.clicks).toBe(2);
        expect(service.index).toBe(0);
        // Third click: advance to slide 1
        service.next();
        expect(service.index).toBe(1);
        expect(service.clicks).toBe(0);
    });
});
