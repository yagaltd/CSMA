/**
 * AnnotationHighlights tests — direct CSS class / border injection approach.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initAnnotationHighlights } from '../src/modules/visual-editor/rendering/AnnotationHighlights.js';

function makeMockEventBus() {
    const listeners = {};
    return {
        subscribe: vi.fn((event, fn) => {
            listeners[event] = fn;
            return () => { delete listeners[event]; };
        }),
        publish: vi.fn(),
        _listeners: listeners
    };
}

function makeMockSession(nodes) {
    return {
        doc: { document_id: 'page_1', nodes: nodes || {} },
        schema: {},
        get: () => null,
        inspect: () => null
    };
}

function makeCommentNode(id, status, body, anchorType) {
    return {
        id, type: 'annotation_comment',
        anchor_type: anchorType || 'text',
        payload: { status: status || 'open', body: body || 'Test', author: { name: 'A' }, created_at: 1, edited_at: null, resolved_at: null, resolved_by: null, assigned_to: null, thread_reply_to: null }
    };
}

describe('initAnnotationHighlights', () => {
    let eventBus, sessionService, container;

    beforeEach(() => {
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.style.position = 'relative';
        document.body.appendChild(container);
        eventBus = makeMockEventBus();
        sessionService = makeMockSession();
    });

    it('mount creates badge element', () => {
        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);
        expect(container.querySelector('.ve-annotation-document-badge')).toBeTruthy();
        h.destroy();
    });

    it('subscribes to comment events', () => {
        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);
        const calls = eventBus.subscribe.mock.calls.map(c => c[0]);
        expect(calls).toContain('ANNOTATION_COMMENT_ADDED');
        expect(calls).toContain('ANNOTATION_COMMENT_RESOLVED');
        h.destroy();
    });

    it('destroy removes badge', () => {
        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);
        h.destroy();
        expect(container.querySelector('.ve-annotation-document-badge')).toBeNull();
    });

    it('adds left border and dot to annotated element', () => {
        const el = document.createElement('div');
        el.setAttribute('data-property-path', 'p1,content');
        container.appendChild(el);

        const nodes = {
            page_1: { id: 'page_1', type: 'page', body: { nodes: ['p1'], marks: [], annotations: [] } },
            p1: { id: 'p1', type: 'paragraph', content: { content: 'hi', marks: [], annotations: [{ start_offset: 0, end_offset: 2, node_id: 'c1' }] } },
            c1: makeCommentNode('c1', 'open', 'fix')
        };
        sessionService = makeMockSession(nodes);

        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);

        expect(el.style.borderLeft).toBe('3px solid rgb(245, 158, 11)');
        expect(el.querySelector('.ve-annotation-dot')).toBeTruthy();
        h.destroy();
    });

    it('resolved uses green', () => {
        const el = document.createElement('div');
        el.setAttribute('data-property-path', 'p1,content');
        container.appendChild(el);

        const nodes = {
            page_1: { id: 'page_1', type: 'page', body: { nodes: ['p1'], marks: [], annotations: [] } },
            p1: { id: 'p1', type: 'paragraph', content: { content: 'hi', marks: [], annotations: [{ start_offset: 0, end_offset: 2, node_id: 'c1' }] } },
            c1: makeCommentNode('c1', 'resolved', 'done')
        };
        sessionService = makeMockSession(nodes);

        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);

        expect(el.style.borderLeft).toBe('3px solid rgb(34, 197, 94)');
        h.destroy();
    });

    it('destroy clears borders and dots', () => {
        const el = document.createElement('div');
        el.setAttribute('data-property-path', 'p1,content');
        container.appendChild(el);

        const nodes = {
            page_1: { id: 'page_1', type: 'page', body: { nodes: ['p1'], marks: [], annotations: [] } },
            p1: { id: 'p1', type: 'paragraph', content: { content: 'hi', marks: [], annotations: [{ start_offset: 0, end_offset: 2, node_id: 'c1' }] } },
            c1: makeCommentNode('c1', 'open', 'fix')
        };
        sessionService = makeMockSession(nodes);

        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);
        expect(el.style.borderLeft).toBeTruthy();
        h.destroy();
        expect(el.style.borderLeft).toBe('');
        expect(el.querySelector('.ve-annotation-dot')).toBeNull();
    });

    it('shows document badge for document-level comments', () => {
        const nodes = {
            page_1: { id: 'page_1', type: 'page', body: { nodes: [], marks: [], annotations: [] } },
            c1: makeCommentNode('c1', 'open', 'general', 'document')
        };
        sessionService = makeMockSession(nodes);

        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);

        const badge = container.querySelector('.ve-annotation-document-badge');
        expect(badge.style.display).not.toBe('none');
        expect(badge.textContent).toContain('1');
        h.destroy();
    });

    it('hides badge when no doc comments', () => {
        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        h.mount(container);
        const badge = container.querySelector('.ve-annotation-document-badge');
        expect(badge.style.display).toBe('none');
        h.destroy();
    });

    it('no-op when no matching DOM element', () => {
        const nodes = {
            page_1: { id: 'page_1', type: 'page', body: { nodes: ['p1'], marks: [], annotations: [] } },
            p1: { id: 'p1', type: 'paragraph', content: { content: 'hi', marks: [], annotations: [{ start_offset: 0, end_offset: 2, node_id: 'c1' }] } },
            c1: makeCommentNode('c1', 'open', 'fix')
        };
        sessionService = makeMockSession(nodes);

        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        expect(() => h.mount(container)).not.toThrow();
        h.destroy();
    });

    it('refresh safe without container', () => {
        const h = initAnnotationHighlights('e1', sessionService, eventBus);
        expect(() => h.refresh()).not.toThrow();
    });
});
