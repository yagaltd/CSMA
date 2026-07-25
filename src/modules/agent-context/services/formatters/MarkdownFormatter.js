/**
 * MarkdownFormatter — generic best-effort markdown serializer.
 *
 * Used as a fallback by AgentContextService when no domain serializer is
 * registered for a `{ store, format }` pair. Produces stable, token-efficient
 * output for arbitrary record shapes:
 *
 *   ## <store>
 *
 *   - key: value
 *   - nested:
 *     - innerKey: innerValue
 *   - array:
 *     - item1
 *     - item2
 *
 * Rules:
 *  - one heading per store
 *  - keys sorted for deterministic output
 *  - strings escaped only minimally (leading "-" or "#" gets a backslash to
 *    avoid ambiguous markdown nesting)
 *  - functions, symbols, undefined → omitted
 *  - null rendered as `null`
 */

const MAX_DEPTH = 8;

function escapeScalar(value) {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : String(value);
    if (typeof value === 'bigint') return `${value}n`;
    const s = String(value);
    // Avoid emitting a value that the next parser would mistake for a list
    // item or heading.
    if (/^\s*([-+*]\s+|#)/.test(s)) {
        return `\\${s}`;
    }
    return s;
}

function renderValue(lines, depth, indent, value) {
    if (depth > MAX_DEPTH) {
        lines.push(`${indent}- …`);
        return;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            lines.push(`${indent}- (empty array)`);
            return;
        }
        value.forEach((item) => renderValue(lines, depth + 1, indent, item));
        return;
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
        const keys = Object.keys(value).sort();
        if (keys.length === 0) {
            lines.push(`${indent}- (empty object)`);
            return;
        }
        keys.forEach((key) => {
            const v = value[key];
            if (typeof v === 'function' || typeof v === 'symbol' || v === undefined) {
                return;
            }
            if (v instanceof Date) {
                lines.push(`${indent}- ${key}: ${v.toISOString()}`);
                return;
            }
            if (Array.isArray(v) && v.length === 0) {
                lines.push(`${indent}- ${key}: []`);
                return;
            }
            if (v && typeof v === 'object') {
                lines.push(`${indent}- ${key}:`);
                renderValue(lines, depth + 1, `${indent}  `, v);
                return;
            }
            lines.push(`${indent}- ${key}: ${escapeScalar(v)}`);
        });
        return;
    }

    if (value instanceof Date) {
        lines.push(`${indent}- ${value.toISOString()}`);
        return;
    }

    const scalar = escapeScalar(value);
    if (scalar !== '') {
        lines.push(`${indent}- ${scalar}`);
    }
}

/**
 * @param {any} data      record(s) to serialize
 * @param {object} options { store, id, truncate }
 * @returns {string}
 */
export function formatMarkdown(data, options = {}) {
    const storeName = typeof options.store === 'string' && options.store.trim() !== ''
        ? options.store
        : 'record';
    const idSuffix = options.id ? ` #${options.id}` : '';

    const lines = [`## ${storeName}${idSuffix}`, ''];

    if (data === undefined || data === null) {
        lines.push('_(no data)_');
        return lines.join('\n');
    }

    // Wrap single record in an array-of-one so the same renderer handles
    // both shapes uniformly; consumers see "- key: value" lines.
    if (Array.isArray(data)) {
        if (data.length === 0) {
            lines.push('_(empty)_');
            return lines.join('\n');
        }
        data.forEach((record, index) => {
            if (data.length > 1) {
                lines.push(`- record[${index}]:`);
                renderValue(lines, 1, '  ', record);
            } else {
                renderValue(lines, 1, '', record);
            }
        });
    } else {
        renderValue(lines, 1, '', data);
    }

    return lines.join('\n');
}
