/**
 * CSMA Validation - Utility Functions
 * Forked from Superstruct v2.0.2
 */

/**
 * Check if a value is an object
 */
export function isObject(value) {
    return typeof value === 'object' && value !== null;
}

/**
 * Check if a value is a plain object (not array, not null)
 */
export function isPlainObject(value) {
    if (!isObject(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}

/**
 * Convert a value to a readable string for error messages
 */
export function print(value) {
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return `${value}`;
    }
    if (value === null) {
        return 'null';
    }
    if (value === undefined) {
        return 'undefined';
    }
    if (Array.isArray(value)) {
        return `[${value.length} items]`;
    }
    if (typeof value === 'object') {
        return `{${Object.keys(value).slice(0, 3).join(', ')}${Object.keys(value).length > 3 ? '...' : ''}}`;
    }
    return String(value);
}

/**
 * Convert validation results to failures
 */
export function toFailures(result, context, struct, value) {
    if (result === true) {
        return [];
    }

    if (result === false) {
        const failure = {
            value,
            type: struct.type,
            refinement: undefined,
            key: context.path[context.path.length - 1],
            path: [...context.path],
            branch: [...context.branch],
            message: `Expected a ${struct.type} value, but received: ${print(value)}`
        };
        return [failure];
    }

    if (typeof result === 'string') {
        const failure = {
            value,
            type: struct.type,
            refinement: undefined,
            key: context.path[context.path.length - 1],
            path: [...context.path],
            branch: [...context.branch],
            message: result
        };
        return [failure];
    }

    if (typeof result[Symbol.iterator] === 'function') {
        return Array.from(result).map(r => {
            if (typeof r === 'object' && r !== null) {
                return {
                    value,
                    type: struct.type,
                    refinement: undefined,
                    key: context.path[context.path.length - 1],
                    path: [...context.path],
                    branch: [...context.branch],
                    message: r.message || `Expected a ${struct.type} value`,
                    ...r
                };
            }
            return toFailures(r, context, struct, value)[0];
        });
    }

    return [];
}

/**
 * Run validation logic
 */
export function* run(value, struct, options = {}) {
    const { coerce = false, mask = false } = options;
    const context = {
        path: [],
        branch: [value],
        mask
    };

    // Coerce if requested
    if (coerce) {
        value = struct.coercer(value, context);
        yield [undefined, value];
    }

    // Validate
    const failures = toFailures(
        struct.validator(value, context),
        context,
        struct,
        value
    );

    for (const failure of failures) {
        yield [failure, undefined];
    }

    // Validate nested entries
    for (const [key, child, childStruct] of struct.entries(value, context)) {
        const childContext = {
            path: [...context.path, key],
            branch: [...context.branch, child],
            mask: context.mask
        };

        for (const failure of toFailures(
            childStruct.validator(child, childContext),
            childContext,
            childStruct,
            child
        )) {
            yield [failure, undefined];
        }

        for (const failure of toFailures(
            childStruct.refiner(child, childContext),
            childContext,
            childStruct,
            child
        )) {
            yield [failure, undefined];
        }

    }

    // Run refiners
    const refinerFailures = toFailures(
        struct.refiner(value, context),
        context,
        struct,
        value
    );

    for (const failure of refinerFailures) {
        yield [failure, undefined];
    }

    yield [undefined, value];
}

/**
 * Shift the first value from an iterator
 */
export function shiftIterator(iterator) {
    const { done, value } = iterator.next();
    return done ? undefined : value;
}

/**
 * Convert Superstruct schema to JSON Schema (for LLM function calling)
 * Used by CSMA Instructor for structured extraction
 */
export function schemaToJSONSchema(struct, description) {
    const type = struct.type;
    const schema = struct.schema;

    // Handle primitive types
    if (type === 'string') {
        return {
            type: 'string',
            description: description || 'A string value'
        };
    }

    if (type === 'number') {
        return {
            type: 'number',
            description: description || 'A numeric value'
        };
    }

    if (type === 'integer') {
        return {
            type: 'integer',
            description: description || 'An integer value'
        };
    }

    if (type === 'boolean') {
        return {
            type: 'boolean',
            description: description || 'A boolean value'
        };
    }

    // Handle object type
    if (type === 'object') {
        const properties = {};
        const required = [];

        for (const [key, value] of Object.entries(schema)) {
            // Check if field is optional
            const isOptional = value.type === 'optional' || value.type === 'nullable';

            // Get the inner struct for optional/nullable
            const innerStruct = isOptional ? value.schema : value;

            properties[key] = schemaToJSONSchema(innerStruct, value.description);

            if (!isOptional) {
                required.push(key);
            }
        }

        return {
            type: 'object',
            properties,
            required,
            description: description || 'An object'
        };
    }

    // Handle array type
    if (type === 'array') {
        return {
            type: 'array',
            items: schemaToJSONSchema(schema),
            description: description || 'An array of items'
        };
    }

    // Handle enums
    if (type === 'enums') {
        return {
            type: 'string',
            enum: schema,
            description: description || `One of: ${schema.join(', ')}`
        };
    }

    // Handle literal
    if (type === 'literal') {
        return {
            type: typeof schema,
            const: schema,
            description: description || `Must be: ${schema}`
        };
    }

    // Handle optional/nullable
    if (type === 'optional' || type === 'nullable') {
        const innerSchema = schemaToJSONSchema(schema);
        return {
            ...innerSchema,
            description: description || innerSchema.description
        };
    }

    // Handle refinements (size, pattern, etc.)
    if (type === 'string' && struct.refiner) {
        // Could be email, url, etc.
        return {
            type: 'string',
            description: description || 'A validated string'
        };
    }

    // Fallback
    return {
        type: 'string',
        description: description || `A ${type} value`
    };
}
