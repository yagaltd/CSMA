import { object, string, number, array, any, optional, nullable, enums, size } from '../../../runtime/validation/index.js';
import { contract } from '../../../runtime/Contracts.js';

// Rate-limit buckets (reuse the NAV_RATE / SLOW_RATE convention from slides).
// Mutations (add/reply/resolve/reopen/edit/delete) are throttled tighter than
// drawer navigation so a runaway caller cannot flood the store.
const COMMENT_MUTATE_RATE = { requests: 20, windowMs: 1000, scope: 'session' };
const COMMENT_NAV_RATE = { requests: 10, windowMs: 1000, scope: 'session' };

/**
 * Permissive anchor-envelope schema used by intent contracts.
 *
 * The contract validates the envelope shape (anchor_type is one of the three
 * known primitives and an `anchor` payload is present). Strict per-type anchor
 * validation (element: selector XOR id, text: path+start+end, point: x+y) lives
 * in AnchorableCommentsService.validateAnchorShape so it can throw clear errors
 * with the offending field name.
 */
const anchorEnvelope = object({
    anchor_type: enums(['element', 'text', 'point']),
    anchor: any()
});

export const CommentsContracts = {
    INTENT_COMMENTS_LOAD: {
        version: 1, type: 'intent', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent comments load',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_COMMENT_SUBMIT: {
        version: 1, type: 'intent', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent comment submit',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    INTENT_COMMENT_MODERATE: {
        version: 1, type: 'intent', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'intent comment moderate',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    COMMENTS_UPDATED: {
        version: 1, type: 'event', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'comments updated',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    COMMENT_SUBMITTED: {
        version: 1, type: 'event', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'comment submitted',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },
    COMMENTS_ERROR: {
        version: 1, type: 'event', owner: 'comments', lifecycle: 'active', stability: 'stable', compliance: 'public', unsafeInternal: true, security: { rateLimits: { requests: 60, windowMs: 60000, scope: 'session' } }, description: 'comments error',
        schema: object({ requestId: optional(size(string(), 1, 120)), key: optional(size(string(), 1, 160)), id: optional(size(string(), 1, 160)), type: optional(size(string(), 1, 80)), items: optional(array(any())), item: optional(any()), data: optional(any()), error: optional(size(string(), 1, 500)), timestamp: number() })
    },

    // ───────────────────────────────────────────────────────────────────
    // Phase 4 — anchorable comment intents (user/agent → service)
    // ───────────────────────────────────────────────────────────────────
    INTENT_COMMENT_ADD: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_MUTATE_RATE },
        description: 'intent add an anchored comment to the current scope'
    }, object({
        scope: optional(size(string(), 1, 200)),
        anchor: anchorEnvelope,
        body: size(string(), 1, 20000),
        author: optional(object()),
        timestamp: number()
    })),
    INTENT_COMMENT_REPLY: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_MUTATE_RATE },
        description: 'intent append a flat reply to a comment thread'
    }, object({
        parentId: string(),
        body: size(string(), 1, 20000),
        author: optional(object()),
        scope: optional(size(string(), 1, 200)),
        timestamp: number()
    })),
    INTENT_COMMENT_RESOLVE: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_MUTATE_RATE },
        description: 'intent resolve a comment'
    }, object({
        id: string(), resolvedBy: optional(object()), timestamp: number() })),
    INTENT_COMMENT_REOPEN: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_MUTATE_RATE },
        description: 'intent reopen a resolved comment'
    }, object({ id: string(), timestamp: number() })),
    INTENT_COMMENT_EDIT: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_MUTATE_RATE },
        description: 'intent edit a comment body'
    }, object({ id: string(), body: size(string(), 1, 20000), timestamp: number() })),
    INTENT_COMMENT_DELETE: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_MUTATE_RATE },
        description: 'intent soft-delete a comment (retained for audit)'
    }, object({ id: string(), timestamp: number() })),
    INTENT_COMMENTS_OPEN_DRAWER: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_NAV_RATE },
        description: 'intent open the comments drawer, optionally scoped'
    }, object({ scope: optional(size(string(), 1, 200)), timestamp: number() })),
    INTENT_COMMENTS_CLOSE_DRAWER: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_NAV_RATE },
        description: 'intent close the comments drawer'
    }, object({ timestamp: number() })),
    INTENT_COMMENTS_FOCUS: contract({
        version: 1, type: 'intent', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: COMMENT_NAV_RATE },
        description: 'intent scroll/highlight a comment in the drawer'
    }, object({ id: string(), timestamp: number() })),

    // ───────────────────────────────────────────────────────────────────
    // Phase 4 — anchorable comment events (service → UI)
    // ───────────────────────────────────────────────────────────────────
    COMMENT_ADDED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'a comment (root or reply) was created'
    }, object({ comment: any(), timestamp: number() })),
    COMMENT_RESOLVED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'a comment was resolved'
    }, object({ id: string(), resolvedBy: optional(any()), resolvedAt: number(), timestamp: number() })),
    COMMENT_REOPENED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'a resolved comment was reopened'
    }, object({ id: string(), timestamp: number() })),
    COMMENT_UPDATED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'a comment was edited (partial changes)'
    }, object({ id: string(), changes: any(), timestamp: number() })),
    COMMENT_REMOVED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'a comment was soft-deleted'
    }, object({ id: string(), timestamp: number() })),
    COMMENTS_DRAWER_OPENED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'the comments drawer opened for a scope'
    }, object({ scope: optional(string()), timestamp: number() })),
    COMMENTS_DRAWER_CLOSED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'the comments drawer closed'
    }, object({ timestamp: number() })),
    COMMENT_COUNT_CHANGED: contract({
        version: 1, type: 'event', owner: 'comments',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'open/total comment count for a scope changed (drives dock badge)'
    }, object({ scope: nullable(string()), openCount: number(), totalCount: number(), timestamp: number() }))
};
