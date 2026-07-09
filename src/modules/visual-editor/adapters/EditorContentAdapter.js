/**
 * Editor Content Adapter — bridge between cms-content module's JSON block
 * format and the visual-editor's node graph format.
 *
 * Converts CMS blocks → editor document and back.
 * Lossless round-trip for known block types; unknown types become
 * UnknownNode placeholders.
 */

import { defineDocumentSchema } from '../engine/DocumentSchema.js';
import { fillDocumentDefaults } from '../engine/DocumentDefaults.js';

/**
 * Default editor schema for converting CMS blocks.
 * Can be overridden by providing a custom schema.
 */
const DEFAULT_ADAPTER_SCHEMA = defineDocumentSchema({
    page: {
        kind: 'document',
        properties: {
            body: {
                type: 'node_array',
                node_types: ['paragraph', 'heading', 'image', 'list', 'block'],
                mark_types: [],
                annotation_types: [],
                default_node_type: 'paragraph'
            }
        }
    },
    paragraph: {
        kind: 'text',
        properties: {
            content: {
                type: 'text',
                mark_types: ['strong', 'emphasis', 'link'],
                annotation_types: [],
                allow_newlines: true
            }
        }
    },
    heading: {
        kind: 'text',
        properties: {
            level: { type: 'integer', default: 2 },
            content: {
                type: 'text',
                mark_types: ['strong', 'emphasis'],
                annotation_types: [],
                allow_newlines: false
            }
        }
    },
    image: {
        kind: 'block',
        properties: {
            src: { type: 'string' },
            alt: { type: 'string', default: '' },
            caption: { type: 'string', default: '' }
        }
    },
    list: {
        kind: 'block',
        properties: {
            ordered: { type: 'boolean', default: false },
            list_items: {
                type: 'node_array',
                node_types: ['list_item'],
                default_node_type: 'list_item'
            }
        }
    },
    list_item: {
        kind: 'text',
        properties: {
            content: {
                type: 'text',
                mark_types: ['strong', 'emphasis', 'link'],
                annotation_types: [],
                allow_newlines: true
            }
        }
    },
    block: {
        kind: 'block',
        properties: {
            data: { type: 'string', default: '' }
        }
    },
    strong: { kind: 'mark', properties: {} },
    emphasis: { kind: 'mark', properties: {} },
    link: { kind: 'mark', properties: { href: { type: 'string' } } }
});

export class EditorContentAdapter {
    /**
     * @param {object} eventBus
     * @param {import('../services/EditorSessionService.js').EditorSessionService} session
     */
    constructor(eventBus, session) {
        this.eventBus = eventBus;
        this.session = session;
        this.schema = DEFAULT_ADAPTER_SCHEMA;
    }

    /**
     * Set a custom schema for conversion.
     * @param {Record<string, object>} schema
     */
    setSchema(schema) {
        this.schema = schema;
    }

    /**
     * Convert a CMS blocks array to a visual-editor document.
     *
     * @param {Array<object>} blocks — CMS blocks with { type, data, ... }
     * @param {Record<string, object>} [schema] — optional custom schema
     * @returns {object} { document_id, nodes }
     */
    static blocksToDocument(blocks, schema = DEFAULT_ADAPTER_SCHEMA) {
        const page_id = 'page_1';
        const nodes = {};
        const body_node_ids = [];
        let counter = 1;

        function nextId(prefix) {
            return `${prefix}_${counter++}`;
        }

        // Create the document node
        nodes[page_id] = {
            id: page_id,
            type: 'page',
            body: { nodes: body_node_ids, marks: [], annotations: [] }
        };

        for (const block of blocks) {
            const node = EditorContentAdapter._blockToNode(block, nextId, schema, nodes);
            if (node) {
                nodes[node.id] = node;
                body_node_ids.push(node.id);
            }
        }

        nodes[page_id].body.nodes = body_node_ids;

        return fillDocumentDefaults({ document_id: page_id, nodes }, schema);
    }

    /**
     * Convert a visual-editor document to CMS blocks.
     *
     * @param {object} doc — { document_id, nodes }
     * @param {Record<string, object>} [schema]
     * @returns {Array<object>}
     */
    static documentToBlocks(doc, schema = DEFAULT_ADAPTER_SCHEMA) {
        const blocks = [];
        const doc_node = doc.nodes[doc.document_id];

        if (!doc_node) return blocks;

        // Find the first node_array property
        const doc_schema = schema[doc_node.type];
        if (!doc_schema) return blocks;

        for (const [prop_name, prop_def] of Object.entries(doc_schema.properties)) {
            if (prop_def.type === 'node_array') {
                const value = doc_node[prop_name];
                if (value && Array.isArray(value.nodes)) {
                    for (const node_id of value.nodes) {
                        const node = doc.nodes[node_id];
                        if (node) {
                            const block = EditorContentAdapter._nodeToBlock(node, doc, schema);
                            if (block) blocks.push(block);
                        }
                    }
                }
                break; // Only convert the first node_array
            }
        }

        return blocks;
    }

    /**
     * Load content from a cms-content compatible source into an editor document.
     *
     * @param {object} content — { id, blocks, ... }
     * @param {Record<string, object>} [schema]
     * @returns {object} document
     */
    loadContent(content, schema) {
        const doc = EditorContentAdapter.blocksToDocument(content.blocks || [], schema || this.schema);
        return doc;
    }

    /**
     * Save editor document to cms-content compatible format.
     *
     * @returns {{ blocks: Array<object> }}
     */
    saveContent() {
        const doc = this.session.doc;
        const blocks = EditorContentAdapter.documentToBlocks(doc, this.schema);
        return { blocks };
    }

    // ===================================================================
    // Private converters
    // ===================================================================

    /**
     * Convert a CMS block to an editor node.
     * @param {object} block
     * @param {Function} nextId
     * @param {Record<string, object>} schema
     * @param {Record<string, object>} nodes — shared nodes map; list items are added here
     * @private
     */
    static _blockToNode(block, nextId, schema, nodes = {}) {
        const type = block.type || 'paragraph';

        switch (type) {
            case 'paragraph':
            case 'text': {
                const id = nextId('paragraph');
                return {
                    id,
                    type: 'paragraph',
                    content: {
                        content: block.content || block.text || '',
                        marks: [],
                        annotations: []
                    }
                };
            }

            case 'heading':
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6': {
                const id = nextId('heading');
                const level_map = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
                return {
                    id,
                    type: 'heading',
                    level: block.level || level_map[block.type] || 2,
                    content: {
                        content: block.content || block.text || '',
                        marks: [],
                        annotations: []
                    }
                };
            }

            case 'image':
            case 'img': {
                const id = nextId('image');
                const src = block.src || block.url || '';
                // Reject dangerous URL schemes at conversion time
                const safe_src = EditorContentAdapter._sanitizeUrl(src);
                return {
                    id,
                    type: 'image',
                    src: safe_src,
                    alt: block.alt || '',
                    caption: block.caption || ''
                };
            }

            case 'list':
            case 'ul':
            case 'ol': {
                const id = nextId('list');
                const item_node_ids = [];
                const items = block.items || block.children || [];

                for (const item of items) {
                    const item_id = nextId('list_item');
                    const item_node = {
                        id: item_id,
                        type: 'list_item',
                        content: {
                            content: typeof item === 'string' ? item : (item.content || item.text || ''),
                            marks: [],
                            annotations: []
                        }
                    };
                    item_node_ids.push(item_id);
                    nodes[item_id] = item_node;
                }

                return {
                    id,
                    type: 'list',
                    ordered: block.ordered || block.type === 'ol' || false,
                    list_items: {
                        nodes: item_node_ids,
                        marks: [],
                        annotations: []
                    }
                };
            }

            default: {
                // Unknown block type — use generic block
                const id = nextId('block');
                return {
                    id,
                    type: 'block',
                    data: JSON.stringify(block)
                };
            }
        }
    }

    /**
     * Convert an editor node to a CMS block.
     * @private
     */
    static _nodeToBlock(node, doc, schema) {
        switch (node.type) {
            case 'paragraph':
                return {
                    type: 'paragraph',
                    content: node.content?.content || '',
                    text: node.content?.content || ''
                };

            case 'heading':
                return {
                    type: `h${node.level || 2}`,
                    level: node.level || 2,
                    content: node.content?.content || '',
                    text: node.content?.content || ''
                };

            case 'image':
                return {
                    type: 'image',
                    src: node.src || '',
                    alt: node.alt || '',
                    caption: node.caption || ''
                };

            case 'list': {
                const items = [];
                if (node.list_items && Array.isArray(node.list_items.nodes)) {
                    for (const item_id of node.list_items.nodes) {
                        const item_node = doc.nodes[item_id];
                        if (item_node) {
                            items.push({
                                type: 'list_item',
                                content: item_node.content?.content || '',
                                text: item_node.content?.content || ''
                            });
                        }
                    }
                }
                return {
                    type: node.ordered ? 'ol' : 'ul',
                    ordered: node.ordered || false,
                    items,
                    children: items
                };
            }

            case 'list_item':
                return {
                    type: 'list_item',
                    content: node.content?.content || '',
                    text: node.content?.content || ''
                };

            case 'block':
                try {
                    return JSON.parse(node.data || '{}');
                } catch {
                    return { type: 'unknown', data: node.data || '' };
                }

            default:
                return {
                    type: node.type,
                    data: JSON.parse(JSON.stringify(node))
                };
        }
    }

    /**
     * Sanitize a URL value: allow only https/http, relative paths/fragments,
     * and data:image/* for images. Fail closed on every other scheme
     * (javascript:, vbscript:, file:, blob: with wrong use, custom, …).
     *
     * Returns the original URL if safe, or empty string otherwise.
     * @param {string} url
     * @returns {string}
     * @private
     */
    static _sanitizeUrl(url) {
        if (!url) return '';
        // Relative URLs and fragments are always safe
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || url.startsWith('#')) {
            return url;
        }
        const colon_idx = url.indexOf(':');
        if (colon_idx === -1) return url; // No scheme — relative, safe

        const lower = url.toLowerCase();
        // Allow https: and http: only for explicit schemes
        if (lower.startsWith('https:') || lower.startsWith('http:')) return url;
        // Allow data:image/* only (explicitly reject other data: MIME)
        if (lower.startsWith('data:image/')) return url;
        // Fail closed: javascript:, vbscript:, file:, data:text/*, blob:, custom…
        return '';
    }

}
