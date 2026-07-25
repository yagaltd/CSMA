/**
 * Visual Editor — CommentSidebar Tests
 *
 * Tests the comment sidebar drawer with filters, actions, events,
 * and click-to-scroll for annotation comments.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initCommentSidebar } from '../src/modules/visual-editor/ui/CommentSidebar.js';

// ===========================================================================
// Test helpers
// ===========================================================================

/**
 * Create a mock EventBus that mirrors the real EventBus.subscribe signature:
 * returns an unsubscribe function.
 */
function makeMockEventBus() {
    const listeners = {};
    const published = [];
    const bus = {
        listen: listeners,
        pub: published,
        subscribe(eventName, handler) {
            if (!listeners[eventName]) listeners[eventName] = [];
            listeners[eventName].push(handler);
            return () => {
                const idx = listeners[eventName].indexOf(handler);
                if (idx > -1) listeners[eventName].splice(idx, 1);
            };
        },
        publish(eventName, payload) {
            published.push({ eventName, payload });
            const handlers = listeners[eventName] || [];
            for (const h of handlers) h(payload);
        },
    };
    return bus;
}

/**
 * Create a fully-featured mock AnnotationCommentService.
 */
function makeMockCommentService(overrides = {}) {
    let comments = overrides.comments || [];
    const svc = {
        _comments: comments,
        resolveCalls: [],
        reopenCalls: [],
        getComments(filter = {}) {
            let results = [...svc._comments];
            if (filter.status) {
                results = results.filter(
                    (c) => (c.payload || c).status === filter.status
                );
            }
            if (filter.search) {
                const s = filter.search.toLowerCase();
                results = results.filter((c) => {
                    const body = ((c.payload || c).body || '').toLowerCase();
                    return body.includes(s);
                });
            }
            return results;
        },
        getStats() {
            const all = svc._comments;
            return {
                total: all.length,
                open: all.filter(
                    (c) => (c.payload || c).status === 'open'
                ).length,
                resolved: all.filter(
                    (c) => (c.payload || c).status === 'resolved'
                ).length,
                reopened: all.filter(
                    (c) => (c.payload || c).status === 'reopened'
                ).length,
                assignedToMe: 0,
            };
        },
        resolveComment(id) {
            svc.resolveCalls.push(id);
            const c = svc._comments.find((c) => c.id === id);
            if (c) {
                if (c.payload) c.payload.status = 'resolved';
                else c.status = 'resolved';
            }
        },
        reopenComment(id) {
            svc.reopenCalls.push(id);
            const c = svc._comments.find((c) => c.id === id);
            if (c) {
                if (c.payload) c.payload.status = 'reopened';
                else c.status = 'reopened';
            }
        },
    };
    return svc;
}

function makeComment(overrides = {}) {
    return {
        id: overrides.id || 'c1',
        type: 'annotation_comment',
        anchor_type: overrides.anchor_type || 'text',
        anchor_path: overrides.anchor_path || ['page', 'body', '0', 'content'],
        payload: {
            status: overrides.status || overrides.payload?.status || 'open',
            body: overrides.body ?? overrides.payload?.body ?? 'Test comment body',
            author: overrides.author || overrides.payload?.author || {
                id: 'u1',
                name: 'Alice',
            },
            assigned_to:
                overrides.assigned_to !== undefined
                    ? overrides.assigned_to
                    : overrides.payload?.assigned_to !== undefined
                    ? overrides.payload.assigned_to
                    : null,
            created_at:
                overrides.created_at ?? overrides.payload?.created_at ?? Date.now() - 3600000,
            ...(overrides.payloadExtras || {}),
        },
        ...(overrides.extras || {}),
    };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('initCommentSidebar', () => {
    let bus, commentService, container;

    beforeEach(() => {
        bus = makeMockEventBus();
        commentService = makeMockCommentService({
            comments: [
                makeComment({ id: 'c1', status: 'open', body: 'First comment' }),
                makeComment({ id: 'c2', status: 'resolved', body: 'Second comment' }),
                makeComment({
                    id: 'c3',
                    status: 'open',
                    body: 'Third with anchor',
                    anchor_type: 'node',
                    anchor_path: ['page', 'section'],
                }),
            ],
        });
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    // ------------------------------------------------------------------
    // Mount
    // ------------------------------------------------------------------

    it('mount creates toggle button and sidebar elements', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        const toggle = container.querySelector('.ve-comment-toggle');
        expect(toggle).not.toBeNull();
        expect(toggle.getAttribute('aria-label')).toContain('open comments');

        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl).not.toBeNull();
        expect(sidebarEl.getAttribute('aria-hidden')).toBe('true');
        expect(sidebarEl.getAttribute('role')).toBe('complementary');

        sidebar.destroy();
    });

    it('mount subscribes to ANNOTATION_COMMENT_ADDED and other events', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        expect(bus.listen['ANNOTATION_COMMENT_ADDED']).toBeDefined();
        expect(bus.listen['ANNOTATION_COMMENT_ADDED'].length).toBeGreaterThan(0);
        expect(bus.listen['ANNOTATION_COMMENT_UPDATED']).toBeDefined();
        expect(bus.listen['ANNOTATION_COMMENT_RESOLVED']).toBeDefined();
        expect(bus.listen['ANNOTATION_COMMENT_REOPENED']).toBeDefined();
        expect(bus.listen['SELECT_ANNOTATION']).toBeDefined();

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Toggle / open / close
    // ------------------------------------------------------------------

    it('toggle opens sidebar when closed', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        sidebar.toggle();

        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(true);
        expect(sidebarEl.getAttribute('aria-hidden')).toBe('false');

        const toggle = container.querySelector('.ve-comment-toggle');
        expect(toggle.classList.contains('ve-comment-toggle--active')).toBe(true);

        sidebar.destroy();
    });

    it('toggle closes sidebar when open', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        sidebar.toggle(); // open
        sidebar.toggle(); // close

        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(false);
        expect(sidebarEl.getAttribute('aria-hidden')).toBe('true');

        const toggle = container.querySelector('.ve-comment-toggle');
        expect(toggle.classList.contains('ve-comment-toggle--active')).toBe(false);

        sidebar.destroy();
    });

    it('toggle button click toggles sidebar', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        const toggle = container.querySelector('.ve-comment-toggle');
        toggle.click();

        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(true);

        toggle.click();
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(false);

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Render comment cards
    // ------------------------------------------------------------------

    it('render shows comment cards from getComments', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle(); // open to see list

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBe(3);

        // First card should show author and body
        expect(cards[0].textContent).toContain('Alice');
        expect(cards[0].textContent).toContain('First comment');

        // Resolved card should have resolved class
        const resolvedCard = container.querySelector('.ve-comment-card--resolved');
        expect(resolvedCard).not.toBeNull();
        expect(resolvedCard.textContent).toContain('Second comment');

        sidebar.destroy();
    });

    it('comment card shows assignee when assigned', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({
                    id: 'c1',
                    status: 'open',
                    body: 'Please fix',
                    assigned_to: { id: 'u2', name: 'Bob' },
                }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const card = container.querySelector('.ve-comment-card');
        expect(card.textContent).toContain('Bob');
        expect(card.textContent).toContain('\u2192');

        sidebar.destroy();
    });

    it('comment card shows anchor path location', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({
                    id: 'c1',
                    anchor_type: 'node',
                    anchor_path: ['page', 'section', 'block'],
                    status: 'open',
                    body: 'Fix this block',
                }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const card = container.querySelector('.ve-comment-card');
        const location = card.querySelector('.ve-comment-card__location');
        expect(location).not.toBeNull();
        expect(location.textContent).toContain('page');
        expect(location.textContent).toContain('section');
        expect(location.textContent).toContain('block');

        sidebar.destroy();
    });

    it('document-anchored comments do not show location', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({
                    id: 'c1',
                    anchor_type: 'document',
                    anchor_path: [],
                    status: 'open',
                    body: 'General note',
                }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const card = container.querySelector('.ve-comment-card');
        expect(card.querySelector('.ve-comment-card__location')).toBeNull();

        sidebar.destroy();
    });

    it('comment card shows time using formatTime', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({
                    id: 'c1',
                    created_at: Date.now() - 5 * 60000, // 5 minutes ago
                    status: 'open',
                    body: 'Recent',
                }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const card = container.querySelector('.ve-comment-card');
        const time = card.querySelector('.ve-comment-card__time');
        expect(time).not.toBeNull();
        expect(time.textContent).toBe('5m ago');

        sidebar.destroy();
    });

    it('just now shows for comments less than a minute old', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({
                    id: 'c1',
                    created_at: Date.now() - 30000, // 30 seconds ago
                    status: 'open',
                    body: 'Fresh',
                }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const time = container.querySelector('.ve-comment-card__time');
        expect(time.textContent).toBe('just now');

        sidebar.destroy();
    });

    it('hours ago for comments older than 60 minutes', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({
                    id: 'c1',
                    created_at: Date.now() - 3 * 3600000, // 3 hours ago
                    status: 'open',
                    body: 'Old',
                }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const time = container.querySelector('.ve-comment-card__time');
        expect(time.textContent).toBe('3h ago');

        sidebar.destroy();
    });

    it('days ago for comments older than 24 hours', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({
                    id: 'c1',
                    created_at: Date.now() - 2 * 86400000, // 2 days ago
                    status: 'open',
                    body: 'Ancient',
                }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const time = container.querySelector('.ve-comment-card__time');
        expect(time.textContent).toBe('2d ago');

        sidebar.destroy();
    });

    it('empty string for null timestamp', () => {
        const svc = makeMockCommentService({
            comments: [
                {
                    id: 'c1',
                    type: 'annotation_comment',
                    anchor_type: 'text',
                    anchor_path: ['page', 'body'],
                    payload: {
                        status: 'open',
                        body: 'No time',
                        author: { id: 'u1', name: 'Alice' },
                        assigned_to: null,
                        created_at: null,
                    },
                },
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const time = container.querySelector('.ve-comment-card__time');
        expect(time.textContent).toBe('');

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Empty state
    // ------------------------------------------------------------------

    it('empty state shows "No comments yet"', () => {
        const svc = makeMockCommentService({ comments: [] });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const empty = container.querySelector('.ve-comment-sidebar__empty');
        expect(empty).not.toBeNull();
        expect(empty.textContent).toBe('No comments yet');

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Filter
    // ------------------------------------------------------------------

    it('filter select filters by status', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const select = container.querySelector('.ve-comment-sidebar__filter-select');
        expect(select).not.toBeNull();
        expect(select.value).toBe('all');

        // Switch to "resolved"
        select.value = 'resolved';
        select.dispatchEvent(new Event('change'));

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('Second comment');

        sidebar.destroy();
    });

    it('filter "open" shows only open comments', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const select = container.querySelector('.ve-comment-sidebar__filter-select');
        select.value = 'open';
        select.dispatchEvent(new Event('change'));

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBe(2);
        for (const card of cards) {
            expect(card.classList.contains('ve-comment-card--open')).toBe(true);
        }

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------

    it('search input filters by body text', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const input = container.querySelector('.ve-comment-sidebar__search');
        input.value = 'First';
        input.dispatchEvent(new Event('input'));

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('First comment');

        sidebar.destroy();
    });

    it('search is case-insensitive', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const input = container.querySelector('.ve-comment-sidebar__search');
        input.value = 'first';
        input.dispatchEvent(new Event('input'));

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBe(1);

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Resolve / Reopen actions
    // ------------------------------------------------------------------

    it('resolve button calls commentService.resolveComment', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        // Find the resolve button on an open comment
        const openCard = container.querySelector('div.ve-comment-card');
        const resolveBtn = openCard.querySelector('.ve-comment-card__action--resolve');
        expect(resolveBtn).not.toBeNull();
        expect(resolveBtn.textContent).toBe('Resolve');

        resolveBtn.click();
        expect(commentService.resolveCalls).toContain('c1');

        sidebar.destroy();
    });

    it('reopen button calls commentService.reopenComment', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        // Find the reopen button on the resolved card
        const resolvedCard = container.querySelector('.ve-comment-card--resolved');
        const reopenBtn = resolvedCard.querySelector('.ve-comment-card__action--reopen');
        expect(reopenBtn).not.toBeNull();
        expect(reopenBtn.textContent).toBe('Reopen');

        reopenBtn.click();
        expect(commentService.reopenCalls).toContain('c2');

        sidebar.destroy();
    });

    it('reopened comments get resolve button, not reopen', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({ id: 'c1', status: 'reopened', body: 'Still broken' }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const card = container.querySelector('.ve-comment-card');
        expect(card.querySelector('.ve-comment-card__action--resolve')).not.toBeNull();
        expect(card.querySelector('.ve-comment-card__action--reopen')).toBeNull();

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Toggle badge
    // ------------------------------------------------------------------

    it('badge shows open count from stats', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        const toggle = container.querySelector('.ve-comment-toggle');
        expect(toggle.textContent).toContain('2'); // 2 open comments

        sidebar.destroy();
    });

    it('badge updates after resolve changes count', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        // Resolve one comment
        commentService.resolveComment('c1');

        // Trigger a re-render via event
        bus.publish('ANNOTATION_COMMENT_RESOLVED', { commentId: 'c1' });

        const toggle = container.querySelector('.ve-comment-toggle');
        expect(toggle.textContent).toContain('1'); // now only 1 open

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // SELECT_ANNOTATION event
    // ------------------------------------------------------------------

    it('SELECT_ANNOTATION opens sidebar if closed', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        // Sidebar starts closed
        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(false);

        bus.publish('SELECT_ANNOTATION', { commentId: 'c1' });

        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(true);

        sidebar.destroy();
    });

    it('SELECT_ANNOTATION scrolls to matching card', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle(); // open sidebar

        // Find card for c3 and give it a scrollIntoView mock
        const card = container.querySelector('[data-comment-id="c3"]');
        let scrolled = false;
        const originalScroll = card.scrollIntoView;
        card.scrollIntoView = (opts) => {
            scrolled = true;
            expect(opts.behavior).toBe('smooth');
            expect(opts.block).toBe('center');
        };

        bus.publish('SELECT_ANNOTATION', { commentId: 'c3' });
        expect(scrolled).toBe(true);

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Destroy
    // ------------------------------------------------------------------

    it('destroy removes sidebar and toggle from DOM', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        expect(container.querySelector('.ve-comment-sidebar')).not.toBeNull();
        expect(container.querySelector('.ve-comment-toggle')).not.toBeNull();

        sidebar.destroy();

        expect(container.querySelector('.ve-comment-sidebar')).toBeNull();
        expect(container.querySelector('.ve-comment-toggle')).toBeNull();
    });

    it('destroy unsubscribes from all events', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.destroy();

        // All event lists should be empty
        const eventNames = [
            'ANNOTATION_COMMENT_ADDED',
            'ANNOTATION_COMMENT_UPDATED',
            'ANNOTATION_COMMENT_RESOLVED',
            'ANNOTATION_COMMENT_REOPENED',
            'SELECT_ANNOTATION',
        ];
        for (const name of eventNames) {
            const handlers = bus.listen[name] || [];
            expect(handlers.length).toBe(0);
        }
    });

    it('destroy clears internal references', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.destroy();

        // Second destroy should be a no-op, not throw
        expect(() => sidebar.destroy()).not.toThrow();
    });

    it('destroy is safe to call before mount', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        expect(() => sidebar.destroy()).not.toThrow();
    });

    // ------------------------------------------------------------------
    // Edge cases: missing optional fields
    // ------------------------------------------------------------------

    it('handles comment with no payload gracefully', () => {
        const svc = makeMockCommentService({
            comments: [
                { id: 'c1', type: 'annotation_comment' },
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const card = container.querySelector('.ve-comment-card');
        expect(card).not.toBeNull();
        // Should not throw; author defaults to 'Anonymous'
        expect(card.textContent).toContain('Anonymous');

        sidebar.destroy();
    });

    it('handles author with no name field', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({ id: 'c1', author: { id: 'u1' }, body: 'Test' }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const card = container.querySelector('.ve-comment-card');
        expect(card.textContent).toContain('Anonymous');

        sidebar.destroy();
    });

    it('handles empty body', () => {
        const svc = makeMockCommentService({
            comments: [
                makeComment({ id: 'c1', body: '', status: 'open' }),
            ],
        });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);
        sidebar.toggle();

        const body = container.querySelector('.ve-comment-card__body');
        expect(body.textContent).toBe('');

        sidebar.destroy();
    });

    it('render does not throw when mounted with no comments', () => {
        const svc = makeMockCommentService({ comments: [] });
        const sidebar = initCommentSidebar(bus, svc);
        sidebar.mount(container);

        expect(() => bus.publish('ANNOTATION_COMMENT_ADDED', {})).not.toThrow();

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // search + filter combined
    // ------------------------------------------------------------------

    it('search and filter can be combined', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const select = container.querySelector('.ve-comment-sidebar__filter-select');
        select.value = 'open';
        select.dispatchEvent(new Event('change'));

        const search = container.querySelector('.ve-comment-sidebar__search');
        search.value = 'Third';
        search.dispatchEvent(new Event('input'));

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('Third');

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // data attribute on cards
    // ------------------------------------------------------------------

    it('each card has data-comment-id attribute', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards[0].getAttribute('data-comment-id')).toBe('c1');
        expect(cards[1].getAttribute('data-comment-id')).toBe('c2');
        expect(cards[2].getAttribute('data-comment-id')).toBe('c3');

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Keyboard shortcuts
    // ------------------------------------------------------------------

    it('Escape closes sidebar when open', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(true);

        // Simulate Escape key
        const event = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
        });
        document.dispatchEvent(event);

        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(false);

        sidebar.destroy();
    });

    it('Escape does nothing when sidebar is closed', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        // Sidebar starts closed
        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(false);

        // Escape should not throw
        expect(() => {
            const event = new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
            });
            document.dispatchEvent(event);
        }).not.toThrow();

        sidebar.destroy();
    });

    it('Ctrl+Shift+C opens sidebar and focuses input', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.getAttribute('aria-hidden')).toBe('true');

        const event = new KeyboardEvent('keydown', {
            key: 'C',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(event);

        // Sidebar should be open
        expect(sidebarEl.getAttribute('aria-hidden')).toBe('false');
        expect(sidebarEl.classList.contains('ve-comment-sidebar--open')).toBe(true);

        // Input should be focused
        const input = container.querySelector('.ve-comment-sidebar__add-input');
        expect(input).not.toBeNull();
        expect(document.activeElement).toBe(input);

        sidebar.destroy();
    });

    it('Meta+Shift+C also opens sidebar (Mac support)', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        const sidebarEl = container.querySelector('.ve-comment-sidebar');
        expect(sidebarEl.getAttribute('aria-hidden')).toBe('true');

        const event = new KeyboardEvent('keydown', {
            key: 'C',
            metaKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(event);

        expect(sidebarEl.getAttribute('aria-hidden')).toBe('false');

        sidebar.destroy();
    });

    // ------------------------------------------------------------------
    // Loading state
    // ------------------------------------------------------------------

    it('setLoading(true) shows skeleton placeholders', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        // Should have real cards initially
        let cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBeGreaterThan(0);

        sidebar.setLoading(true);

        const skeletons = container.querySelectorAll('.ve-comment-card--skeleton');
        expect(skeletons.length).toBe(3);

        // No real cards visible
        cards = container.querySelectorAll('.ve-comment-card:not(.ve-comment-card--skeleton)');
        expect(cards.length).toBe(0);

        sidebar.destroy();
    });

    it('setLoading(false) re-renders comments', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        sidebar.setLoading(true);
        let skeletons = container.querySelectorAll('.ve-comment-card--skeleton');
        expect(skeletons.length).toBe(3);

        sidebar.setLoading(false);

        skeletons = container.querySelectorAll('.ve-comment-card--skeleton');
        expect(skeletons.length).toBe(0);

        const cards = container.querySelectorAll('.ve-comment-card');
        expect(cards.length).toBe(3); // our 3 mock comments

        sidebar.destroy();
    });

    it('setLoading is safe before mount', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        expect(() => sidebar.setLoading(true)).not.toThrow();
        expect(() => sidebar.setLoading(false)).not.toThrow();
    });

    // ------------------------------------------------------------------
    // ARIA attributes
    // ------------------------------------------------------------------

    it('comment list has role="list" and aria-live="polite"', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);

        const list = container.querySelector('.ve-comment-sidebar__list');
        expect(list.getAttribute('role')).toBe('list');
        expect(list.getAttribute('aria-live')).toBe('polite');

        sidebar.destroy();
    });

    it('each comment card has role="listitem"', () => {
        const sidebar = initCommentSidebar(bus, commentService);
        sidebar.mount(container);
        sidebar.toggle();

        const cards = container.querySelectorAll('.ve-comment-card');
        for (const card of cards) {
            expect(card.getAttribute('role')).toBe('listitem');
        }

        sidebar.destroy();
    });
});
