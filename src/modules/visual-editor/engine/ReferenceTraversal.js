/**
 * Reference traversal — utilities for navigating node references in the
 * document graph.
 *
 * Ported from svedit lib/utils.js (traverse, traverse_ids) and
 * lib/doc_utils.js (get_referencing_node_ids, build_reference_counts,
 * visit_node_references).
 */

/**
 * Depth-first traversal from a starting node ID through all referenced nodes.
 * Returns an array of node IDs in DFS order (leaf first, root last).
 * The starting node IS the last element in the returned array.
 *
 * @param {string} node_id — starting node ID
 * @param {Record<string, object>} schema
 * @param {Record<string, object>} nodes — the full nodes map
 * @returns {string[]} array of node IDs in DFS order
 */
export function traverse(node_id, schema, nodes) {
    const result = [];
    const visited = new Set();

    function visit(id) {
        if (visited.has(id)) return;
        visited.add(id);

        const node = nodes[id];
        if (!node) return;

        const node_schema = schema[node.type];
        if (!node_schema) return;

        for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
            const value = node[prop_name];
            if (!value) continue;

            if (prop_def.type === 'node' && typeof value === 'string') {
                visit(value);
            } else if (prop_def.type === 'node_array' && Array.isArray(value.nodes)) {
                for (const ref_id of value.nodes) {
                    visit(ref_id);
                }
            }
        }

        result.push(id);
    }

    visit(node_id);
    return result;
}

/**
 * Like traverse but returns only IDs, no node objects.
 * Identical to traverse — we always return IDs.
 *
 * @param {string} node_id
 * @param {Record<string, object>} schema
 * @param {Record<string, object>} nodes
 * @returns {string[]}
 */
export function traverseIds(node_id, schema, nodes) {
    return traverse(node_id, schema, nodes);
}

/**
 * Find all node IDs that reference any of the given target IDs.
 * Scans every node in the document for references to targets.
 *
 * @param {Record<string, object>} schema
 * @param {object} doc — { document_id, nodes }
 * @param {Set<string>|string[]} target_ids — IDs to find referrers for
 * @returns {string[]} array of node IDs that reference targets
 */
export function getReferencingNodeIds(schema, doc, target_ids) {
    const target_set = target_ids instanceof Set ? target_ids : new Set(target_ids);
    const referrers = [];

    for (const [node_id, node] of Object.entries(doc.nodes)) {
        const node_schema = schema[node.type];
        if (!node_schema) continue;

        for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
            const value = node[prop_name];
            if (!value) continue;

            if (prop_def.type === 'node' && typeof value === 'string') {
                if (target_set.has(value)) {
                    referrers.push(node_id);
                    break; // one match per node is enough
                }
            } else if (prop_def.type === 'node_array' && Array.isArray(value.nodes)) {
                if (value.nodes.some(ref_id => target_set.has(ref_id))) {
                    referrers.push(node_id);
                    break;
                }
            }
        }
    }

    return referrers;
}

/**
 * Build a map of node_id → reference count across the entire document.
 * Only counts references from node/node_array properties.
 *
 * @param {object} doc — { document_id, nodes }
 * @param {Record<string, object>} schema
 * @returns {Map<string, number>}
 */
export function buildReferenceCounts(doc, schema) {
    const counts = new Map();

    for (const node of Object.values(doc.nodes)) {
        const node_schema = schema[node.type];
        if (!node_schema) continue;

        for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
            const value = node[prop_name];
            if (!value) continue;

            if (prop_def.type === 'node' && typeof value === 'string') {
                counts.set(value, (counts.get(value) || 0) + 1);
            } else if (prop_def.type === 'node_array' && Array.isArray(value.nodes)) {
                for (const ref_id of value.nodes) {
                    counts.set(ref_id, (counts.get(ref_id) || 0) + 1);
                }
            }
        }
    }

    return counts;
}

/**
 * Visit every reference property (node and node_array.nodes) in a node,
 * calling the visitor callback for each. The callback receives
 * (property_name, referenced_node_id, index_in_array_or_null).
 *
 * Useful for remapping IDs during build/copy operations.
 *
 * @param {object} node — the node to visit references for
 * @param {Record<string, object>} schema
 * @param {(prop_name: string, ref_id: string, index: number | null) => void} visitor
 */
export function visitNodeReferences(node, schema, visitor) {
    const node_schema = schema[node.type];
    if (!node_schema) return;

    for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
        const value = node[prop_name];
        if (!value) continue;

        if (prop_def.type === 'node' && typeof value === 'string') {
            visitor(prop_name, value, null);
        } else if (prop_def.type === 'node_array' && Array.isArray(value.nodes)) {
            for (let i = 0; i < value.nodes.length; i++) {
                visitor(prop_name, value.nodes[i], i);
            }
        }
    }
}
