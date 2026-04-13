/**
 * CSMA Validation - Contract Helper
 * Wraps Superstruct schemas with ECCA metadata
 */

/**
 * Create a CSMA contract with ECCA metadata
 * 
 * @param {Object} config - Contract configuration
 * @param {number} config.version - Contract version
 * @param {string} config.type - 'event' or 'intent'
 * @param {string} config.owner - Service that owns this contract
 * @param {string} config.lifecycle - 'active' or 'deprecated'
 * @param {string} config.stability - 'experimental' or 'stable'
 * @param {string} config.compliance - 'public', 'pii', or 'internal'
 * @param {string} config.description - Human-readable description
 * @param {Object} config.security - Security metadata
 * @param {Object} config.security.rateLimits - Rate limiting configuration
 * @param {Struct} config.schema - Superstruct schema
 * @returns {Object} CSMA contract
 */
export function contract(config) {
    const {
        version,
        type,
        owner,
        lifecycle = 'active',
        stability = 'stable',
        compliance = 'public',
        description = '',
        security = {},
        schema
    } = config;

    // Validate required fields
    if (!version || !type || !owner || !schema) {
        throw new Error('Contract requires: version, type, owner, and schema');
    }

    if (!['event', 'intent'].includes(type)) {
        throw new Error('Contract type must be "event" or "intent"');
    }

    if (!['active', 'deprecated'].includes(lifecycle)) {
        throw new Error('Lifecycle must be "active" or "deprecated"');
    }

    if (!['experimental', 'stable'].includes(stability)) {
        throw new Error('Stability must be "experimental" or "stable"');
    }

    if (!['public', 'pii', 'internal'].includes(compliance)) {
        throw new Error('Compliance must be "public", "pii", or "internal"');
    }

    // Return contract with ECCA metadata + validation methods
    return {
        // ECCA metadata
        version,
        type,
        owner,
        lifecycle,
        stability,
        compliance,
        description,
        security,

        // Schema
        schema,

        // Validation methods (delegated to schema)
        validate: (payload, options) => schema.validate(payload, options),
        assert: (payload, message) => schema.assert(payload, message),
        is: (payload) => schema.is(payload),

        // ECCA helpers
        isDeprecated: () => lifecycle === 'deprecated',
        isExperimental: () => stability === 'experimental',
        requiresPII: () => compliance === 'pii',
        hasRateLimits: () => Boolean(security?.rateLimits),

        // Get rate limit config
        getRateLimits: () => security?.rateLimits || null
    };
}

/**
 * Helper to create an event contract
 */
export function eventContract(config) {
    return contract({ ...config, type: 'event' });
}

/**
 * Helper to create an intent contract
 */
export function intentContract(config) {
    return contract({ ...config, type: 'intent' });
}
