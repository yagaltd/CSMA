/**
 * Selection model — types, validation, and utilities for editor selections.
 *
 * Three selection types:
 * - text: a range within a text property (cursor or highlight)
 * - node: a range of nodes within a node_array property
 * - property: a single property of a node (field focus)
 *
 * Ported from svedit lib/types.d.ts and lib/utils.js — selection validation,
 * range normalization, path utilities.
 */

/** @type {{ TEXT: 'text', NODE: 'node', PROPERTY: 'property' }} */
export const SELECTION_TYPES = {
    TEXT: 'text',
    NODE: 'node',
    PROPERTY: 'property'
};

/**
 * Path segment validation regex.
 * Segments must start with a letter or underscore, contain only letters,
 * numbers, underscores, or dashes, and must not contain '__' (path separator).
 */
const VALID_SEGMENT_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const PATH_SEPARATOR = '__';

/**
 * Check if a path string segment is valid.
 *
 * @param {string} segment
 * @returns {boolean}
 */
export function isPathStringSegmentValid(segment) {
    if (typeof segment !== 'string' || segment.length === 0) {
        return false;
    }
    if (segment.includes(PATH_SEPARATOR)) {
        return false;
    }
    return VALID_SEGMENT_RE.test(segment);
}

/**
 * Assert a path string segment is valid. Throws on invalid.
 *
 * @param {string} segment
 * @throws {Error}
 */
export function assertPathStringSegment(segment) {
    if (typeof segment !== 'string') {
        throw new Error(`Path segment must be a string, got ${typeof segment}`);
    }
    if (segment.length === 0) {
        throw new Error('Path segment must not be empty');
    }
    if (segment.includes(PATH_SEPARATOR)) {
        throw new Error(`Path segment must not contain "${PATH_SEPARATOR}": "${segment}"`);
    }
    if (!VALID_SEGMENT_RE.test(segment)) {
        throw new Error(
            `Path segment "${segment}" is invalid. Must start with a letter or underscore ` +
            'and contain only letters, numbers, underscores, or dashes.'
        );
    }
}

/**
 * Serialize a DocumentPath to a string for caching and comparison.
 *
 * @param {Array<string|number>} path
 * @returns {string}
 */
export function serializePath(path) {
    return path.map(String).join(PATH_SEPARATOR);
}

/**
 * Get the normalized range [start_offset, end_offset] from a selection.
 * Normalizes anchor/focus order so start <= end always.
 *
 * @param {object} selection — { type, path, anchor_offset, focus_offset }
 * @returns {{ start_offset: number, end_offset: number }}
 */
export function getSelectionRange(selection) {
    if (selection.type === 'property') {
        return { start_offset: 0, end_offset: 0 };
    }

    const { anchor_offset, focus_offset } = selection;
    if (anchor_offset <= focus_offset) {
        return { start_offset: anchor_offset, end_offset: focus_offset };
    }
    return { start_offset: focus_offset, end_offset: anchor_offset };
}

/**
 * Check if a selection is collapsed (anchor === focus).
 *
 * @param {object} selection
 * @returns {boolean}
 */
export function isSelectionCollapsed(selection) {
    if (!selection) return true;
    if (selection.type === 'property') return true;
    return selection.anchor_offset === selection.focus_offset;
}

/**
 * Validate a selection against a session.
 * Checks: path exists, path segments are valid, offsets within bounds,
 * selection type matches target.
 *
 * @param {object | null} selection
 * @param {object} session — { schema, doc, inspect(path), get(path) }
 * @throws {Error}
 */
export function validateSelection(selection, session) {
    if (selection === null || selection === undefined) {
        return; // null selection is always valid
    }

    // Validate type
    if (!selection.type || !Object.values(SELECTION_TYPES).includes(selection.type)) {
        throw new Error(
            `Invalid selection type "${selection.type}". ` +
            `Must be one of: ${Object.values(SELECTION_TYPES).join(', ')}`
        );
    }

    // Validate path exists
    if (!Array.isArray(selection.path)) {
        throw new Error('Selection path must be an array');
    }

    if (selection.path.length === 0) {
        throw new Error('Selection path must not be empty');
    }

    // Validate path string segments
    for (const segment of selection.path) {
        if (typeof segment === 'string') {
            assertPathStringSegment(segment);
        } else if (typeof segment !== 'number' || !Number.isInteger(segment) || segment < 0) {
            throw new Error(`Path segment must be a valid string or non-negative integer, got ${JSON.stringify(segment)}`);
        }
    }

    // Text and node selections need anchor/focus offsets
    if (selection.type === 'text' || selection.type === 'node') {
        if (typeof selection.anchor_offset !== 'number' || !Number.isInteger(selection.anchor_offset) || selection.anchor_offset < 0) {
            throw new Error(`anchor_offset must be a non-negative integer, got ${selection.anchor_offset}`);
        }
        if (typeof selection.focus_offset !== 'number' || !Number.isInteger(selection.focus_offset) || selection.focus_offset < 0) {
            throw new Error(`focus_offset must be a non-negative integer, got ${selection.focus_offset}`);
        }
    }

    // Validate against document
    try {
        const path_info = session.inspect(selection.path);

        if (selection.type === 'text') {
            // Must point to a text property
            if (path_info.kind !== 'property' || path_info.type !== 'text') {
                throw new Error(
                    `Text selection must point to a text property. Path ${JSON.stringify(selection.path)} resolves to kind "${path_info.kind}"`
                );
            }
            // Validate offsets within bounds
            const value = session.get(selection.path);
            if (value && typeof value.content === 'string') {
                const max_offset = value.content.length;
                if (selection.anchor_offset > max_offset || selection.focus_offset > max_offset) {
                    throw new Error(
                        `Selection offset out of bounds: ${Math.max(selection.anchor_offset, selection.focus_offset)} > ${max_offset}`
                    );
                }
            }
        } else if (selection.type === 'node') {
            // Must point to a node_array property
            if (path_info.kind !== 'property' || path_info.type !== 'node_array') {
                throw new Error(
                    `Node selection must point to a node_array property. Path ${JSON.stringify(selection.path)} resolves to kind "${path_info.kind}"`
                );
            }
            // Validate offsets within bounds
            const value = session.get(selection.path);
            if (value && Array.isArray(value.nodes)) {
                const max_offset = value.nodes.length;
                if (selection.anchor_offset > max_offset || selection.focus_offset > max_offset) {
                    throw new Error(
                        `Node selection offset out of bounds: ${Math.max(selection.anchor_offset, selection.focus_offset)} > ${max_offset}`
                    );
                }
            }
            // Property selections just need a valid path — already verified by inspect
        }
    } catch (error) {
        // If inspect throws (invalid path), wrap with selection context
        if (error.message && error.message.startsWith('Selection')) {
            throw error;
        }
        throw new Error(
            `Invalid selection path ${JSON.stringify(selection.path)}: ${error.message}`
        );
    }
}

/**
 * Create a text selection.
 *
 * @param {Array<string|number>} path — path to a text property
 * @param {number} anchor_offset
 * @param {number} focus_offset
 * @returns {{ type: 'text', path: Array<string|number>, anchor_offset: number, focus_offset: number }}
 */
export function createTextSelection(path, anchor_offset, focus_offset) {
    return { type: 'text', path, anchor_offset, focus_offset };
}

/**
 * Create a node selection.
 *
 * @param {Array<string|number>} path — path to a node_array property
 * @param {number} anchor_offset
 * @param {number} focus_offset
 * @returns {{ type: 'node', path: Array<string|number>, anchor_offset: number, focus_offset: number }}
 */
export function createNodeSelection(path, anchor_offset, focus_offset) {
    return { type: 'node', path, anchor_offset, focus_offset };
}

/**
 * Create a property selection.
 *
 * @param {Array<string|number>} path — path to any property
 * @returns {{ type: 'property', path: Array<string|number> }}
 */
export function createPropertySelection(path) {
    return { type: 'property', path };
}

/**
 * Create a collapsed text selection (cursor) at the given position.
 *
 * @param {Array<string|number>} path
 * @param {number} offset
 * @returns {{ type: 'text', path: Array<string|number>, anchor_offset: number, focus_offset: number }}
 */
export function createCursor(path, offset) {
    return { type: 'text', path, anchor_offset: offset, focus_offset: offset };
}
