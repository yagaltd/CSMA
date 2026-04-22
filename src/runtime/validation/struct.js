/**
 * CSMA Validation - Core Struct Class
 * Forked from Superstruct v2.0.2
 */

import { StructError } from './error.js';
import { run, shiftIterator } from './utils.js';

/**
 * Struct objects encapsulate the validation logic for a specific type of values.
 * Once constructed, you use the `assert`, `is` or `validate` helpers to
 * validate unknown input data against the struct.
 */
export class Struct {
    /**
     * @param {Object} props - Struct configuration
     * @param {string} props.type - Type name
     * @param {*} props.schema - Schema definition
     * @param {Function} props.coercer - Coercion function
     * @param {Function} props.validator - Validation function
     * @param {Function} props.refiner - Refinement function
     * @param {Function} props.entries - Entries iterator for nested validation
     */
    constructor(props) {
        const {
            type,
            schema,
            validator,
            refiner,
            coercer = (value) => value,
            entries = function* () { }
        } = props;

        this.type = type;
        this.schema = schema;
        this.entries = entries;
        this.coercer = coercer;

        if (validator) {
            this.validator = (value, context) => {
                const result = validator(value, context);
                return result;
            };
        } else {
            this.validator = () => true;
        }

        if (refiner) {
            this.refiner = (value, context) => {
                const result = refiner(value, context);
                return result;
            };
        } else {
            this.refiner = () => true;
        }
    }

    /**
     * Assert that a value passes the struct's validation, throwing if it doesn't.
     */
    assert(value, message) {
        return assert(value, this, message);
    }

    /**
     * Check if a value passes the struct's validation.
     */
    is(value) {
        return is(value, this);
    }

    /**
     * Validate a value with the struct's validation logic, returning a tuple
     * representing the result.
     * 
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @param {boolean} options.coerce - Whether to coerce the value
     * @param {boolean} options.mask - Whether to mask unknown properties
     * @param {string} options.message - Custom error message
     * @returns {[StructError, undefined] | [undefined, *]} Result tuple
     */
    validate(value, options = {}) {
        return validate(value, this, options);
    }
}

/**
 * Assert that a value passes a struct, throwing if it doesn't.
 */
export function assert(value, struct, message) {
    const result = validate(value, struct, { message });

    if (result[0]) {
        throw result[0];
    }
}

/**
 * Check if a value passes a struct.
 */
export function is(value, struct) {
    const result = validate(value, struct);
    return !result[0];
}

/**
 * Validate a value against a struct, returning an error if invalid, or the
 * value (with potential coercion) if valid.
 */
export function validate(value, struct, options = {}) {
    const tuples = run(value, struct, options);
    const tuple = shiftIterator(tuples);

    if (!tuple) {
        return [new StructError({
            value,
            type: struct.type,
            refinement: undefined,
            key: undefined,
            path: [],
            branch: [value],
            message: 'Validation failed'
        }, function* () { }), undefined];
    }

    if (tuple[0]) {
        const error = new StructError(tuple[0], function* () {
            for (const t of tuples) {
                if (t[0]) {
                    yield t[0];
                }
            }
        });

        return [error, undefined];
    } else {
        const v = tuple[1];
        return [undefined, v];
    }
}
