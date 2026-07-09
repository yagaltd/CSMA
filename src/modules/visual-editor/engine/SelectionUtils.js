/**
 * Selection utilities — functions for querying marks, annotations, and
 * range types that touch the current selection.
 *
 * Ported from svedit lib/doc_utils.js — getSelectedMarks,
 * getSelectedAnnotations, getSelectedRangeTypes.
 */

import { getSelectionRange, isSelectionCollapsed } from './SelectionModel.js';
import { docGet } from './DocumentModel.js';

/**
 * Get marks touched by the current selection.
 * Returns marks augmented with { index, node } for the mark's source node.
 *
 * For text selections: marks on the text property that overlap the selection range.
 * For node selections: marks on the node_array property that overlap the selection range.
 *
 * @param {Record<string, object>} schema
 * @param {object} doc
 * @param {object | null} selection
 * @returns {Array<{ start_offset: number, end_offset: number, node_id: string, index: number, node: object }>}
 */
export function getSelectedMarks(schema, doc, selection) {
    if (!selection) return [];
    if (selection.type === 'property') return [];

    const { start_offset, end_offset } = getSelectionRange(selection);
    const is_collapsed = isSelectionCollapsed(selection);

    let marks;

    try {
        const value = docGet(schema, doc, selection.path);

        if (selection.type === 'text') {
            if (!value || !Array.isArray(value.marks)) return [];
            marks = value.marks;
        } else if (selection.type === 'node') {
            if (!value || !Array.isArray(value.marks)) return [];
            marks = value.marks;
        } else {
            return [];
        }
    } catch {
        return [];
    }

    // Collapsed selection returns marks that contain the cursor
    // Non-collapsed returns marks that overlap the selection
    return marks
        .map((mark, index) => {
            const mark_node = doc.nodes[mark.node_id];
            const overlaps = is_collapsed
                ? mark.start_offset <= start_offset && mark.end_offset > start_offset
                : mark.start_offset < end_offset && mark.end_offset > start_offset;

            if (!overlaps) return null;

            return {
                start_offset: mark.start_offset,
                end_offset: mark.end_offset,
                node_id: mark.node_id,
                index,
                node: mark_node || null
            };
        })
        .filter(Boolean);
}

/**
 * Get annotations touched by the current selection.
 * Same logic as getSelectedMarks but for annotations.
 *
 * @param {Record<string, object>} schema
 * @param {object} doc
 * @param {object | null} selection
 * @returns {Array<{ start_offset: number, end_offset: number, node_id: string, index: number, node: object }>}
 */
export function getSelectedAnnotations(schema, doc, selection) {
    if (!selection) return [];
    if (selection.type === 'property') return [];

    const { start_offset, end_offset } = getSelectionRange(selection);
    const is_collapsed = isSelectionCollapsed(selection);

    let annotations;

    try {
        const value = docGet(schema, doc, selection.path);

        if (selection.type === 'text') {
            if (!value || !Array.isArray(value.annotations)) return [];
            annotations = value.annotations;
        } else if (selection.type === 'node') {
            if (!value || !Array.isArray(value.annotations)) return [];
            annotations = value.annotations;
        } else {
            return [];
        }
    } catch {
        return [];
    }

    return annotations
        .map((ann, index) => {
            const ann_node = doc.nodes[ann.node_id];
            const overlaps = is_collapsed
                ? ann.start_offset <= start_offset && ann.end_offset > start_offset
                : ann.start_offset < end_offset && ann.end_offset > start_offset;

            if (!overlaps) return null;

            return {
                start_offset: ann.start_offset,
                end_offset: ann.end_offset,
                node_id: ann.node_id,
                index,
                node: ann_node || null
            };
        })
        .filter(Boolean);
}

/**
 * Get the set of range types that touch the selection.
 * Range types are derived from the referenced node's type.
 *
 * @param {Array<{ node_id: string, node?: { type: string } | null }>} ranges
 * @param {string} kind — 'mark' or 'annotation'
 * @returns {Set<string>}
 */
export function getSelectedRangeTypes(ranges, kind) {
    const types = new Set();

    for (const range of ranges) {
        if (range.node && range.node.type) {
            types.add(range.node.type);
        }
    }

    return types;
}

/**
 * Check if the currently selected marks allow switching to a new mark type.
 * Used by ToggleMarkCommand.isEnabled.
 *
 * Marks are mutually exclusive: same-type marks cannot overlap.
 * A property-less mark can switch type if exactly one mark touches
 * the selection. Mixed touches disable toggling.
 *
 * @param {Array<{ node_id: string, node?: { type: string } | null }>} selected_marks
 * @param {string[]} available_mark_types
 * @returns {boolean}
 */
export function canSwitchMarkType(selected_marks, available_mark_types) {
    if (selected_marks.length === 0) return available_mark_types.length > 0;
    if (selected_marks.length === 1) return true;

    // Multiple marks touched — check if they're all the same type
    if (!selected_marks[0].node) return false;
    const first_type = selected_marks[0].node.type;
    return selected_marks.every(m => m.node && m.node.type === first_type);
}
