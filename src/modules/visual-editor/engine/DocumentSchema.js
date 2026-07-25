/**
 * Document schema definition and validation.
 *
 * A schema declares every node type, its kind (document|block|text|mark|annotation),
 * and its properties with typed definitions. The schema is a plain object map of
 * type name → NodeSchema.
 *
 * Ported from svedit lib/doc_utils.js — schema definition, validation, and
 * property type classification.
 */

/**
 * Identity function that preserves schema type information.
 * Use this to define schemas with IDE autocompletion.
 *
 * @template {Record<string, import('./types').NodeSchema>} S
 * @param {S} schema
 * @returns {S}
 */
export function defineDocumentSchema(schema) {
    return schema;
}

/**
 * Check if a string represents a valid primitive property type.
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isPrimitiveType(type) {
    return [
        'string',
        'number',
        'boolean',
        'integer',
        'datetime',
        'text',
        'string_array',
        'number_array',
        'boolean_array',
        'integer_array'
    ].includes(type);
}

/**
 * All valid node kinds.
 */
export const NODE_KINDS = ['document', 'block', 'text', 'mark', 'annotation'];

/**
 * All valid property types.
 */
export const PROPERTY_TYPES = [
    'string', 'number', 'boolean', 'integer', 'datetime',
    'string_array', 'number_array', 'boolean_array', 'integer_array',
    'text', 'node', 'node_array',
    'array', 'object'
];

/**
 * Get the default node type for a property that references nodes.
 *
 * @param {object} property_definition
 * @returns {string | null}
 */
export function getDefaultNodeType(property_definition) {
    if (!property_definition || !property_definition.node_types) {
        return null;
    }

    if (property_definition.default_node_type) {
        return property_definition.default_node_type;
    }

    if (property_definition.node_types.length === 1) {
        return property_definition.node_types[0];
    }

    return null;
}

/**
 * Validate that a document schema is well-formed.
 * Checks:
 * - All referenced node/mark/annotation types exist in the schema
 * - Text nodes have exactly one text property named 'content'
 * - Node kinds are valid
 * - Property types are valid
 * - node_array and node properties have node_types
 * - mark_types and annotation_types reference existing mark/annotation types
 *
 * @param {Record<string, object>} document_schema
 * @throws {Error} If schema is invalid
 */
export function validateDocumentSchema(document_schema) {
    if (!document_schema || typeof document_schema !== 'object' || Array.isArray(document_schema)) {
        throw new Error('Document schema must be a non-null object');
    }

    const node_types = Object.keys(document_schema);

    // Must have at least one node type
    if (node_types.length === 0) {
        throw new Error('Document schema must define at least one node type');
    }

    for (const [node_type, node_schema] of Object.entries(document_schema)) {
        // Validate node kind
        if (!node_schema.kind || !NODE_KINDS.includes(node_schema.kind)) {
            throw new Error(
                `Node type "${node_type}" has invalid kind "${node_schema.kind}". ` +
                `Must be one of: ${NODE_KINDS.join(', ')}`
            );
        }

        // Validate properties
        if (!node_schema.properties || typeof node_schema.properties !== 'object') {
            throw new Error(`Node type "${node_type}" must have a properties object`);
        }

        const text_property_names = [];

        for (const [prop_name, prop_def] of Object.entries(node_schema.properties)) {
            // Validate property type
            if (!prop_def.type || !PROPERTY_TYPES.includes(prop_def.type)) {
                throw new Error(
                    `Property "${prop_name}" in node type "${node_type}" has invalid type "${prop_def.type}". ` +
                    `Must be one of: ${PROPERTY_TYPES.join(', ')}`
                );
            }

            // Track text properties for text node validation
            if (prop_def.type === 'text') {
                text_property_names.push(prop_name);
            }

            // node_array and node properties must declare node_types
            if (prop_def.type === 'node_array' || prop_def.type === 'node') {
                if (!Array.isArray(prop_def.node_types) || prop_def.node_types.length === 0) {
                    throw new Error(
                        `Property "${prop_name}" in node type "${node_type}" is type "${prop_def.type}" ` +
                        'but has no node_types array'
                    );
                }

                // Validate that referenced node types exist
                for (const ref_type of prop_def.node_types) {
                    if (!document_schema[ref_type]) {
                        throw new Error(
                            `Property "${prop_name}" in node type "${node_type}" ` +
                            `references unknown node type "${ref_type}"`
                        );
                    }
                }

                // Validate default_node_type exists in node_types
                if (prop_def.default_node_type) {
                    if (!prop_def.node_types.includes(prop_def.default_node_type)) {
                        throw new Error(
                            `Property "${prop_name}" in node type "${node_type}" ` +
                            `has default_node_type "${prop_def.default_node_type}" not in node_types`
                        );
                    }
                }
            }

            // Validate mark_types reference existing mark nodes
            if (Array.isArray(prop_def.mark_types)) {
                for (const mark_type of prop_def.mark_types) {
                    const mark_schema = document_schema[mark_type];
                    if (!mark_schema) {
                        throw new Error(
                            `Property "${prop_name}" in node type "${node_type}" ` +
                            `references unknown mark type "${mark_type}"`
                        );
                    }
                    if (mark_schema.kind !== 'mark') {
                        throw new Error(
                            `Property "${prop_name}" in node type "${node_type}" ` +
                            `references "${mark_type}" as a mark_type, but it has kind "${mark_schema.kind}"`
                        );
                    }
                }
            }

            // Validate annotation_types reference existing annotation nodes
            if (Array.isArray(prop_def.annotation_types)) {
                for (const ann_type of prop_def.annotation_types) {
                    const ann_schema = document_schema[ann_type];
                    if (!ann_schema) {
                        throw new Error(
                            `Property "${prop_name}" in node type "${node_type}" ` +
                            `references unknown annotation type "${ann_type}"`
                        );
                    }
                    if (ann_schema.kind !== 'annotation') {
                        throw new Error(
                            `Property "${prop_name}" in node type "${node_type}" ` +
                            `references "${ann_type}" as an annotation_type, but it has kind "${ann_schema.kind}"`
                        );
                    }
                }
            }
        }

        // Text nodes must have exactly one text property named 'content'
        if (node_schema.kind === 'text') {
            if (!text_property_names.includes('content')) {
                throw new Error(
                    `Text node type "${node_type}" must define a "content" property of type text`
                );
            }
            if (text_property_names.length > 1) {
                throw new Error(
                    `Text node type "${node_type}" must not define multiple text properties. ` +
                    `Use "content" as the only text property. Found: ${text_property_names.join(', ')}`
                );
            }
        }
    }
}
