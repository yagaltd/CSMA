/**
 * Document model — core document access and validation.
 *
 * Provides docGet (path-based node/property access), docInspect (path metadata),
 * document creation, and full document validation.
 *
 * Ported from svedit lib/doc_utils.js — get, inspect, property_type, kind,
 * create_document, and validate_document.
 */

import { validateNode, isIdValid } from './NodeValidator.js';
import { fillDocumentDefaults } from './DocumentDefaults.js';

/**
 * Create a new document from a nodes map and document_id.
 * Fills defaults and validates.
 *
 * @param {string} document_id — the entry-point node ID
 * @param {Record<string, object>} nodes — map of id → node
 * @param {Record<string, object>} schema
 * @returns {object} { document_id, nodes }
 * @throws {Error} if document is invalid
 */
export function createDocument(document_id, nodes, schema) {
    if (!document_id || typeof document_id !== 'string') {
        throw new Error('document_id must be a non-empty string');
    }
    if (!nodes || typeof nodes !== 'object') {
        throw new Error('nodes must be a non-null object');
    }

    const doc = fillDocumentDefaults({ document_id, nodes }, schema);
    validateDocument(doc, schema);
    return doc;
}

/**
 * Full document validation.
 * Checks:
 * - document_id references an existing node
 * - All nodes are reachable from document_id
 * - No cyclic references
 * - All nodes validate individually
 *
 * @param {object} doc — { document_id, nodes }
 * @param {Record<string, object>} schema
 * @throws {Error}
 */
export function validateDocument(doc, schema) {
    if (!doc || typeof doc !== 'object') {
        throw new Error('Document must be a non-null object');
    }
    if (!doc.document_id || typeof doc.document_id !== 'string') {
        throw new Error('Document must have a string document_id');
    }
    if (!doc.nodes || typeof doc.nodes !== 'object') {
        throw new Error('Document must have a nodes object');
    }

    const { document_id, nodes } = doc;

    // Document ID must reference an existing node
    if (!nodes[document_id]) {
        throw new Error(`Document node "${document_id}" not found in nodes`);
    }

    // Validate each node individually (without reference checks first)
    for (const [node_id, node] of Object.entries(nodes)) {
        if (node.id !== node_id) {
            throw new Error(
                `Node key "${node_id}" does not match node.id "${node.id}"`
            );
        }
        // Validate basic structure without reference checks
        validateNode(node, schema, nodes, { require_references: false });
    }

    // Check reachability: all nodes must be reachable from document_id
    const reachable = new Set();
    collectReachable(document_id, schema, nodes, reachable, new Set());

    for (const node_id of Object.keys(nodes)) {
        if (!reachable.has(node_id)) {
            throw new Error(`Node "${node_id}" is not reachable from document_id "${document_id}"`);
        }
    }

    // Now validate with full reference checks
    for (const node of Object.values(nodes)) {
        validateNode(node, schema, nodes, { require_references: true });
    }
}

/**
 * Collect all reachable node IDs from a starting node.
 * Detects cycles by tracking the visited path.
 *
 * @param {string} node_id
 * @param {Record<string, object>} schema
 * @param {Record<string, object>} nodes
 * @param {Set<string>} reachable — output set
 * @param {Set<string>} visiting — nodes currently on the path (cycle detection)
 * @throws {Error} on cycle
 */
function collectReachable(node_id, schema, nodes, reachable, visiting) {
    const node = nodes[node_id];
    if (!node) return;

    if (visiting.has(node_id)) {
        throw new Error(`Cyclic reference detected at node "${node_id}"`);
    }

    if (reachable.has(node_id)) return;

    visiting.add(node_id);
    reachable.add(node_id);

    const node_schema = schema[node.type];
    if (!node_schema) return;

    for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
        const value = node[prop_name];
        if (!value) continue;

        if (prop_def.type === 'node' && typeof value === 'string') {
            collectReachable(value, schema, nodes, reachable, visiting);
        } else if (prop_def.type === 'node_array' && Array.isArray(value.nodes)) {
            for (const ref_id of value.nodes) {
                collectReachable(ref_id, schema, nodes, reachable, visiting);
            }
        }
    }

    visiting.delete(node_id);
}

/**
 * Get a node or property value at the specified DocumentPath.
 *
 * @param {Record<string, object>} schema
 * @param {object} doc — { document_id, nodes }
 * @param {Array<string|number>|string} path — DocumentPath or node ID string
 * @returns {any}
 */
export function docGet(schema, doc, path) {
    // Allow string shortcut for direct node ID access
    if (typeof path === 'string') {
        const node = doc.nodes[path];
        if (!node) {
            throw new Error(`Node "${path}" not found`);
        }
        return node;
    }

    if (!Array.isArray(path) || path.length === 0) {
        throw new Error('DocumentPath must be a non-empty array or string node ID');
    }

    // Start at the first segment — must be a node ID
    const root_id = path[0];
    let current = doc.nodes[root_id];

    if (!current) {
        throw new Error(`Node "${root_id}" not found at path start`);
    }

    // Walk remaining segments
    for (let i = 1; i < path.length; i++) {
        const segment = path[i];

        if (typeof segment === 'number') {
            // Numeric index — current must be a node_array property value
            if (!current || typeof current !== 'object') {
                throw new Error(`Cannot index into non-object at path ${JSON.stringify(path.slice(0, i))}`);
            }
            if (!Array.isArray(current.nodes)) {
                throw new Error(`Cannot index into non-node_array at path ${JSON.stringify(path.slice(0, i))}`);
            }
            const ref_id = current.nodes[segment];
            if (ref_id === undefined) {
                throw new Error(`Index ${segment} out of bounds at path ${JSON.stringify(path.slice(0, i + 1))}`);
            }
            current = doc.nodes[ref_id];
            if (!current) {
                throw new Error(`Referenced node "${ref_id}" not found at path ${JSON.stringify(path.slice(0, i + 1))}`);
            }
        } else if (typeof segment === 'string') {
            // String segment — property name on current node
            if (!current || typeof current !== 'object') {
                throw new Error(`Cannot access property "${segment}" on non-object at path ${JSON.stringify(path.slice(0, i))}`);
            }
            if (!(segment in current)) {
                throw new Error(`Property "${segment}" not found at path ${JSON.stringify(path.slice(0, i + 1))}`);
            }
            current = current[segment];
        } else {
            throw new Error(`Invalid path segment type: ${typeof segment}`);
        }
    }

    return current;
}

/**
 * Inspect a DocumentPath — returns metadata about what the path points to.
 *
 * @param {Record<string, object>} schema
 * @param {object} doc
 * @param {Array<string|number>} path
 * @returns {{ kind: 'property'|'node', [key: string]: any }}
 */
export function docInspect(schema, doc, path) {
    if (!Array.isArray(path) || path.length === 0) {
        throw new Error('DocumentPath must be a non-empty array');
    }

    // Find the node that owns this path
    // Walk to the parent of the last segment
    const root_id = path[0];
    let current = doc.nodes[root_id];

    if (!current) {
        throw new Error(`Node "${root_id}" not found`);
    }

    // Walk to the node containing the final property
    for (let i = 1; i < path.length - 1; i++) {
        const segment = path[i];

        if (typeof segment === 'number') {
            if (!current.nodes || !Array.isArray(current.nodes)) {
                throw new Error(`Cannot index at path ${JSON.stringify(path.slice(0, i + 1))}`);
            }
            const ref_id = current.nodes[segment];
            current = doc.nodes[ref_id];
            if (!current) {
                throw new Error(`Node "${ref_id}" not found`);
            }
        } else if (typeof segment === 'string') {
            if (!(segment in current)) {
                throw new Error(`Property "${segment}" not found`);
            }
            current = current[segment];
        }
    }

    const last_segment = path[path.length - 1];

    // If last segment is a number, it points to a node within a node_array
    if (typeof last_segment === 'number') {
        if (!current.nodes || !Array.isArray(current.nodes)) {
            throw new Error(`Cannot index into non-array at ${JSON.stringify(path)}`);
        }
        const ref_id = current.nodes[last_segment];
        const ref_node = doc.nodes[ref_id];
        if (!ref_node) {
            throw new Error(`Node "${ref_id}" not found at index ${last_segment}`);
        }
        return {
            kind: 'node',
            id: ref_node.id,
            type: ref_node.type,
            properties: schema[ref_node.type]?.properties || {}
        };
    }

    // If last segment is a string, it's a property on current
    if (typeof last_segment === 'string') {
        // current might be a node object or a node_array value
        if (current.id !== undefined && current.type !== undefined) {
            // current is a node object — look up its schema
            const node_schema = schema[current.type];
            const prop_def = node_schema?.properties?.[last_segment];

            if (!prop_def) {
                // Path might point to a node_array's marks/annotations/nodes
                if (last_segment === 'nodes' || last_segment === 'marks' || last_segment === 'annotations') {
                    // Determine parent property type
                    // Walk back to find the parent node's schema context
                    return {
                        kind: 'property',
                        name: last_segment,
                        type: last_segment === 'nodes' ? 'node_array_internal' : 'ranges'
                    };
                }
                throw new Error(`Property "${last_segment}" not found in schema for type "${current.type}"`);
            }

            return {
                kind: 'property',
                name: last_segment,
                type: prop_def.type,
                ...prop_def
            };
        }

        // current might be a node_array value { nodes, marks, annotations }
        if (current.nodes !== undefined) {
            if (last_segment === 'nodes' || last_segment === 'marks' || last_segment === 'annotations') {
                return {
                    kind: 'property',
                    name: last_segment,
                    type: last_segment === 'nodes' ? 'node_array' : 'ranges'
                };
            }
        }

        throw new Error(`Cannot resolve property "${last_segment}" at path ${JSON.stringify(path)}`);
    }

    throw new Error(`Invalid path segment: ${JSON.stringify(last_segment)}`);
}

/**
 * Get the property type from the schema for a given node type and property.
 *
 * @param {Record<string, object>} schema
 * @param {string} node_type
 * @param {string} property — property name
 * @returns {string}
 */
export function docPropertyType(schema, node_type, property) {
    const node_schema = schema[node_type];
    if (!node_schema) return null;
    const prop_def = node_schema.properties[property];
    return prop_def ? prop_def.type : null;
}

/**
 * Get the kind of a node from the schema.
 *
 * @param {Record<string, object>} schema
 * @param {{ type: string } | string} node — node object or type string
 * @returns {'document'|'block'|'text'|'mark'|'annotation'}
 */
export function docKind(schema, node) {
    const type = typeof node === 'string' ? node : node.type;
    const node_schema = schema[type];
    if (!node_schema) {
        throw new Error(`Unknown node type "${type}"`);
    }
    return node_schema.kind;
}
