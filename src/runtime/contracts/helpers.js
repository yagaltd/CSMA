/**
 * Shared contract authoring helpers.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3). Contracts.js
 * re-exports these so existing imports keep working.
 */
export function contract(metadata, schema) {
    return {
        // Required ECCA metadata
        version: metadata.version || 1,
        type: metadata.type, // 'event' or 'intent'
        owner: metadata.owner,
        lifecycle: metadata.lifecycle || 'active', // draft | active | deprecated | retired
        stability: metadata.stability || 'stable', // experimental | stable
        compliance: metadata.compliance || 'public', // public | pii | confidential
        description: metadata.description,

        // Optional fields
        ...(metadata.security && { security: metadata.security }),
        ...(metadata.deprecation && { deprecation: metadata.deprecation }),
        ...(metadata.rationale && { rationale: metadata.rationale }),

        // Superstruct schema
        schema
    };
}

/**
 * Deprecated Events Set
 * Events in this set will trigger warnings when published via EventBus
 * 
 * When deprecating a contract:
 * 1. Add event name to this set
 * 2. Set lifecycle: 'deprecated' in contract metadata
 * 3. Add deprecation object with since, removeBy, reason, replacement
 */
export const DeprecatedEvents = new Set([
    // Example: 'OLD_EVENT_NAME'
]);
