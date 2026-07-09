/**
 * Editor Surface — top-level Type II component that mounts the visual editor
 * into a container element and manages the editing lifecycle.
 *
 * Subscribes to editor events and coordinates rendering.
 *
 * Part of Phase 2: Rendering Components.
 */

import { NodeRendererRegistry } from './NodeRenderer.js';
import { initTextPropertyEditor } from './TextPropertyEditor.js';

/**
 * Initialize the editor surface on a container element.
 *
 * @param {object} eventBus — CSMA EventBus
 * @param {Element} container — DOM element to mount into
 * @param {object} config
 * @param {import('../services/EditorSessionService.js').EditorSessionService} config.session
 * @param {string} config.editorId
 * @param {object} [config.renderers] — custom node renderer functions
 * @returns {Function} cleanup function
 */
export function initEditorSurface(eventBus, container, config) {
    const { session, editorId } = config;
    const renderers = config.renderers || {};
    const subscriptions = [];

    const registry = new NodeRendererRegistry();

    // Register default renderers for node kinds
    registry.registerDefault('text', (node, el, ctx) => {
        el.setAttribute('data-node-type', node.type);
        el.setAttribute('data-node-id', node.id);
        el.setAttribute('data-node-kind', 'text');

        // Render text property as contenteditable
        const content_prop = node.content;
        if (content_prop) {
            const text_el = initTextPropertyEditor(el, session, [node.id, 'content'], {
                editable: ctx.editable !== false
            });
            ctx._cleanups.push(text_el);
        }

        // Render non-content properties
        renderCustomProperties(node, el, session, ctx);
    });

    registry.registerDefault('block', (node, el, ctx) => {
        el.setAttribute('data-node-type', node.type);
        el.setAttribute('data-node-id', node.id);
        el.setAttribute('data-node-kind', 'block');

        // Render node_array children
        const schema = session.schema[node.type];
        if (schema) {
            for (const [prop_name, prop_def] of Object.entries(schema.properties)) {
                if (prop_def.type === 'node_array') {
                    const container_el = document.createElement('div');
                    container_el.setAttribute('data-array-prop', prop_name);
                    container_el.className = 've-node-array-container';
                    el.appendChild(container_el);

                    renderNodeArray(container_el, session, [node.id, prop_name], registry, ctx);
                } else if (prop_def.type === 'text') {
                    const text_el = initTextPropertyEditor(el, session, [node.id, prop_name], {
                        editable: ctx.editable !== false
                    });
                    ctx._cleanups.push(text_el);
                } else {
                    renderCustomProperty(el, node, prop_name, prop_def, session, ctx);
                }
            }
        }
    });

    registry.registerDefault('document', (node, el, ctx) => {
        el.setAttribute('data-node-type', node.type);
        el.setAttribute('data-node-id', node.id);
        el.setAttribute('data-node-kind', 'document');

        const schema = session.schema[node.type];
        if (schema) {
            for (const [prop_name, prop_def] of Object.entries(schema.properties)) {
                if (prop_def.type === 'node_array') {
                    const container_el = document.createElement('div');
                    container_el.setAttribute('data-array-prop', prop_name);
                    container_el.className = 've-node-array-container';
                    el.appendChild(container_el);
                    renderNodeArray(container_el, session, [node.id, prop_name], registry, ctx);
                } else if (prop_def.type === 'text') {
                    const text_el = initTextPropertyEditor(el, session, [node.id, prop_name], {
                        editable: ctx.editable !== false
                    });
                    ctx._cleanups.push(text_el);
                } else {
                    renderCustomProperty(el, node, prop_name, prop_def, session, ctx);
                }
            }
        }
    });

    // Register custom renderers
    for (const [nodeType, rendererFn] of Object.entries(renderers)) {
        registry.register(nodeType, rendererFn);
    }

    // Set up the container
    container.className = 've-editor-surface';
    container.setAttribute('data-state', 'editing');
    container.setAttribute('data-editor-id', editorId);

    // Initial render
    function renderDocument() {
        // Run previous cleanups first to avoid leaking listeners
        if (container._ve_cleanups) {
            for (const cleanup of container._ve_cleanups) {
                try { cleanup(); } catch { /* ignore */ }
            }
            container._ve_cleanups = [];
        }

        // Clear container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const doc = session.doc;
        const document_id = doc.document_id;
        const doc_node = doc.nodes[document_id];

        if (!doc_node) return;

        const el = document.createElement('div');
        el.className = 've-document-root';

        const ctx = {
            session,
            eventBus,
            editorId,
            editable: true,
            _cleanups: []
        };

        registry.renderNode(el, doc_node, ctx);
        container.appendChild(el);

        // Store cleanups for re-render
        container._ve_cleanups = ctx._cleanups;
    }

    // Subscribe to document changes
    subscriptions.push(
        eventBus.subscribe('EDITOR_DOCUMENT_CHANGED', (payload) => {
            if (payload.editorId === editorId) {
                renderDocument();
            }
        })
    );

    // Initial render
    renderDocument();

    // Cleanup function
    return () => {
        for (const unsub of subscriptions) {
            try { unsub(); } catch { /* ignore */ }
        }
        if (container._ve_cleanups) {
            for (const cleanup of container._ve_cleanups) {
                try { cleanup(); } catch { /* ignore */ }
            }
        }
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        container.className = '';
        container.removeAttribute('data-state');
        container.removeAttribute('data-editor-id');
    };
}

/**
 * Render a node_array property as child node elements.
 * @private
 */
function renderNodeArray(container, session, path, registry, ctx) {
    const value = session.get(path);
    if (!value || !Array.isArray(value.nodes)) return;

    for (const node_id of value.nodes) {
        const node = session.get(node_id);
        if (!node) continue;

        const el = document.createElement('div');
        el.className = 've-node';
        el.setAttribute('data-node-id', node.id);

        // Add node gap before each node
        const gap = document.createElement('div');
        gap.className = 've-node-gap';
        gap.setAttribute('data-state', 'hidden');
        gap.setAttribute('data-gap-index', String(value.nodes.indexOf(node_id)));
        el.appendChild(gap);

        registry.renderNode(el, node, ctx);
        container.appendChild(el);
    }
}

/**
 * Render custom (non-node_array, non-text) properties.
 * @private
 */
function renderCustomProperties(node, el, session, ctx) {
    const schema = session.schema[node.type];
    if (!schema) return;

    for (const [prop_name, prop_def] of Object.entries(schema.properties)) {
        if (prop_def.type === 'text' || prop_def.type === 'node_array') continue;
        if (prop_name === 'content' && schema.kind === 'text') continue;

        renderCustomProperty(el, node, prop_name, prop_def, session, ctx);
    }
}

/**
 * Render a single non-text, non-node_array property.
 * @private
 */
function renderCustomProperty(el, node, prop_name, prop_def, session, ctx) {
    const value = node[prop_name];
    const wrapper = document.createElement('div');
    wrapper.className = 've-custom-property';
    wrapper.setAttribute('data-property', prop_name);
    wrapper.setAttribute('data-property-type', prop_def.type);

    const label = document.createElement('span');
    label.className = 've-property-label';
    label.textContent = prop_name;
    wrapper.appendChild(label);

    const display = document.createElement('span');
    display.className = 've-property-value';
    display.textContent = formatPropertyValue(value, prop_def.type);
    wrapper.appendChild(display);

    el.appendChild(wrapper);
}

/**
 * Format a property value for display.
 * @private
 */
function formatPropertyValue(value, type) {
    if (value === undefined || value === null) return '';
    switch (type) {
        case 'boolean':
            return value ? 'Yes' : 'No';
        case 'string_array':
        case 'number_array':
        case 'boolean_array':
        case 'integer_array':
            return Array.isArray(value) ? value.join(', ') : '';
        default:
            return String(value);
    }
}
