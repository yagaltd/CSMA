/**
 * Text operations — pure functions on annotated text values.
 *
 * Annotated text shape: { content: string, marks: Array<Range>, annotations: Array<Range> }
 * Range shape: { start_offset: number, end_offset: number, node_id: string }
 *
 * Ported from svedit lib/utils.js — splitText, joinText, charSlice,
 * adjustRangesForDeletion, adjustRangesForInsertion.
 */

/**
 * Get the character length of annotated text.
 *
 * @param {{ content?: string } | null | undefined} text_node
 * @returns {number}
 */
export function getCharLength(text_node) {
    if (!text_node || typeof text_node.content !== 'string') return 0;
    return text_node.content.length;
}

/**
 * Remove zero-width ranges (start_offset === end_offset).
 * Such ranges are invalid — marks/annotations must span at least one character.
 *
 * @param {Array<{ start_offset: number, end_offset: number, node_id: string }>} ranges
 * @returns {Array<{ start_offset: number, end_offset: number, node_id: string }>}
 */
function filterZeroWidthRanges(ranges) {
    return ranges.filter(r => r.start_offset < r.end_offset);
}

/**
 * Split annotated text at the given character position.
 * Returns [left, right] with marks and annotations adjusted.
 *
 * A mark that spans the split position is bisected into two marks
 * (one in left, one in right, both referencing the same node_id).
 *
 * @param {{ content: string, marks: Array<object>, annotations: Array<object> }} text_value
 * @param {number} position — character index to split at (0 to content.length)
 * @returns {[object, object]} [left_text, right_text]
 */
export function splitText(text_value, position) {
    const { content, marks = [], annotations = [] } = text_value;

    if (position < 0 || position > content.length) {
        throw new Error(`Split position ${position} out of bounds for content length ${content.length}`);
    }

    const left_content = content.slice(0, position);
    const right_content = content.slice(position);

    const left = { content: left_content, marks: [], annotations: [] };
    const right = { content: right_content, marks: [], annotations: [] };

    // Adjust marks
    for (const mark of marks) {
        const { start_offset, end_offset, node_id } = mark;
        if (end_offset <= position) {
            // Mark is entirely in left
            left.marks.push({ start_offset, end_offset, node_id });
        } else if (start_offset >= position) {
            // Mark is entirely in right
            right.marks.push({
                start_offset: start_offset - position,
                end_offset: end_offset - position,
                node_id
            });
        } else {
            // Mark spans the split — bisect
            left.marks.push({ start_offset, end_offset: position, node_id });
            right.marks.push({
                start_offset: 0,
                end_offset: end_offset - position,
                node_id
            });
        }
    }

    // Adjust annotations (same logic as marks)
    for (const ann of annotations) {
        const { start_offset, end_offset, node_id } = ann;
        if (end_offset <= position) {
            left.annotations.push({ start_offset, end_offset, node_id });
        } else if (start_offset >= position) {
            right.annotations.push({
                start_offset: start_offset - position,
                end_offset: end_offset - position,
                node_id
            });
        } else {
            left.annotations.push({ start_offset, end_offset: position, node_id });
            right.annotations.push({
                start_offset: 0,
                end_offset: end_offset - position,
                node_id
            });
        }
    }

    return [left, right];
}

/**
 * Join two annotated text values into one.
 * Marks and annotations from the right are offset by left's content length.
 *
 * @param {{ content: string, marks: Array<object>, annotations: Array<object> }} left
 * @param {{ content: string, marks: Array<object>, annotations: Array<object> }} right
 * @returns {{ content: string, marks: Array<object>, annotations: Array<object> }}
 */
export function joinText(left, right) {
    const left_len = left.content.length;
    const content = left.content + right.content;

    const marks = [
        ...left.marks,
        ...right.marks.map(m => ({
            start_offset: m.start_offset + left_len,
            end_offset: m.end_offset + left_len,
            node_id: m.node_id
        }))
    ];

    const annotations = [
        ...left.annotations,
        ...right.annotations.map(a => ({
            start_offset: a.start_offset + left_len,
            end_offset: a.end_offset + left_len,
            node_id: a.node_id
        }))
    ];

    return { content, marks, annotations };
}

/**
 * Slice annotated text [start, end).
 * Returns a new AnnotatedText with offsets adjusted relative to the slice start.
 *
 * @param {{ content: string, marks: Array<object>, annotations: Array<object> }} text_value
 * @param {number} start
 * @param {number} end
 * @returns {{ content: string, marks: Array<object>, annotations: Array<object> }}
 */
export function charSlice(text_value, start, end) {
    const { content, marks = [], annotations = [] } = text_value;

    if (start < 0 || end > content.length || start > end) {
        throw new Error(`Invalid slice [${start}, ${end}) for content length ${content.length}`);
    }

    const result = {
        content: content.slice(start, end),
        marks: [],
        annotations: []
    };

    // Adjust marks: only include those that overlap [start, end)
    for (const mark of marks) {
        const overlap_start = Math.max(mark.start_offset, start);
        const overlap_end = Math.min(mark.end_offset, end);
        if (overlap_start < overlap_end) {
            result.marks.push({
                start_offset: overlap_start - start,
                end_offset: overlap_end - start,
                node_id: mark.node_id
            });
        }
    }

    // Adjust annotations similarly
    for (const ann of annotations) {
        const overlap_start = Math.max(ann.start_offset, start);
        const overlap_end = Math.min(ann.end_offset, end);
        if (overlap_start < overlap_end) {
            result.annotations.push({
                start_offset: overlap_start - start,
                end_offset: overlap_end - start,
                node_id: ann.node_id
            });
        }
    }

    return result;
}

/**
 * Adjust mark/annotation ranges after a deletion at [pos, pos+length].
 * Ranges are shifted left and trimmed. Zero-width ranges are removed.
 *
 * @param {Array<{ start_offset: number, end_offset: number, node_id: string }>} ranges
 * @param {number} pos — start of deleted region
 * @param {number} length — length of deleted region
 * @returns {Array<{ start_offset: number, end_offset: number, node_id: string }>}
 */
export function adjustRangesForDeletion(ranges, pos, length) {
    if (length <= 0) return ranges;

    const adjusted = [];

    for (const range of ranges) {
        let { start_offset, end_offset, node_id } = range;

        if (end_offset <= pos) {
            // Range is entirely before deletion — unchanged
            adjusted.push({ start_offset, end_offset, node_id });
        } else if (start_offset >= pos + length) {
            // Range is entirely after deletion — shift left
            adjusted.push({
                start_offset: start_offset - length,
                end_offset: end_offset - length,
                node_id
            });
        } else {
            // Range overlaps deletion — trim
            if (start_offset < pos) {
                const new_start = start_offset;
                const new_end = pos;
                if (new_start < new_end) {
                    adjusted.push({
                        start_offset: new_start,
                        end_offset: new_end,
                        node_id
                    });
                }
            }
            if (end_offset > pos + length) {
                const new_start = pos;
                const new_end = end_offset - length;
                if (new_start < new_end) {
                    adjusted.push({
                        start_offset: new_start,
                        end_offset: new_end,
                        node_id
                    });
                }
            }
            // Middle portion is deleted — no range produced for it
        }
    }

    return filterZeroWidthRanges(adjusted);
}

/**
 * Adjust mark/annotation ranges after an insertion at pos of length chars.
 * Ranges that span the insertion point are extended; ranges after it are shifted right.
 *
 * @param {Array<{ start_offset: number, end_offset: number, node_id: string }>} ranges
 * @param {number} pos — insertion point
 * @param {number} length — number of characters inserted
 * @returns {Array<{ start_offset: number, end_offset: number, node_id: string }>}
 */
export function adjustRangesForInsertion(ranges, pos, length) {
    if (length <= 0) return ranges;

    return ranges.map(range => {
        let { start_offset, end_offset, node_id } = range;

        if (start_offset >= pos) {
            start_offset += length;
        }
        if (end_offset > pos) {
            end_offset += length;
        }

        return { start_offset, end_offset, node_id };
    });
}

/**
 * Check if two ranges are exclusive (non-overlapping).
 *
 * @param {{ start_offset: number, end_offset: number }} a
 * @param {{ start_offset: number, end_offset: number }} b
 * @returns {boolean}
 */
export function areRangesExclusive(a, b) {
    return a.end_offset <= b.start_offset || b.end_offset <= a.start_offset;
}
