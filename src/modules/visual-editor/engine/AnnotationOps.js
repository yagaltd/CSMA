/**
 * Annotation operations — add and remove annotations on text, node, and document selections.
 *
 * Annotations differ from marks: they may overlap, they are data-only
 * (no visual rendering by the engine), and they never affect mark toggling.
 *
 * Ported from svedit lib/Transaction.svelte.js (addAnnotation, removeAnnotation).
 * Extended with node-level and document-root annotation support.
 */

/**
 * Add an annotation to a text range.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {Array<string|number>} path — path to the text or node_array property
 * @param {number} start_offset
 * @param {number} end_offset
 * @param {string} ann_type
 * @param {object} [payload={}] — optional payload stored on the annotation node
 */
export function addAnnotation(tr, path, start_offset, end_offset, ann_type, payload = {}) {
    if (start_offset >= end_offset) {
        console.warn('[AnnotationOps] addAnnotation called with start_offset >= end_offset, skipping');
        return;
    }

    const ann_id = tr.generateId();

    // Only attach anchor_type and payload when payload carries meaningful data.
    // This preserves backward compatibility with annotation types that don't
    // declare anchor_type/payload in their schema (e.g. plain 'comment').
    const has_payload = payload && Object.keys(payload).length > 0;
    if (has_payload) {
        tr.create({ id: ann_id, type: ann_type, anchor_type: 'text', payload });
    } else {
        tr.create({ id: ann_id, type: ann_type });
    }

    const value = tr.get(path);
    if (!value || !Array.isArray(value.annotations)) {
        console.warn('[AnnotationOps] addAnnotation: path has no annotations array, skipping');
        return;
    }

    const new_annotations = [...value.annotations, {
        start_offset,
        end_offset,
        node_id: ann_id
    }];

    tr.set(path, { ...value, annotations: new_annotations });
}

/**
 * Remove an annotation by its node ID and optional path.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {Array<string|number>|null} path — path to the property containing the annotation, or null for document-level
 * @param {string} ann_node_id — the annotation's node ID
 */
export function removeAnnotation(tr, path, ann_node_id) {
    if (path) {
        const value = tr.get(path);
        if (value && Array.isArray(value.annotations)) {
            const new_annotations = value.annotations.filter(a => a.node_id !== ann_node_id);

            if (new_annotations.length !== value.annotations.length) {
                tr.set(path, { ...value, annotations: new_annotations });
            }
        }
    }

    // Delete the annotation node itself
    try {
        tr.delete(ann_node_id);
    } catch {
        // Already deleted — OK
    }
}

/**
 * Add a node-level annotation anchored to a specific block node.
 *
 * Finds the node within its parent's node_array and creates an annotation
 * with anchor_type:'node' that spans that single node's position.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {Array<string|number>} node_path — e.g. ['page', 'body', 'slide-2']
 *   where the last element is the node ID and preceding elements form the
 *   parent path to the containing node_array
 * @param {string} ann_type
 * @param {object} [payload={}]
 */
export function addNodeAnnotation(tr, node_path, ann_type, payload = {}) {
    if (!node_path || node_path.length < 2) return;

    const node_id = node_path[node_path.length - 1];
    const parent_path = node_path.slice(0, -1);

    // Get the parent node_array value
    const parent_value = tr.get(parent_path);
    if (!parent_value || !Array.isArray(parent_value.nodes)) return;

    // Find the target node's index within the parent's node list
    const node_index = parent_value.nodes.indexOf(node_id);
    if (node_index === -1) return;

    // Create the annotation node
    const ann_id = tr.generateId();
    tr.create({
        id: ann_id,
        type: ann_type,
        anchor_type: 'node',
        anchor_path: node_path,
        payload
    });

    // Add annotation reference to the parent's annotations array
    const new_annotations = [...(parent_value.annotations || []), {
        start_offset: node_index,
        end_offset: node_index + 1,
        node_id: ann_id
    }];

    tr.set(parent_path, { ...parent_value, annotations: new_annotations });
}

/**
 * Add a document-level annotation (no text or node anchor).
 *
 * Creates an annotation node with anchor_type:'document'. No property
 * reference is needed — the annotation exists at the document root.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {string} ann_type
 * @param {object} [payload={}]
 */
export function addDocumentAnnotation(tr, ann_type, payload = {}) {
    const ann_id = tr.generateId();
    tr.create({
        id: ann_id,
        type: ann_type,
        anchor_type: 'document',
        payload
    });
}
