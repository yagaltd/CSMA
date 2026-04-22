/**
 * CSMA Validation - Error Classes
 * Forked from Superstruct v2.0.2
 */

/**
 * StructError objects are thrown (or returned) when validation fails.
 * 
 * Validation logic is designed to exit early for maximum performance. The error
 * represents the first error encountered during validation. For more detail,
 * the `error.failures()` method can be called to continue validation and receive
 * all the failures in the data.
 */
export class StructError extends TypeError {
    /**
     * @param {Object} failure - The first failure
     * @param {Function} failures - Generator function for all failures
     */
    constructor(failure, failures) {
        let cached;
        const { message, explanation, ...rest } = failure;
        const { path } = failure;
        const msg = path.length === 0
            ? message
            : `At path: ${path.join('.')} -- ${message}`;

        super(explanation ?? msg);

        if (explanation != null) {
            this.cause = msg;
        }

        Object.assign(this, rest);
        this.name = this.constructor.name;

        this.failures = () => {
            return (cached ??= [failure, ...failures()]);
        };
    }
}

/**
 * Create a simple failure object
 * @param {string} message - Error message
 * @param {*} value - The invalid value
 * @param {Array} path - Path to the failure
 * @returns {Object} Failure object
 */
export function createFailure(message, value, path = []) {
    return {
        value,
        key: path[path.length - 1],
        type: 'unknown',
        refinement: undefined,
        message,
        branch: [value],
        path
    };
}
