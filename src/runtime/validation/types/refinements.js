/**
 * CSMA Validation - Refinements
 * Forked from Superstruct v2.0.2
 */

import { Struct } from '../struct.js';
import { print } from '../utils.js';

/**
 * Refine a struct with additional validation logic
 */
export function refine(struct, name, refiner) {
    return new Struct({
        ...struct,
        refiner: (value, ctx) => {
            const result = struct.refiner(value, ctx);
            if (result !== true) {
                return result;
            }

            const refined = refiner(value, ctx);
            if (refined === true) {
                return true;
            }

            // Convert result to failure
            if (typeof refined === 'string') {
                return [{
                    value,
                    type: struct.type,
                    refinement: name,
                    key: ctx.path[ctx.path.length - 1],
                    path: ctx.path,
                    branch: ctx.branch,
                    message: refined
                }];
            }

            return [{
                value,
                type: struct.type,
                refinement: name,
                key: ctx.path[ctx.path.length - 1],
                path: ctx.path,
                branch: ctx.branch,
                message: `Expected ${name} refinement to pass`
            }];
        }
    });
}

/**
 * Ensure that a string, array, map, or set has a specific size
 */
export function size(struct, min, max) {
    return refine(struct, 'size', (value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
            const length = value.length;
            if (min !== undefined && length < min) {
                return `Expected length to be at least ${min}, but received ${length}`;
            }
            if (max !== undefined && length > max) {
                return `Expected length to be at most ${max}, but received ${length}`;
            }
            return true;
        }

        if (value instanceof Map || value instanceof Set) {
            const size = value.size;
            if (min !== undefined && size < min) {
                return `Expected size to be at least ${min}, but received ${size}`;
            }
            if (max !== undefined && size > max) {
                return `Expected size to be at most ${max}, but received ${size}`;
            }
            return true;
        }

        return true;
    });
}

/**
 * Ensure that a string matches a regular expression
 */
export function pattern(struct, regexp) {
    return refine(struct, 'pattern', (value) => {
        if (typeof value === 'string') {
            if (!regexp.test(value)) {
                return `Expected to match pattern ${regexp}, but received: ${print(value)}`;
            }
        }
        return true;
    });
}

/**
 * Ensure that a number is an integer
 */
export function integer() {
    const numberStruct = new Struct({
        type: 'number',
        schema: null,
        validator(value) {
            return (
                (typeof value === 'number' && !isNaN(value)) ||
                `Expected a number, but received: ${print(value)}`
            );
        }
    });

    return refine(numberStruct, 'integer', (value) => {
        if (!Number.isInteger(value)) {
            return `Expected an integer, but received: ${print(value)}`;
        }
        return true;
    });
}
