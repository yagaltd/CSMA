/**
 * JsonFormatter — generic best-effort minimal-JSON serializer.
 *
 * Used as a fallback by AgentContextService when no domain serializer is
 * registered for a `{ store, format: 'json' }` pair. Produces stable,
 * compact JSON with sorted object keys so output is deterministic and
 * diff-friendly. Functions, symbols, and `undefined` are dropped.
 */

function replacer(_key, value) {
    if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'bigint') {
        return `${value}n`;
    }
    if (value === null) {
        return null;
    }
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'object') {
        // Sort keys for stable output.
        const sorted = {};
        Object.keys(value)
            .sort()
            .forEach((k) => {
                const v = value[k];
                if (typeof v === 'function' || typeof v === 'symbol' || v === undefined) {
                    return;
                }
                sorted[k] = v;
            });
        return sorted;
    }
    return value;
}

/**
 * @param {any} data      record(s) to serialize
 * @param {object} options { store, id }
 * @returns {string}
 */
export function formatJson(data, options = {}) {
    const envelope = {
        store: typeof options.store === 'string' ? options.store : 'record',
        ...(options.id ? { id: options.id } : {}),
        data: data === undefined ? null : data
    };
    return JSON.stringify(envelope, replacer);
}
