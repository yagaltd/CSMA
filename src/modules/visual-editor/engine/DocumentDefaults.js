/**
 * Document defaults — fill omitted properties with schema-defined defaults
 * and built-in type defaults.
 *
 * Ported from svedit lib/doc_utils.js — getPropertyDefault, fillNodeDefaults,
 * fillDocumentDefaults.
 */

/**
 * Get the default value for a property definition.
 *
 * @param {object} property_definition
 * @returns {any}
 */
export function getPropertyDefault(property_definition) {
    // Explicit default in schema takes precedence
    if ('default' in property_definition) {
        return structuredClone(property_definition.default);
    }

    // Built-in type defaults
    switch (property_definition.type) {
        case 'string':
            return '';
        case 'integer':
            return 0;
        case 'number':
            return 0;
        case 'boolean':
            return false;
        case 'text':
            return { content: '', marks: [], annotations: [] };
        case 'node_array':
            return { nodes: [], marks: [], annotations: [] };
        case 'string_array':
        case 'number_array':
        case 'boolean_array':
        case 'integer_array':
            return [];
        case 'datetime':
            return '';
        case 'node':
            // Node references have no universal default — must be set explicitly
            return undefined;
        default:
            return undefined;
    }
}

/**
 * Fill omitted properties with schema defaults.
 * Returns a shallow copy of the node with cloned default values filled in.
 *
 * This is a convenience helper for schema evolution, not a complete document
 * migration system. Callers are still responsible for proper migrations when
 * schema changes cannot be represented by defaults.
 *
 * @param {object} node — the node to fill defaults for
 * @param {Record<string, object>} schema — the document schema
 * @returns {object} a shallow copy with defaults filled
 */
export function fillNodeDefaults(node, schema) {
    const node_schema = schema[node.type];
    if (!node_schema) {
        // Unknown type — return as-is (validation will catch this)
        return { ...node };
    }

    const node_with_defaults = { ...node };

    for (const [property_name, property_definition] of Object.entries(node_schema.properties)) {
        if (node_with_defaults[property_name] === undefined) {
            const property_default = getPropertyDefault(property_definition);
            if (property_default !== undefined) {
                node_with_defaults[property_name] = property_default;
            }
        }
    }

    return node_with_defaults;
}

/**
 * Fill omitted properties with schema defaults across an entire document.
 * Returns a new document object with defaults filled on every node.
 *
 * @param {object} doc — { document_id, nodes }
 * @param {Record<string, object>} schema
 * @returns {object} document copy with defaults filled
 */
export function fillDocumentDefaults(doc, schema) {
    /** @type {Record<string, object>} */
    const nodes = {};

    for (const [node_id, node] of Object.entries(doc.nodes)) {
        nodes[node_id] = fillNodeDefaults(node, schema);
    }

    return {
        ...doc,
        nodes
    };
}
