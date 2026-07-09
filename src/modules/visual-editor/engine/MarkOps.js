/**
 * Mark operations — add, remove, and toggle marks on text and node selections.
 *
 * Ported from svedit lib/Transaction.svelte.js (toggleMark logic) and
 * lib/doc_utils.js (canSwitchMarkType).
 */

import { canSwitchMarkType } from './SelectionUtils.js';

/**
 * Toggle a mark type on the current selection through a transaction.
 * Delegates to tr.toggleMark() which handles the full algorithm.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {string} mark_type
 */
export function toggleMark(tr, mark_type) {
    tr.toggleMark(mark_type);
}

/**
 * Add a mark to a text range.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {Array<string|number>} path — path to the text property
 * @param {number} start_offset
 * @param {number} end_offset
 * @param {string} mark_type
 */
export function addMark(tr, path, start_offset, end_offset, mark_type) {
    if (start_offset >= end_offset) return;

    const mark_id = tr.generateId();
    tr.create({ id: mark_id, type: mark_type });

    const value = tr.get(path);
    if (!value || !Array.isArray(value.marks)) return;

    const new_marks = [...value.marks, {
        start_offset,
        end_offset,
        node_id: mark_id
    }];

    tr.set(path, { ...value, marks: new_marks });
}

/**
 * Remove a specific mark instance by its node ID and optional path.
 *
 * @param {import('./Transaction.js').default} tr
 * @param {Array<string|number>} path — path to the text property containing the mark
 * @param {string} mark_node_id — the mark's node ID
 */
export function removeMark(tr, path, mark_node_id) {
    const value = tr.get(path);
    if (!value || !Array.isArray(value.marks)) return;

    const new_marks = value.marks.filter(m => m.node_id !== mark_node_id);

    if (new_marks.length === value.marks.length) return; // Not found

    tr.set(path, { ...value, marks: new_marks });

    // Delete the mark node itself
    try {
        tr.delete(mark_node_id);
    } catch {
        // Already deleted — OK
    }
}
