/**
 * Transforms — higher-level document operations that compose Transaction ops.
 *
 * Ported from svedit lib/transforms.svelte.js — setProperties, breakTextNode,
 * joinTextNode, insertDefaultNode.
 */

import { splitText, joinText, getCharLength } from './TextOperations.js';
import { getDefaultNodeType } from './DocumentSchema.js';
import { isSelectionCollapsed, createCursor } from './SelectionModel.js';

/**
 * Set multiple properties on a node via a transaction.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {Array<string|number>} path — path to the node
 * @param {Record<string, any>} properties — key/value pairs to set
 */
export function setProperties(tr, path, properties) {
    for (const [key, value] of Object.entries(properties)) {
        tr.set([...path, key], value);
    }
}

/**
 * Discover the parent node_array that contains a given node.
 * Handles both flat paths (['nodeId', 'content']) and indexed paths
 * (['page', 'body', 0, 'content']).
 *
 * Returns { node_array_path, node_array_prop, node_array_node_path, current_index }
 * or null if the node is not inside any node_array.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {string} node_id
 * @returns {object | null}
 */
function discoverParentNodeArray(tr, node_id) {
    // Scan all nodes for a node_array property that contains node_id
    for (const [candidate_id, candidate_node] of Object.entries(tr.doc.nodes)) {
        const schema = tr.schema[candidate_node.type];
        if (!schema) continue;

        for (const [prop_name, prop_def] of Object.entries(schema.properties)) {
            if (prop_def.type !== 'node_array') continue;
            const value = candidate_node[prop_name];
            if (!value || !Array.isArray(value.nodes)) continue;

            const idx = value.nodes.indexOf(node_id);
            if (idx === -1) continue;

            return {
                node_array_path: [candidate_id, prop_name],
                node_array_prop: prop_name,
                node_array_node_path: [candidate_id],
                node_array_node: candidate_node,
                current_index: idx
            };
        }
    }
    return null;
}

/**
 * Break a text node at the cursor position (Enter key).
 *
 * Handles both path styles:
 *   Indexed: ['page', 'body', 2, 'content']  → path.slice(0,-3) = ['page','body']
 *   Flat:    ['para_1', 'content']            → discovers parent via scan
 *
 * @param {import('./Transaction.js').default} tr
 * @returns {boolean} false if not applicable
 */
export function breakTextNode(tr) {
    const selection = tr.selection;
    if (!selection || selection.type !== 'text') return false;

    // Must be inside a text node
    const node = tr.get(selection.path.slice(0, -1));
    if (!node || tr.kind(node) !== 'text') return false;

    // Discover parent node_array
    let node_array_path, node_array_prop, node_array_node_path, node_array_node, current_index;

    // Try indexed path first: ['page', 'body', 2, 'content']
    if (selection.path.length >= 4) {
        try {
            const check = tr.inspect(selection.path.slice(0, -2));
            if (check?.type === 'node_array') {
                node_array_prop = selection.path[selection.path.length - 3];
                node_array_node_path = selection.path.slice(0, -3);
                node_array_node = tr.get(node_array_node_path);
                node_array_path = [...node_array_node_path, node_array_prop];
            }
        } catch { /* fall through to scan */ }
    }

    // Fall back to scanning for flat paths like ['para_1', 'content']
    if (!node_array_path) {
        const found = discoverParentNodeArray(tr, node.id);
        if (!found) return false;
        node_array_path = found.node_array_path;
        node_array_prop = found.node_array_prop;
        node_array_node_path = found.node_array_node_path;
        node_array_node = found.node_array_node;
        current_index = found.current_index;
    }

    // Delete non-collapsed selection first
    if (!isSelectionCollapsed(selection)) {
        tr.deleteSelection();
    }

    const split_at_position = tr.selection.anchor_offset;
    const content = tr.get(selection.path);

    if (!content || typeof content.content !== 'string') return false;

    const [left_text, right_text] = splitText(content, split_at_position);

    // Set current node's content to left
    tr.set([node.id, 'content'], left_text);

    // Get current index if not already found
    if (current_index === undefined) {
        const node_array_value = tr.get(node_array_path);
        current_index = node_array_value.nodes.indexOf(node.id);
    }
    const insert_position = current_index + 1;

    // Determine target node type
    const node_array_prop_def =
        tr.schema[node_array_node.type]?.properties?.[node_array_prop];
    const target_node_type = node_array_prop_def
        ? getDefaultNodeType(node_array_prop_def)
        : node.type;

    if (!target_node_type) {
        throw new Error(
            `Cannot determine node type for breakTextNode. ` +
            `node_array "${node_array_prop}" has no default_node_type and multiple node_types.`
        );
    }

    // Create new node with right text
    const new_node_id = tr.generateId();
    const new_node = {
        id: new_node_id,
        type: target_node_type,
        content: right_text
    };

    tr.create(new_node);

    // Insert new node after current in array
    const node_array_value = tr.get(node_array_path);
    const new_nodes = [
        ...node_array_value.nodes.slice(0, insert_position),
        new_node_id,
        ...node_array_value.nodes.slice(insert_position)
    ];

    tr.set(node_array_path, {
        ...node_array_value,
        nodes: new_nodes
    });

    // Set cursor to start of new node's content
    tr.setSelection(createCursor([new_node_id, 'content'], 0));

    return true;
}

/**
 * Join this text node with the previous sibling (Backspace at position 0).
 *
 * Handles both path styles.
 *
 * @param {import('./Transaction.js').default} tr
 * @returns {boolean} false if not applicable
 */
export function joinTextNode(tr) {
    const selection = tr.selection;
    if (!selection || selection.type !== 'text') return false;
    if (selection.anchor_offset !== 0) return false;
    if (selection.focus_offset !== 0) return false;

    // Must be inside a text node
    const node = tr.get(selection.path.slice(0, -1));
    if (!node || tr.kind(node) !== 'text') return false;

    // Discover parent node_array
    let node_array_path, node_array_prop, node_array_node_path, current_index;

    if (selection.path.length >= 4) {
        try {
            const check = tr.inspect(selection.path.slice(0, -2));
            if (check?.type === 'node_array') {
                node_array_prop = selection.path[selection.path.length - 3];
                node_array_node_path = selection.path.slice(0, -3);
                node_array_path = [...node_array_node_path, node_array_prop];
            }
        } catch { /* fall through */ }
    }

    if (!node_array_path) {
        const found = discoverParentNodeArray(tr, node.id);
        if (!found) return false;
        node_array_path = found.node_array_path;
        node_array_prop = found.node_array_prop;
        node_array_node_path = found.node_array_node_path;
        current_index = found.current_index;
    }

    if (current_index === undefined) {
        const node_array_value = tr.get(node_array_path);
        current_index = node_array_value.nodes.indexOf(node.id);
    }

    if (current_index <= 0) return false;

    const node_array_value = tr.get(node_array_path);
    const prev_node_id = node_array_value.nodes[current_index - 1];

    // Only join with text nodes
    const prev_node = tr.get(prev_node_id);
    if (!prev_node || tr.kind(prev_node) !== 'text') return false;

    // Must both have content
    const current_content = tr.get([node.id, 'content']);
    const prev_content = tr.get([prev_node_id, 'content']);

    if (!current_content || !prev_content) return false;

    // Join content: append current to previous
    const joined = joinText(prev_content, current_content);
    tr.set([prev_node_id, 'content'], joined);

    // Remove current node from array
    const new_nodes = [
        ...node_array_value.nodes.slice(0, current_index),
        ...node_array_value.nodes.slice(current_index + 1)
    ];

    tr.set(node_array_path, {
        ...node_array_value,
        nodes: new_nodes
    });

    // Delete the now-removed node
    tr.delete(node.id);

    // Set cursor to the join point
    const join_offset = getCharLength(prev_content);
    tr.setSelection(createCursor([prev_node_id, 'content'], join_offset));

    return true;
}

/**
 * Insert a default node type at the current node selection.
 *
 * @param {import('./Transaction.js').default} tr
 * @returns {boolean} false if not applicable
 */
export function insertDefaultNode(tr) {
    const selection = tr.selection;
    if (!selection) return false;
    if (selection.type !== 'node') return false;

    try {
        const path_info = tr.inspect(selection.path);
        if (path_info?.type !== 'node_array') return false;
    } catch {
        return false;
    }

    const node_array_path = selection.path;
    const node_array_node_path = node_array_path.slice(0, -1);
    const node_array_prop = node_array_path[node_array_path.length - 1];
    const node_array_node = tr.get(node_array_node_path);

    const node_array_prop_def =
        tr.schema[node_array_node.type]?.properties?.[node_array_prop];
    const target_node_type = node_array_prop_def
        ? getDefaultNodeType(node_array_prop_def)
        : null;

    if (!target_node_type) return false;

    const pos = selection.anchor_offset;
    const new_node_id = tr.generateId();

    if (tr.config.inserter && tr.config.inserter[target_node_type]) {
        tr.config.inserter[target_node_type](tr, new_node_id);
    } else {
        tr.create({ id: new_node_id, type: target_node_type });
    }

    const node_array_value = tr.get(node_array_path);
    const new_nodes = [
        ...node_array_value.nodes.slice(0, pos),
        new_node_id,
        ...node_array_value.nodes.slice(pos)
    ];

    tr.set(node_array_path, { ...node_array_value, nodes: new_nodes });

    tr.setSelection({
        type: 'node',
        path: node_array_path,
        anchor_offset: pos,
        focus_offset: pos + 1
    });

    return true;
}
