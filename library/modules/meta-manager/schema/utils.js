export function pruneSchemaValue(value) {
    if (Array.isArray(value)) {
        const next = value
            .map((entry) => pruneSchemaValue(entry))
            .filter((entry) => entry !== undefined);
        return next.length ? next : undefined;
    }

    if (value && typeof value === 'object') {
        const next = {};
        Object.entries(value).forEach(([key, entry]) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                return;
            }
            const pruned = pruneSchemaValue(entry);
            if (pruned !== undefined) {
                next[key] = pruned;
            }
        });
        return Object.keys(next).length ? next : undefined;
    }

    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }

    return value;
}

export function defineSchema(type, build) {
    const schemaBuilder = (input = {}, context = {}) => {
        const payload = build(input, context);
        const pruned = pruneSchemaValue(payload);
        if (!pruned) {
            return null;
        }
        return {
            '@context': 'https://schema.org',
            '@type': type,
            ...pruned
        };
    };

    schemaBuilder.schemaType = type;
    return schemaBuilder;
}
