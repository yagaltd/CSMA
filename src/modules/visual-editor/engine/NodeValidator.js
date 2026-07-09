/**
 * Node validation — validates individual nodes against the document schema.
 *
 * Checks type existence, ID validity, property types, marks/annotations,
 * node references, and structural invariants.
 *
 * Ported from svedit lib/doc_utils.js — validate_node, isIdValid, and
 * validate_config_components.
 */

import { getPropertyDefault } from './DocumentDefaults.js';
import { isPathStringSegmentValid } from './SelectionModel.js';

/**
 * Validate a node ID string.
 * IDs must be non-empty, start with a letter or underscore, contain only
 * letters/numbers/underscores/dashes, and not contain '__'.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isIdValid(id) {
    return isPathStringSegmentValid(id);
}

/**
 * Validate a single node against the document schema.
 *
 * @param {object} node — the node to validate
 * @param {Record<string, object>} schema — the document schema
 * @param {Record<string, object>} all_nodes — all nodes in the document
 * @param {object} [options]
 * @param {boolean} [options.require_references=true] — validate node references exist
 * @throws {Error} If node is invalid
 */
export function validateNode(node, schema, all_nodes, { require_references = true } = {}) {
    if (!node || typeof node !== 'object') {
        throw new Error('Node must be a non-null object');
    }

    // 1. Node must have an id
    if (!node.id || typeof node.id !== 'string') {
        throw new Error('Node must have a string "id" property');
    }

    if (!isIdValid(node.id)) {
        throw new Error(
            `Invalid node ID "${node.id}". IDs must start with a letter or underscore, ` +
            'contain only letters, numbers, underscores, or dashes, and not contain "__".'
        );
    }

    // 2. Node type must exist in schema
    if (!node.type || typeof node.type !== 'string') {
        throw new Error(`Node "${node.id}" must have a string "type" property`);
    }

    const node_schema = schema[node.type];
    if (!node_schema) {
        throw new Error(`Unknown node type "${node.type}" for node "${node.id}"`);
    }

    // 3. Validate each property against schema definition
    for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
        const value = node[prop_name];

        // Required properties must not be undefined
        if (value === undefined) {
            // Check if there's a default — if so, missing is OK (defaults filled later)
            const default_val = getPropertyDefault(prop_def);
            if (default_val === undefined && prop_def.type !== 'node') {
                throw new Error(
                    `Node "${node.id}" (type "${node.type}") is missing required property "${prop_name}"`
                );
            }
            continue;
        }

        // Validate property value against its type
        validatePropertyValue(node.id, node.type, prop_name, prop_def, value, schema, all_nodes, require_references);
    }

    // 4. Check for extra properties not in schema
    for (const key of Object.keys(node)) {
        if (key !== 'id' && key !== 'type' && !(key in node_schema.properties)) {
            throw new Error(
                `Node "${node.id}" has unknown property "${key}" not defined in schema for type "${node.type}"`
            );
        }
    }
}

/**
 * Validate a single property value against its schema definition.
 *
 * @param {string} node_id
 * @param {string} node_type
 * @param {string} prop_name
 * @param {object} prop_def
 * @param {any} value
 * @param {Record<string, object>} schema
 * @param {Record<string, object>} all_nodes
 * @param {boolean} require_references
 * @throws {Error}
 */
function validatePropertyValue(node_id, node_type, prop_name, prop_def, value, schema, all_nodes, require_references) {
    const type = prop_def.type;

    switch (type) {
        case 'string':
            if (typeof value !== 'string') {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be a string, got ${typeof value}`
                );
            }
            // URL scheme validation for known URL-bearing properties
            if (value.length > 0) {
                validateUrlProperty(node_id, node_type, prop_name, value);
            }
            break;

        case 'number':
            if (typeof value !== 'number' || Number.isNaN(value)) {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be a number, got ${typeof value}`
                );
            }
            break;

        case 'integer':
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be an integer, got ${typeof value}`
                );
            }
            break;

        case 'boolean':
            if (typeof value !== 'boolean') {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be a boolean, got ${typeof value}`
                );
            }
            break;

        case 'datetime':
            if (typeof value !== 'string') {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be a datetime string, got ${typeof value}`
                );
            }
            // Validate parseable by Date
            if (Number.isNaN(Date.parse(value))) {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" is not a valid datetime: "${value}"`
                );
            }
            break;

        case 'string_array':
            if (!Array.isArray(value)) {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be an array, got ${typeof value}`
                );
            }
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] !== 'string') {
                    throw new Error(
                        `Node "${node_id}" property "${prop_name}[${i}]" must be a string, got ${typeof value[i]}`
                    );
                }
            }
            break;

        case 'number_array':
            if (!Array.isArray(value)) {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be an array, got ${typeof value}`
                );
            }
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] !== 'number' || Number.isNaN(value[i])) {
                    throw new Error(
                        `Node "${node_id}" property "${prop_name}[${i}]" must be a number, got ${typeof value[i]}`
                    );
                }
            }
            break;

        case 'boolean_array':
            if (!Array.isArray(value)) {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be an array, got ${typeof value}`
                );
            }
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] !== 'boolean') {
                    throw new Error(
                        `Node "${node_id}" property "${prop_name}[${i}]" must be a boolean, got ${typeof value[i]}`
                    );
                }
            }
            break;

        case 'integer_array':
            if (!Array.isArray(value)) {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be an array, got ${typeof value}`
                );
            }
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] !== 'number' || !Number.isInteger(value[i])) {
                    throw new Error(
                        `Node "${node_id}" property "${prop_name}[${i}]" must be an integer, got ${typeof value[i]}`
                    );
                }
            }
            break;

        case 'text':
            validateTextValue(node_id, prop_name, value, prop_def);
            break;

        case 'node':
            if (typeof value !== 'string') {
                throw new Error(
                    `Node "${node_id}" property "${prop_name}" must be a node ID string, got ${typeof value}`
                );
            }
            if (require_references) {
                validateNodeReference(node_id, prop_name, value, prop_def, all_nodes);
            }
            break;

        case 'node_array':
            validateNodeArrayValue(node_id, node_type, prop_name, value, prop_def, schema, all_nodes, require_references);
            break;

        default:
            throw new Error(
                `Node "${node_id}" property "${prop_name}" has unknown type "${type}"`
            );
    }
}

/**
 * Validate a text property value: { content: string, marks: [], annotations: [] }.
 *
 * @param {string} node_id
 * @param {string} prop_name
 * @param {any} value
 * @param {object} prop_def
 * @throws {Error}
 */
function validateTextValue(node_id, prop_name, value, prop_def) {
    if (!value || typeof value !== 'object') {
        throw new Error(
            `Node "${node_id}" property "${prop_name}" (text) must be an object with content, marks, annotations`
        );
    }

    if (typeof value.content !== 'string') {
        throw new Error(
            `Node "${node_id}" property "${prop_name}.content" must be a string, got ${typeof value.content}`
        );
    }

    if (!Array.isArray(value.marks)) {
        throw new Error(
            `Node "${node_id}" property "${prop_name}.marks" must be an array, got ${typeof value.marks}`
        );
    }

    if (!Array.isArray(value.annotations)) {
        throw new Error(
            `Node "${node_id}" property "${prop_name}.annotations" must be an array, got ${typeof value.annotations}`
        );
    }

    const content_len = value.content.length;

    // Validate each mark
    const allowed_mark_types = prop_def.mark_types || [];
    const marks_by_type = {};

    for (let i = 0; i < value.marks.length; i++) {
        const mark = value.marks[i];
        if (!mark || typeof mark !== 'object') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" must be an object`
            );
        }
        if (typeof mark.node_id !== 'string') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" must have a string node_id`
            );
        }
        if (typeof mark.start_offset !== 'number' || !Number.isInteger(mark.start_offset) || mark.start_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" has invalid start_offset: ${mark.start_offset}`
            );
        }
        if (typeof mark.end_offset !== 'number' || !Number.isInteger(mark.end_offset) || mark.end_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" has invalid end_offset: ${mark.end_offset}`
            );
        }
        if (mark.start_offset >= mark.end_offset) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" has start_offset (${mark.start_offset}) >= end_offset (${mark.end_offset})`
            );
        }
        if (mark.end_offset > content_len) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" end_offset (${mark.end_offset}) exceeds content length (${content_len})`
            );
        }
    }

    // Validate marks are mutually exclusive (same-type marks cannot overlap)
    for (let i = 0; i < value.marks.length; i++) {
        const mark_a = value.marks[i];
        // Determine the type of this mark from its referenced node — we don't
        // have the full nodes map here for strict checking but we check overlap
        for (let j = i + 1; j < value.marks.length; j++) {
            const mark_b = value.marks[j];
            // Same node_id means same type — check they don't overlap
            if (mark_a.node_id === mark_b.node_id) {
                const overlap = mark_a.start_offset < mark_b.end_offset &&
                    mark_b.start_offset < mark_a.end_offset;
                if (overlap) {
                    throw new Error(
                        `Node "${node_id}" property "${prop_name}" has overlapping marks with same node_id "${mark_a.node_id}"`
                    );
                }
            }
        }
    }

    // Validate each annotation (similar to marks but may overlap)
    for (let i = 0; i < value.annotations.length; i++) {
        const ann = value.annotations[i];
        if (!ann || typeof ann !== 'object') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" must be an object`
            );
        }
        if (typeof ann.node_id !== 'string') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" must have a string node_id`
            );
        }
        if (typeof ann.start_offset !== 'number' || !Number.isInteger(ann.start_offset) || ann.start_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" has invalid start_offset: ${ann.start_offset}`
            );
        }
        if (typeof ann.end_offset !== 'number' || !Number.isInteger(ann.end_offset) || ann.end_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" has invalid end_offset: ${ann.end_offset}`
            );
        }
        if (ann.start_offset >= ann.end_offset) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" has start_offset >= end_offset`
            );
        }
        if (ann.end_offset > content_len) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" end_offset exceeds content length`
            );
        }
    }
}

/**
 * Validate a node_array property value: { nodes: string[], marks: [], annotations: [] }.
 *
 * @param {string} node_id
 * @param {string} node_type
 * @param {string} prop_name
 * @param {any} value
 * @param {object} prop_def
 * @param {Record<string, object>} schema
 * @param {Record<string, object>} all_nodes
 * @param {boolean} require_references
 * @throws {Error}
 */
function validateNodeArrayValue(node_id, node_type, prop_name, value, prop_def, schema, all_nodes, require_references) {
    if (!value || typeof value !== 'object') {
        throw new Error(
            `Node "${node_id}" property "${prop_name}" (node_array) must be an object with nodes, marks, annotations`
        );
    }

    if (!Array.isArray(value.nodes)) {
        throw new Error(
            `Node "${node_id}" property "${prop_name}.nodes" must be an array, got ${typeof value.nodes}`
        );
    }

    if (!Array.isArray(value.marks)) {
        throw new Error(
            `Node "${node_id}" property "${prop_name}.marks" must be an array`
        );
    }

    if (!Array.isArray(value.annotations)) {
        throw new Error(
            `Node "${node_id}" property "${prop_name}.annotations" must be an array`
        );
    }

    const allowed_types = prop_def.node_types || [];
    const nodes_len = value.nodes.length;

    // Validate node references
    for (let i = 0; i < value.nodes.length; i++) {
        const ref_id = value.nodes[i];
        if (typeof ref_id !== 'string') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.nodes[${i}]" must be a node ID string, got ${typeof ref_id}`
            );
        }

        if (require_references) {
            validateNodeReference(node_id, `${prop_name}.nodes[${i}]`, ref_id, prop_def, all_nodes);
        }
    }

    // Validate node_array marks
    for (let i = 0; i < value.marks.length; i++) {
        const mark = value.marks[i];
        if (!mark || typeof mark !== 'object') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" must be an object`
            );
        }
        if (typeof mark.node_id !== 'string') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" must have a string node_id`
            );
        }
        if (typeof mark.start_offset !== 'number' || !Number.isInteger(mark.start_offset) || mark.start_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" has invalid start_offset`
            );
        }
        if (typeof mark.end_offset !== 'number' || !Number.isInteger(mark.end_offset) || mark.end_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" has invalid end_offset`
            );
        }
        if (mark.start_offset >= mark.end_offset) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" has start_offset >= end_offset`
            );
        }
        if (mark.end_offset > nodes_len) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.marks[${i}]" end_offset exceeds nodes length`
            );
        }
    }

    // Validate node_array annotations
    for (let i = 0; i < value.annotations.length; i++) {
        const ann = value.annotations[i];
        if (!ann || typeof ann !== 'object') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" must be an object`
            );
        }
        if (typeof ann.node_id !== 'string') {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" must have a string node_id`
            );
        }
        if (typeof ann.start_offset !== 'number' || !Number.isInteger(ann.start_offset) || ann.start_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" has invalid start_offset`
            );
        }
        if (typeof ann.end_offset !== 'number' || !Number.isInteger(ann.end_offset) || ann.end_offset < 0) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" has invalid end_offset`
            );
        }
        if (ann.start_offset >= ann.end_offset) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" has start_offset >= end_offset`
            );
        }
        if (ann.end_offset > nodes_len) {
            throw new Error(
                `Node "${node_id}" property "${prop_name}.annotations[${i}]" end_offset exceeds nodes length`
            );
        }
    }
}

/**
 * Validate a node reference — checks the referenced node exists and has
 * an allowed type.
 *
 * @param {string} node_id — the node holding the reference
 * @param {string} prop_path — property path for error messages
 * @param {string} ref_id — the referenced node ID
 * @param {object} prop_def — property definition with node_types
 * @param {Record<string, object>} all_nodes
 * @throws {Error}
 */
function validateNodeReference(node_id, prop_path, ref_id, prop_def, all_nodes) {
    const ref_node = all_nodes[ref_id];
    if (!ref_node) {
        throw new Error(
            `Node "${node_id}" property "${prop_path}" references non-existent node "${ref_id}"`
        );
    }

    // Check that referenced node type is allowed
    const allowed_types = prop_def.node_types || [];
    if (allowed_types.length > 0 && !allowed_types.includes(ref_node.type)) {
        throw new Error(
            `Node "${node_id}" property "${prop_path}" references node "${ref_id}" of type "${ref_node.type}", ` +
            `but only ${allowed_types.join(', ')} are allowed`
        );
    }
}

/**
 * Validate that config components cover all schema node types.
 * Every node type in the schema must have a corresponding component
 * in the config.
 *
 * @param {Record<string, object>} schema
 * @param {object} config — { components: Record<string, any> }
 * @throws {Error}
 */
export function validateConfigComponents(schema, config) {
    // Skip validation for headless/engine-only usage — no components provided.
    if (!config || !config.components || Object.keys(config.components).length === 0) {
        return;
    }

    for (const node_type of Object.keys(schema)) {
        if (!(node_type in config.components)) {
            throw new Error(
                `No component registered for node type "${node_type}". ` +
                'All schema node types must have a corresponding component in config.components.'
            );
        }
    }
}

/**
 * Allowed URL schemes for image and link properties.
 * javascript: and data: are blocked to prevent XSS.
 * data:image/* is allowed conditionally for inline images.
 */
const ALLOWED_URL_SCHEMES = ['https:', 'http:', '/', './', '../', '#'];
const ALLOWED_DATA_SCHEMES = ['data:image/'];

/**
 * Validate that a URL-bearing property uses an allowed scheme.
 *
 * @param {string} node_id
 * @param {string} node_type
 * @param {string} prop_name
 * @param {string} value — the URL string
 * @throws {Error} if scheme is disallowed
 */
function validateUrlProperty(node_id, node_type, prop_name, value) {
    // Only validate known URL-bearing properties
    const is_image_src = node_type === 'image' && prop_name === 'src';
    const is_link_href = node_type === 'link' && prop_name === 'href';

    if (!is_image_src && !is_link_href) return;

    // Relative URLs and fragments are always allowed
    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('#')) {
        return;
    }

    // Check explicit scheme
    const colon_idx = value.indexOf(':');
    if (colon_idx === -1) return; // No scheme — relative, allow

    const scheme = value.slice(0, colon_idx + 1).toLowerCase();

    if (ALLOWED_URL_SCHEMES.includes(scheme)) return;

    // Check data:image/* for image src — must check full value, not just scheme
    if (is_image_src && value.toLowerCase().startsWith('data:image/')) return;
    throw new Error(
        `Node "${node_id}" property "${prop_name}" has disallowed URL scheme "${scheme}". ` +
        `Allowed: ${ALLOWED_URL_SCHEMES.join(', ')}${is_image_src ? ', data:image/*' : ''}`
    );
}
