/**
 * CSMA Validation - Primitive Types
 * Forked from Superstruct v2.0.2
 */

import { Struct } from '../struct.js';
import { print, isPlainObject } from '../utils.js';

/**
 * Helper to define simple validators
 */
export function define(type, validator) {
    return new Struct({
        type,
        schema: null,
        validator
    });
}

/**
 * Ensure that a value is a string
 */
export function string() {
    return define('string', (value) => {
        return (
            typeof value === 'string' ||
            `Expected a string, but received: ${print(value)}`
        );
    });
}

/**
 * Ensure that a value is a number
 */
export function number() {
    return define('number', (value) => {
        return (
            (typeof value === 'number' && !isNaN(value)) ||
            `Expected a number, but received: ${print(value)}`
        );
    });
}

/**
 * Ensure that a value is a boolean
 */
export function boolean() {
    return define('boolean', (value) => {
        return (
            typeof value === 'boolean' ||
            `Expected a boolean, but received: ${print(value)}`
        );
    });
}

/**
 * Ensure that a value is a valid Date
 */
export function date() {
    return define('date', (value) => {
        return (
            (value instanceof Date && !isNaN(value.getTime())) ||
            `Expected a valid Date object, but received: ${print(value)}`
        );
    });
}

/**
 * Ensure that a value is one of a set of potential values
 */
export function enums(values) {
    const schema = {};
    const description = values.map((v) => print(v)).join(', ');

    for (const key of values) {
        schema[key] = key;
    }

    return new Struct({
        type: 'enums',
        schema,
        validator(value) {
            return (
                values.includes(value) ||
                `Expected one of \`${description}\`, but received: ${print(value)}`
            );
        }
    });
}

/**
 * Ensure that a value is an array
 */
export function array(Element) {
    return new Struct({
        type: 'array',
        schema: Element,
        *entries(value) {
            if (Element && Array.isArray(value)) {
                for (const [i, v] of value.entries()) {
                    yield [i, v, Element];
                }
            }
        },
        coercer(value) {
            return Array.isArray(value) ? value.slice() : value;
        },
        validator(value) {
            return (
                Array.isArray(value) ||
                `Expected an array value, but received: ${print(value)}`
            );
        }
    });
}

/**
 * Ensure that a value is an object with specific properties
 */
export function object(schema) {
    const knowns = schema ? Object.keys(schema) : [];

    return new Struct({
        type: 'object',
        schema: schema || null,
        *entries(value) {
            if (schema && isPlainObject(value)) {
                const unknowns = new Set(Object.keys(value));

                for (const key of knowns) {
                    unknowns.delete(key);
                    yield [key, value[key], schema[key]];
                }

                // Unknown keys will be caught by validation
                for (const key of unknowns) {
                    // We'll handle unknown keys in the validator
                }
            }
        },
        validator(value) {
            if (!isPlainObject(value)) {
                return `Expected an object, but received: ${print(value)}`;
            }

            // Check for unknown keys if schema is defined
            if (schema) {
                const unknownKeys = Object.keys(value).filter(k => !knowns.includes(k));
                if (unknownKeys.length > 0) {
                    return `Received unknown keys: ${unknownKeys.join(', ')}`;
                }
            }

            return true;
        },
        coercer(value) {
            return isPlainObject(value) ? { ...value } : value;
        }
    });
}

/**
 * Augment a struct to allow undefined values
 */
export function optional(struct) {
    return new Struct({
        ...struct,
        validator: (value, ctx) =>
            value === undefined || struct.validator(value, ctx),
        refiner: (value, ctx) =>
            value === undefined || struct.refiner(value, ctx)
    });
}

/**
 * Augment a struct to allow null values
 */
export function nullable(struct) {
    return new Struct({
        ...struct,
        validator: (value, ctx) =>
            value === null || struct.validator(value, ctx),
        refiner: (value, ctx) =>
            value === null || struct.refiner(value, ctx)
    });
}

/**
 * Ensure that any value passes validation
 */
export function any() {
    return define('any', () => true);
}

/**
 * Ensure that a value is an exact literal value
 */
export function literal(constant) {
    const description = print(constant);
    const type = typeof constant;

    return new Struct({
        type: 'literal',
        schema: type === 'string' || type === 'number' || type === 'boolean'
            ? constant
            : null,
        validator(value) {
            return (
                value === constant ||
                `Expected the literal \`${description}\`, but received: ${print(value)}`
            );
        }
    });
}
