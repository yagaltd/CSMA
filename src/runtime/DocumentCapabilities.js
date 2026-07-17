const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DEFAULT_TRUSTED_ORIGINS = Object.freeze(['agent', 'component', 'worker', 'system']);

export class DocumentCapabilityError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'DocumentCapabilityError';
        this.code = code;
    }
}

function deny(code, message) {
    throw new DocumentCapabilityError(code, message);
}

function requireIdentifier(value, field) {
    if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) deny('UNAUTHORIZED', `${field} is invalid`);
}

export function validateTrustedOrigin(origin, trustedOrigins = DEFAULT_TRUSTED_ORIGINS) {
    if (!origin || Object.getPrototypeOf(origin) !== Object.prototype) deny('UNAUTHORIZED', 'A trusted origin is required');
    requireIdentifier(origin.kind, 'origin.kind');
    requireIdentifier(origin.capabilityId, 'origin.capabilityId');
    const allowed = trustedOrigins instanceof Set ? trustedOrigins : new Set(trustedOrigins);
    if (!allowed.has(origin.kind)) deny('UNAUTHORIZED', 'Origin is not trusted');
    return origin;
}

export function validateCapabilityIntent(capability, intent) {
    requireIdentifier(intent, 'intent');
    if (!capability || Object.getPrototypeOf(capability) !== Object.prototype || capability.revoked === true) {
        deny('UNAUTHORIZED', 'Capability is unavailable');
    }
    const intents = capability.intents;
    const permitsIntent = intents === '*' || (Array.isArray(intents) && intents.includes(intent)) || (intents instanceof Set && intents.has(intent));
    if (!permitsIntent) deny('UNAUTHORIZED', 'Capability does not permit this intent');
    return capability;
}

/**
 * Validates document identity, exact base revision, trusted origin, and intent.
 * The resolver must return the current capability record for the supplied ID.
 */
export function validateDocumentCapability(request, {
    documentId,
    currentRevision,
    resolveCapability,
    trustedOrigins = DEFAULT_TRUSTED_ORIGINS
}) {
    if (!request || Object.getPrototypeOf(request) !== Object.prototype) deny('UNAUTHORIZED', 'A plain request is required');
    requireIdentifier(documentId, 'documentId');
    if (request.documentId !== documentId) deny('UNAUTHORIZED', 'Capability belongs to another document');
    if (!Number.isSafeInteger(currentRevision) || currentRevision < 0 || request.baseRevision !== currentRevision) {
        deny('STALE_REVISION', 'Request base revision is stale');
    }
    if (typeof resolveCapability !== 'function') throw new TypeError('resolveCapability must be a function');
    const origin = validateTrustedOrigin(request.origin, trustedOrigins);
    const capability = resolveCapability(origin.capabilityId);
    validateCapabilityIntent(capability, request.intent);
    if (capability.id !== undefined && capability.id !== origin.capabilityId) deny('UNAUTHORIZED', 'Capability identity mismatch');
    if (capability.documentId !== undefined && capability.documentId !== documentId) deny('UNAUTHORIZED', 'Capability belongs to another document');
    if (capability.originKind !== undefined && capability.originKind !== origin.kind) deny('UNAUTHORIZED', 'Capability origin mismatch');
    if (capability.originKinds !== undefined && (!(capability.originKinds instanceof Set) || !capability.originKinds.has(origin.kind))) deny('UNAUTHORIZED', 'Capability origin mismatch');
    if (capability.baseRevision !== undefined && capability.baseRevision !== currentRevision) deny('STALE_REVISION', 'Capability base revision is stale');
    return capability;
}

export function createDocumentCapabilityValidator({
    documentId,
    getRevision,
    resolveCapability,
    trustedOrigins = DEFAULT_TRUSTED_ORIGINS
}) {
    requireIdentifier(documentId, 'documentId');
    if (typeof getRevision !== 'function') throw new TypeError('getRevision must be a function');
    if (typeof resolveCapability !== 'function') throw new TypeError('resolveCapability must be a function');
    const origins = new Set(trustedOrigins);
    return request => validateDocumentCapability(request, {
        documentId,
        currentRevision: getRevision(documentId),
        resolveCapability,
        trustedOrigins: origins
    });
}
