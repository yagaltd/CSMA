/**
 * @vitest-environment jsdom
 *
 * annotator.js — per-slide stroke rendering.
 *
 * Regression: strokes drawn on slide A used to stay visible after navigating
 * to slide B because the annotator never subscribed to SLIDE_CHANGED. These
 * tests pin the fix: the overlay re-renders the current slide's strokes on
 * navigation and clears when the target slide has none.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { initAnnotator } from '../../src/modules/slides/engine/annotator.js';

function makeService(annotationsBySlide = {}) {
    return {
        index: 0,
        getAnnotations(slide) {
            return annotationsBySlide[slide] || [];
        }
    };
}

function setup(annotationsBySlide = {}) {
    document.body.innerHTML = '';
    const container = document.createElement('div');
    document.body.appendChild(container);
    const eventBus = new EventBus();
    const service = makeService(annotationsBySlide);
    const cleanup = initAnnotator(container, eventBus, service);
    const svg = container.querySelector('svg.slide-annotator');
    return { container, eventBus, service, cleanup, svg };
}

describe('annotator — per-slide rendering', () => {
    it('mounts an SVG overlay and renders the current slide strokes on init', () => {
        const { svg } = setup({
            0: [{ points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], color: 'currentColor', width: 3 }]
        });
        expect(svg).toBeTruthy();
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(1);
    });

    it('re-renders the new slide strokes on SLIDE_CHANGED', () => {
        const { eventBus, svg } = setup({
            0: [{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: 'currentColor', width: 3 }],
            1: [
                { points: [{ x: 5, y: 5 }, { x: 6, y: 6 }], color: 'currentColor', width: 3 },
                { points: [{ x: 7, y: 7 }, { x: 8, y: 8 }], color: 'currentColor', width: 3 }
            ]
        });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(1);
        // navigate to slide 1
        eventBus.publish('SLIDE_CHANGED', { slide: 1, total: 2, clicks: 0 });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(2);
    });

    it('clears the overlay when navigating to a slide with no strokes', () => {
        const { eventBus, svg } = setup({
            0: [{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: 'currentColor', width: 3 }]
        });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(1);
        eventBus.publish('SLIDE_CHANGED', { slide: 2, total: 3, clicks: 0 });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(0);
    });

    it('keeps slide A strokes when you go A -> B -> A', () => {
        const { eventBus, svg } = setup({
            0: [{ points: [{ x: 1, y: 1 }, { x: 9, y: 9 }], color: 'currentColor', width: 3 }],
            1: [{ points: [{ x: 50, y: 50 }, { x: 60, y: 60 }], color: 'currentColor', width: 3 }]
        });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(1);
        eventBus.publish('SLIDE_CHANGED', { slide: 1, total: 2, clicks: 0 });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(1);
        eventBus.publish('SLIDE_CHANGED', { slide: 0, total: 2, clicks: 0 });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(1);
    });

    it('does NOT re-render on ANNOTATION_UPDATED for a different slide', () => {
        const { eventBus, svg, service } = setup({
            0: [{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: 'currentColor', width: 3 }]
        });
        service.index = 0;
        // an update for slide 5 should be ignored (slide !== current)
        eventBus.publish('ANNOTATION_UPDATED', {
            slide: 5,
            strokes: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: 'currentColor', width: 3 }]
        });
        expect(svg.querySelectorAll('path.slide-annotation').length).toBe(1);
    });

    it('cleanup removes the SVG and unsubscribes', () => {
        const { container, cleanup, svg } = setup({
            0: [{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: 'currentColor', width: 3 }]
        });
        cleanup();
        expect(container.querySelector('svg.slide-annotator')).toBeNull();
        expect(svg.parentNode).toBeNull();
    });

    it('gracefully no-ops with missing args', () => {
        expect(() => initAnnotator(null, new EventBus(), makeService())).not.toThrow();
    });
});
