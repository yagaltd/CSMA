/**
 * Transaction operations — low-level draft mutation primitives.
 *
 * Internal to Transaction. Not part of the public API.
 *
 * Ported from svedit lib/doc_utils.js — createDocumentDraft, applyOpToDraft.
 */

import { buildReferenceCounts } from './ReferenceTraversal.js';

/**
 * Create a shallow-copied draft from a document.
 * The nodes map is shallow-cloned — individual node objects are copied
 * on write by applyOpToDraft, so unchanged nodes keep their identity.
 *
 * @param {object} doc — { document_id, nodes }
 * @returns {object} draft document
 */
export function createDocumentDraft(doc) {
    return {
        ...doc,
        nodes: { ...doc.nodes }
    };
}

/**
 * Apply a single operation to a draft document in place.
 * Uses copy-on-write: before mutating a node, it is shallow-cloned so
 * other references to the original remain stable.
 *
 * Supported ops:
 *   ['set', [node_id, property], value]
 *   ['create', node_object]
 *   ['delete', node_id]
 *
 * @param {object} draft — { document_id, nodes } (mutated in place)
 * @param {Array} op — [op_name, ...args]
 * @throws {Error} on invalid ops
 */
export function applyOpToDraft(draft, op) {
    const [op_name, ...args] = op;

    switch (op_name) {
        case 'set': {
            const [path, value] = args;
            applySetOp(draft, path, value);
            break;
        }
        case 'create': {
            const [node] = args;
            applyCreateOp(draft, node);
            break;
        }
        case 'delete': {
            const [node_id] = args;
            applyDeleteOp(draft, node_id);
            break;
        }
        default:
            throw new Error(`Unknown op "${op_name}"`);
    }
}

/**
 * Apply a 'set' op: set a property on a node.
 * Path format: [node_id, property_name]
 *
 * @param {object} draft
 * @param {Array} path
 * @param {any} value
 */
function applySetOp(draft, path, value) {
    if (!Array.isArray(path) || path.length !== 2) {
        throw new Error(`set path must be [nodeId, propertyName], got ${JSON.stringify(path)}`);
    }

    const [node_id, property] = path;

    if (typeof node_id !== 'string') {
        throw new Error(`set path[0] must be a node ID string, got ${typeof node_id}`);
    }
    if (typeof property !== 'string') {
        throw new Error(`set path[1] must be a property name string, got ${typeof property}`);
    }

    let node = draft.nodes[node_id];
    if (!node) {
        throw new Error(`Cannot set property on non-existent node "${node_id}"`);
    }

    // Copy-on-write: clone the node before mutating
    draft.nodes[node_id] = { ...node, [property]: value };
}

/**
 * Apply a 'create' op: insert a new node into the draft.
 *
 * @param {object} draft
 * @param {object} node — must have id, type
 */
function applyCreateOp(draft, node) {
    if (!node || !node.id) {
        throw new Error('create op requires a node with an id');
    }

    if (draft.nodes[node.id]) {
        throw new Error(`Cannot create node "${node.id}": already exists`);
    }

    draft.nodes[node.id] = { ...node };
}

/**
 * Apply a 'delete' op: remove a node from the draft.
 *
 * @param {object} draft
 * @param {string} node_id
 */
function applyDeleteOp(draft, node_id) {
    if (typeof node_id !== 'string') {
        throw new Error(`delete op requires a string node ID, got ${typeof node_id}`);
    }

    if (!draft.nodes[node_id]) {
        console.warn(`Deletion of node "${node_id}" skipped: does not exist`);
        return;
    }

    delete draft.nodes[node_id];
}

/**
 * Cascade-delete nodes that have zero references after a set or delete operation.
 *
 * Uses reference counting to safely determine which nodes are truly orphaned.
 * A node removed from one array may still be referenced elsewhere, so we only
 * delete when the count drops to zero.
 *
 * This mutates the draft, ops, and inverseOps arrays in place, and updates
 * the tracking arrays.
 *
 * @param {object} draft
 * @param {Record<string, object>} schema
 * @param {string[]} candidate_ids — nodes to check for orphan status
 * @param {Array[]} ops — forward ops (mutated)
 * @param {Array[]} inverse_ops — inverse ops (mutated)
 * @param {string[]} created_node_ids — tracking array (mutated)
 * @param {string[]} modified_node_ids — tracking array (mutated)
 * @param {string[]} deleted_node_ids — tracking array (mutated)
 */
export function cascadeDeleteUnreferencedNodes(
    draft, schema, candidate_ids,
    ops, inverse_ops,
    created_node_ids, modified_node_ids, deleted_node_ids
) {
    // Build reference counts for current draft state
    const doc = { document_id: '', nodes: draft.nodes };
    const ref_counts = buildReferenceCounts(doc, schema);
    const visited = new Set();

    /**
     * Recursively delete orphaned nodes.
     * @param {string} node_id
     */
    function deleteIfOrphaned(node_id) {
        if (visited.has(node_id)) return;
        visited.add(node_id);

        const count = ref_counts.get(node_id) || 0;
        if (count > 0) return; // still referenced

        const node = draft.nodes[node_id];
        if (!node) return; // already deleted

        // Collect nodes that this node references — they may become orphaned too
        const referenced = [];
        const node_schema = schema[node.type];
        if (node_schema) {
            for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
                const value = node[prop_name];
                if (!value) continue;
                if (prop_def.type === 'node' && typeof value === 'string') {
                    referenced.push(value);
                } else if (prop_def.type === 'node_array' && Array.isArray(value.nodes)) {
                    for (const ref_id of value.nodes) {
                        referenced.push(ref_id);
                    }
                }
            }
        }

        // Delete the node
        const op = ['delete', node_id];
        ops.push(op);
        inverse_ops.push(['create', { ...node }]);
        delete draft.nodes[node_id];

        if (!deleted_node_ids.includes(node_id)) {
            deleted_node_ids.push(node_id);
        }

        // Remove from created/modified if it was tracked there
        const created_idx = created_node_ids.indexOf(node_id);
        if (created_idx !== -1) created_node_ids.splice(created_idx, 1);
        const mod_idx = modified_node_ids.indexOf(node_id);
        if (mod_idx !== -1) modified_node_ids.splice(mod_idx, 1);

        // Decrement reference counts for referenced nodes and recurse
        for (const ref_id of referenced) {
            const new_count = (ref_counts.get(ref_id) || 1) - 1;
            ref_counts.set(ref_id, new_count);
            if (new_count <= 0) {
                deleteIfOrphaned(ref_id);
            }
        }
    }

    for (const candidate_id of candidate_ids) {
        deleteIfOrphaned(candidate_id);
    }
}
