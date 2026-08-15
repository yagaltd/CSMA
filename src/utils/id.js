/**
 * Shared ID Generator (Phase 3.1)
 * Single source of truth for unique identifiers across the template.
 *
 * Prefers `crypto.randomUUID()`; falls back to a time + `Math.random`
 * token for environments without the Crypto API. An optional prefix is
 * prepended with a `-` separator. Callers that need a different separator
 * wrap the call themselves.
 */

/**
 * Generate a unique ID.
 * @param {string} [prefix=''] Optional prefix, joined with `-`.
 * @returns {string} Unique identifier string.
 */
export function uid(prefix = '') {
    const cryptoRef = globalThis.crypto;
    if (cryptoRef?.randomUUID) {
        const id = cryptoRef.randomUUID();
        return prefix ? `${prefix}-${id}` : id;
    }
    const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return prefix ? `${prefix}-${fallback}` : fallback;
}
