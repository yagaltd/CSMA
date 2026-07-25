/**
 * AsciiFormatter — generic best-effort ASCII tree serializer.
 *
 * Used as a fallback by AgentContextService when no domain serializer is
 * registered for a `{ store, format: 'ascii' }` pair. Renders nested
 * objects/arrays as a Unicode box-drawing tree.
 *
 *   store
 *   ├─ key: value
 *   ├─ nested
 *   │  └─ inner: 1
 *   └─ list
 *      ├─ 0: a
 *      └─ 1: b
 */

const MAX_DEPTH = 8;

function escapeScalar(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : String(value);
    const s = String(value);
    // Collapse newlines so multi-line strings stay on one tree node.
    return s.replace(/\s+/g, ' ');
}

function renderChildren(out, value, prefix, depth) {
    if (depth > MAX_DEPTH) {
        out.push(`${prefix}└─ …`);
        return;
    }

    let entries;
    if (Array.isArray(value)) {
        entries = value.map((v, i) => [String(i), v]);
    } else if (value && typeof value === 'object') {
        entries = Object.keys(value)
            .sort()
            .filter((k) => {
                const v = value[k];
                return typeof v !== 'function' && typeof v !== 'symbol' && v !== undefined;
            })
            .map((k) => [k, value[k]]);
    } else {
        return;
    }

    if (entries.length === 0) {
        out.push(`${prefix.replace(/[├│]\s*$/, '│  ')}(empty)`);
        return;
    }

    entries.forEach(([key, child], index) => {
        const isLast = index === entries.length - 1;
        const branch = isLast ? '└─' : '├─';
        const childPrefix = `${prefix}${isLast ? '   ' : '│  '}`;

        if (child instanceof Date) {
            out.push(`${prefix}${branch} ${key}: ${child.toISOString()}`);
            return;
        }
        if (Array.isArray(child) && child.length === 0) {
            out.push(`${prefix}${branch} ${key}: []`);
            return;
        }
        if (child && typeof child === 'object') {
            out.push(`${prefix}${branch} ${key}`);
            renderChildren(out, child, childPrefix, depth + 1);
            return;
        }
        out.push(`${prefix}${branch} ${key}: ${escapeScalar(child)}`);
    });
}

/**
 * @param {any} data      record(s) to serialize
 * @param {object} options { store, id }
 * @returns {string}
 */
export function formatAscii(data, options = {}) {
    const root = typeof options.store === 'string' && options.store.trim() !== ''
        ? options.store
        : 'record';
    const rootLabel = options.id ? `${root} #${options.id}` : root;

    const out = [rootLabel];

    if (data === undefined || data === null) {
        out.push('└─ (no data)');
        return out.join('\n');
    }

    if (!Array.isArray(data) && (typeof data !== 'object' || data instanceof Date)) {
        out.push(`└─ ${escapeScalar(data)}`);
        return out.join('\n');
    }

    renderChildren(out, data, '', 1);
    return out.join('\n');
}
