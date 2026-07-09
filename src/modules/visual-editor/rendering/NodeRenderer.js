/**
 * Node Renderer — registry of node type → renderer function mappings.
 *
 * Part of Phase 2: Rendering Components.
 */

export class NodeRendererRegistry {
    constructor() {
        /** @type {Map<string, Function>} */
        this._renderers = new Map();
    }

    /**
     * Register a renderer function for a node type.
     *
     * @param {string} node_type
     * @param {(node: object, el: Element, ctx: object) => void} renderer_fn
     */
    register(node_type, renderer_fn) {
        this._renderers.set(node_type, renderer_fn);
    }

    /**
     * Register a default renderer that is only used if no specific
     * renderer exists for the node type.
     *
     * @param {string} kind — 'text', 'block', 'document', 'mark', 'annotation'
     * @param {(node: object, el: Element, ctx: object) => void} renderer_fn
     */
    registerDefault(kind, renderer_fn) {
        const key = `__default_${kind}__`;
        this._renderers.set(key, renderer_fn);
    }

    /**
     * Render a node into a container element.
     *
     * @param {Element} container
     * @param {object} node
     * @param {object} ctx — { session, eventBus, editorId, editable, _cleanups }
     */
    renderNode(container, node, ctx) {
        // Try specific renderer first
        let renderer = this._renderers.get(node.type);

        // Fall back to kind-based default renderer
        if (!renderer) {
            const kind = ctx.session.schema[node.type]?.kind;
            if (kind) {
                renderer = this._renderers.get(`__default_${kind}__`);
            }
        }

        if (renderer) {
            renderer(node, container, ctx);
        } else {
            // Unknown node type — render placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 've-unknown-node';
            placeholder.setAttribute('data-node-type', node.type);
            placeholder.setAttribute('data-node-id', node.id);
            placeholder.textContent = `[Unknown: ${node.type}]`;
            container.appendChild(placeholder);
        }
    }

    /**
     * Check if a renderer exists for a node type.
     * @param {string} node_type
     * @returns {boolean}
     */
    has(node_type) {
        return this._renderers.has(node_type);
    }

    /**
     * Remove a renderer.
     * @param {string} node_type
     */
    unregister(node_type) {
        this._renderers.delete(node_type);
    }

    /**
     * Clear all renderers.
     */
    destroy() {
        this._renderers.clear();
    }
}
