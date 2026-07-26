/**
 * AnchorResolver — turns an anchor payload into a live DOM element (or null).
 *
 * Pure helper: no EventBus, no state mutation beyond its registered-resolver
 * map. Layer 0 of the Phase 4 comments module. The marker / popup / drawer
 * (Phase 4.1 / 4.2) use it to highlight or jump to a commented element.
 *
 * Anchor envelope shape (mirrors AnchorableCommentsService.validateAnchorShape):
 *
 *   { anchor_type: 'element', anchor: { id: 'slide-3-headline' } }
 *   { anchor_type: 'element', anchor: { selector: '[data-comment-id="X"]' } }
 *   { anchor_type: 'text',    anchor: { path: [...], start: 12, end: 27 } }
 *   { anchor_type: 'point',   anchor: { x: 240, y: 180, scope: 'map-abc' } }
 *
 * Resolution rules (4.0):
 *   - element: prefer `id` (getElementById), fall back to `selector`
 *     (querySelector). Returns null if neither resolves.
 *   - text / point: stub — returns null in 4.0. Real resolution arrives when
 *     visual-editor / canvas hosts migrate onto this module (Phase 5+).
 *   - Apps may register a custom resolver per anchor_type via
 *     registerResolver(type, fn); a registered resolver takes precedence.
 */
export class AnchorResolver {
    constructor() {
        this.resolvers = new Map();
    }

    /**
     * Register a custom resolver for an anchor type.
     * @param {string} anchorType - 'element' | 'text' | 'point' (or a host-defined type)
     * @param {(innerAnchor: object, ctx: { documentRef: Document }) => Element|null} fn
     */
    registerResolver(anchorType, fn) {
        if (typeof fn !== 'function') {
            throw new Error(`AnchorResolver.registerResolver: resolver for "${anchorType}" must be a function`);
        }
        this.resolvers.set(anchorType, fn);
        return () => this.resolvers.delete(anchorType);
    }

    /**
     * Resolve an anchor envelope to a live DOM element.
     * @param {{ anchor_type?: string, anchor?: object }|null} anchor
     * @param {{ documentRef?: Document }} [opts]
     * @returns {Element|null}
     */
    resolve(anchor, opts = {}) {
        if (!anchor || typeof anchor !== 'object') return null;
        const doc = opts.documentRef || globalThis.document;
        const anchorType = anchor.anchor_type;
        const inner = anchor.anchor || {};

        if (this.resolvers.has(anchorType)) {
            try {
                return this.resolvers.get(anchorType)(inner, { documentRef: doc }) || null;
            } catch {
                return null;
            }
        }

        if (anchorType === 'element') {
            if (!doc) return null;
            if (typeof inner.id === 'string' && inner.id.length) {
                return doc.getElementById(inner.id) || null;
            }
            if (typeof inner.selector === 'string' && inner.selector.length) {
                return doc.querySelector(inner.selector) || null;
            }
            return null;
        }

        // text / point (and any unknown type without a registered resolver) are
        // intentionally unresolved in Phase 4.0 — stubbed to null.
        return null;
    }
}

/**
 * Validate the shape of an anchor envelope, throwing a clear, field-specific
 * error on violation. Shared by the service (on add) so contract-level envelope
 * validation stays permissive while business-rule validation is precise.
 *
 * @param {{ anchor_type: string, anchor: object }} anchor
 * @returns {{ anchor_type: string, anchor: object }} the validated anchor
 * @throws {Error} with a message naming the offending field/type
 */
export function validateAnchorShape(anchor) {
    if (!anchor || typeof anchor !== 'object') {
        throw new Error('AnchorableCommentsService: anchor must be an object');
    }
    const { anchor_type, anchor: inner } = anchor;
    if (!inner || typeof inner !== 'object') {
        throw new Error(`AnchorableCommentsService: ${anchor_type} anchor requires an "anchor" payload object`);
    }

    if (anchor_type === 'element') {
        const hasId = typeof inner.id === 'string' && inner.id.length > 0;
        const hasSelector = typeof inner.selector === 'string' && inner.selector.length > 0;
        // Exactly one of { id } | { selector } (XOR).
        if (hasId === hasSelector) {
            throw new Error('AnchorableCommentsService: element anchor requires exactly one of { id } or { selector }');
        }
        return anchor;
    }
    if (anchor_type === 'text') {
        if (!Array.isArray(inner.path)) {
            throw new Error('AnchorableCommentsService: text anchor requires { path: [...] }');
        }
        if (typeof inner.start !== 'number' || typeof inner.end !== 'number') {
            throw new Error('AnchorableCommentsService: text anchor requires { start, end }');
        }
        return anchor;
    }
    if (anchor_type === 'point') {
        if (typeof inner.x !== 'number' || typeof inner.y !== 'number') {
            throw new Error('AnchorableCommentsService: point anchor requires { x, y }');
        }
        return anchor;
    }
    throw new Error(`AnchorableCommentsService: unsupported anchor_type "${anchor_type}"`);
}
