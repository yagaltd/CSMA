/**
 * Annotation operations — add and remove annotations on text and node selections.
 *
 * Annotations differ from marks: they may overlap, they are data-only
 * (no visual rendering by the engine), and they never affect mark toggling.
 *
 * Ported from svedit lib/Transaction.svelte.js (addAnnotation, removeAnnotation).
 */

/**
 * Add an annotation to a text or node range.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {Array<string|number>} path — path to the text or node_array property
 * @param {number} start_offset
 * @param {number} end_offset
 * @param {string} ann_type
 */
export function addAnnotation(tr, path, start_offset, end_offset, ann_type) {
    if (start_offset >= end_offset) return;

    const ann_id = tr.generateId();
    tr.create({ id: ann_id, type: ann_type });

    const value = tr.get(path);
    if (!value || !Array.isArray(value.annotations)) return;

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
 * @param {Array<string|number>} path — path to the property containing the annotation
 * @param {string} ann_node_id — the annotation's node ID
 */
export function removeAnnotation(tr, path, ann_node_id) {
    const value = tr.get(path);
    if (!value || !Array.isArray(value.annotations)) return;

    const new_annotations = value.annotations.filter(a => a.node_id !== ann_node_id);

    if (new_annotations.length === value.annotations.length) return; // Not found

    tr.set(path, { ...value, annotations: new_annotations });

    // Delete the annotation node itself
    try {
        tr.delete(ann_node_id);
    } catch {
        // Already deleted — OK
    }
}
