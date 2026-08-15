/**
 * Phase 2.2 unit tests — surface embedding in slide layouts.
 *
 * Tests the substrate that lets a slide embed any aiui surface
 * (comments-thread, chart-display) via the
 * `media: { type: 'surface', component, props }` slot.
 *
 * Unit-level only — no full deck mount. Visual verification is manual
 * via demo/slides.html (the "Embed surfaces" demo slide).
 */
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createSplitSlide, renderMedia } from '../../src/modules/slides/layouts/split.js';
import { component } from '../../src/modules/slides/layouts/_shared.js';
import { SlideDeckService } from '../../src/modules/slides/services/SlideDeckService.js';

// ─── renderMedia: surface type ──────────────────────────────────────

describe('split layout — surface embedding (Phase 2.2)', () => {
    it('returns a component() spec node for type:"surface"', () => {
        const out = renderMedia({
            type: 'surface',
            component: 'comments-thread',
            props: { threadId: 'slide-3' }
        });
        expect(out).toEqual(component('comments-thread', { threadId: 'slide-3' }, undefined));
        expect(out.component).toBe('comments-thread');
        expect(out.props).toEqual({ threadId: 'slide-3' });
    });

    it('returns null when component name is missing', () => {
        expect(renderMedia({ type: 'surface' })).toBeNull();
        expect(renderMedia({ type: 'surface', component: 42 })).toBeNull();
        expect(renderMedia({ type: 'surface', component: '' })).toBeNull();
    });

    it('passes props and slot through to the component spec', () => {
        const slot = { default: [{ tag: 'p', text: 'fallback' }] };
        const out = renderMedia({
            type: 'surface',
            component: 'chart-display',
            props: { adapterId: 'chartjs-line', data: { x: 1 } },
            slot
        });
        expect(out.component).toBe('chart-display');
        expect(out.props).toEqual({ adapterId: 'chartjs-line', data: { x: 1 } });
        expect(out.slot).toBe(slot);
    });

    it('defaults props to {} when omitted', () => {
        const out = renderMedia({ type: 'surface', component: 'comments-thread' });
        expect(out.props).toEqual({});
    });

    it('still handles existing media types unchanged (image/panel/chart)', () => {
        const img = renderMedia({ type: 'image', src: 'foo.png' });
        expect(img.tag).toBe('div');
        expect(img.attrs['data-src']).toBe('foo.png');

        const chart = renderMedia({ type: 'chart', chartType: 'line' });
        expect(chart.tag).toBe('div');
        expect(chart.attrs['data-chart-type']).toBe('line');
    });
});

// ─── split slide with embedded surface in spec tree ────────────────

describe('createSplitSlide with surface media', () => {
    it('places a component() node in the media slot of the spec tree', () => {
        const spec = createSplitSlide({
            kicker: 'Q&A',
            title: 'Comments inside a slide',
            body: 'This slide embeds a live comments thread.',
            media: { type: 'surface', component: 'comments-thread', props: { threadId: 'x' } }
        });
        expect(spec.tag).toBe('div');
        expect(spec.attrs['data-layout']).toBe('split');
        // The tree contains a component ref somewhere in the media subtree
        const serialized = JSON.stringify(spec);
        expect(serialized).toContain('"component":"comments-thread"');
        expect(serialized).toContain('"threadId":"x"');
    });

    it('produces the same structure with surface media absent (no regression)', () => {
        const spec = createSplitSlide({
            title: 'No media',
            media: null
        });
        const serialized = JSON.stringify(spec);
        expect(serialized).not.toContain('"component"');
    });
});

// ─── SlideDeckService.toggleComments ────────────────────────────────

describe('SlideDeckService.toggleComments (Phase 2.2 intent handler)', () => {
    function makeService(slides = [{ type: 'split', title: 'a' }]) {
        const events = [];
        const eventBus = {
            _subs: new Map(),
            subscribe(name, fn) {
                if (!this._subs.has(name)) this._subs.set(name, []);
                this._subs.get(name).push(fn);
                return () => this._subs.set(name, (this._subs.get(name) || []).filter(f => f !== fn));
            },
            publish(name, payload) {
                events.push({ name, payload });
                (this._subs.get(name) || []).forEach(fn => fn(payload));
            }
        };
        const svc = new SlideDeckService(eventBus);
        svc.init({ slides });
        return { svc, events, eventBus };
    }

    it('installs a comments-thread surface on the current slide when toggled on', () => {
        const { svc } = makeService();
        const result = svc.toggleComments();
        expect(result).toBe(true);
        expect(svc.slides[0].media).toEqual({
            type: 'surface',
            component: 'comments-thread',
            props: { threadId: 'slide-0-q-and-a' }
        });
    });

    it('uses a provided threadId when given', () => {
        const { svc } = makeService();
        svc.toggleComments('custom-thread');
        expect(svc.slides[0].media.props.threadId).toBe('custom-thread');
    });

    it('toggles off when called twice (idempotent)', () => {
        const { svc } = makeService();
        svc.toggleComments();
        expect(svc.slides[0].media).not.toBeNull();
        svc.toggleComments();
        expect(svc.slides[0].media).toBeNull();
    });

    it('publishes SLIDE_MEDIA_CHANGED on every toggle', () => {
        const { svc, events } = makeService();
        events.length = 0;
        svc.toggleComments();
        const onEvents = events.filter(e => e.name === 'SLIDE_MEDIA_CHANGED');
        expect(onEvents).toHaveLength(1);
        expect(onEvents[0].payload.index).toBe(0);
        expect(onEvents[0].payload.media).not.toBeNull();

        events.length = 0;
        svc.toggleComments();
        const offEvents = events.filter(e => e.name === 'SLIDE_MEDIA_CHANGED');
        expect(offEvents).toHaveLength(1);
        expect(offEvents[0].payload.media).toBeNull();
    });

    it('only affects the current slide (not other slides in the deck)', () => {
        const { svc } = makeService([
            { type: 'split', title: 'a' },
            { type: 'split', title: 'b' },
            { type: 'split', title: 'c' }
        ]);
        svc.go(1);
        svc.toggleComments();
        expect(svc.slides[0].media).toBeUndefined();
        expect(svc.slides[1].media).not.toBeNull();
        expect(svc.slides[2].media).toBeUndefined();
    });

    it('returns false on empty deck (no crash)', () => {
        const { svc } = makeService([]);
        expect(svc.toggleComments()).toBe(false);
    });

    it('respects INTENT_SLIDE_TOGGLE_COMMENTS via the EventBus', () => {
        const { svc, eventBus } = makeService();
        eventBus.publish('INTENT_SLIDE_TOGGLE_COMMENTS', { timestamp: Date.now() });
        expect(svc.slides[0].media).not.toBeNull();
        expect(svc.slides[0].media.component).toBe('comments-thread');
    });

    it('preserves other media types when toggling (non-surface media is replaced, not merged)', () => {
        const { svc } = makeService([{ type: 'split', title: 'a', media: { type: 'image', src: 'x.png' } }]);
        svc.toggleComments();
        // Replaced, not merged — documented behavior.
        expect(svc.slides[0].media.type).toBe('surface');
        expect(svc.slides[0].media.component).toBe('comments-thread');
    });
});

// ─── setSlideMedia (generic Phase 2.2 foundation) ───────────────────

describe('SlideDeckService.setSlideMedia', () => {
    it('sets arbitrary media on a slide by index', () => {
        const events = [];
        const eventBus = {
            _subs: new Map(),
            subscribe() { return () => {}; },
            publish(name, payload) { events.push({ name, payload }); }
        };
        const svc = new SlideDeckService(eventBus);
        svc.init({ slides: [{ type: 'split' }, { type: 'split' }] });

        const ok = svc.setSlideMedia(1, { type: 'surface', component: 'comments-thread', props: { threadId: 'slide-2' } });
        expect(ok).toBe(true);
        expect(svc.slides[1].media.component).toBe('comments-thread');
        expect(events.some(e => e.name === 'SLIDE_MEDIA_CHANGED')).toBe(true);
    });

    it('rejects out-of-range indices', () => {
        const eventBus = { subscribe() { return () => {}; }, publish() {} };
        const svc = new SlideDeckService(eventBus);
        svc.init({ slides: [{ type: 'split' }] });
        expect(svc.setSlideMedia(-1, null)).toBe(false);
        expect(svc.setSlideMedia(99, null)).toBe(false);
    });
});
