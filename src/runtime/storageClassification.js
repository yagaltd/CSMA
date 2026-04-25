export const STORAGE_CLASSIFICATIONS = new Set(['public', 'preference', 'pii', 'secret', 'credential']);

const FORBIDDEN_PRODUCTION_CLASSES = new Set(['secret', 'credential']);

export function normalizeStorageClassification(classification = 'public') {
    return STORAGE_CLASSIFICATIONS.has(classification) ? classification : 'public';
}

export function assertStorageAllowed({ classification = 'public', target = 'localStorage', profile = 'production' } = {}) {
    const normalized = normalizeStorageClassification(classification);
    if (profile === 'production' && FORBIDDEN_PRODUCTION_CLASSES.has(normalized)) {
        throw new Error(`CSMA production security forbids ${normalized} data in ${target}.`);
    }
}

export function isSensitiveStorageClass(classification) {
    return FORBIDDEN_PRODUCTION_CLASSES.has(normalizeStorageClassification(classification));
}
