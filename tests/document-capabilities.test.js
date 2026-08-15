/**
 * CSMA DocumentCapabilities Tests
 *
 * Happy-path coverage for the document-capability gate used by runtime
 * surfaces (see src/runtime/DocumentCapabilities.js). Coverage is direct:
 * this suite exercises the validator contract itself.
 */
import { describe, it, expect } from 'vitest';
import {
    createDocumentCapabilityValidator,
    validateCapabilityIntent,
    validateDocumentCapability,
    validateTrustedOrigin
} from '../src/runtime/DocumentCapabilities.js';

const TRUSTED_KINDS = ['agent', 'component', 'worker', 'system'];

const VALID_ORIGIN = { kind: 'agent', capabilityId: 'cap-1' };
const VALID_REQUEST = {
    documentId: 'doc-1',
    baseRevision: 4,
    intent: 'agent.transform',
    origin: VALID_ORIGIN
};
const VALID_CAPABILITY = {
    id: 'cap-1',
    documentId: 'doc-1',
    originKind: 'agent',
    intents: ['agent.transform'],
    baseRevision: 4,
    revoked: false
};

describe('validateTrustedOrigin', () => {
    it('accepts a trusted origin with valid identifiers', () => {
        const origin = { kind: 'worker', capabilityId: 'cap-worker' };
        expect(validateTrustedOrigin(origin)).toBe(origin);
        expect(validateTrustedOrigin(origin, new Set(['worker']))).toBe(origin);
    });
});

describe('validateCapabilityIntent', () => {
    it('permits an intent listed in the capability intents array', () => {
        expect(validateCapabilityIntent(VALID_CAPABILITY, 'agent.transform')).toBe(VALID_CAPABILITY);
    });

    it('permits any intent for wildcard intents', () => {
        expect(validateCapabilityIntent({ intents: '*' }, 'anything.at.all')).toEqual({ intents: '*' });
    });

    it('permits an intent held in a Set', () => {
        expect(validateCapabilityIntent({ intents: new Set(['a.b']) }, 'a.b')).toEqual({ intents: new Set(['a.b']) });
    });
});

describe('validateDocumentCapability', () => {
    it('resolves and returns the capability for a valid request', () => {
        const capability = validateDocumentCapability(VALID_REQUEST, {
            documentId: 'doc-1',
            currentRevision: 4,
            resolveCapability: () => VALID_CAPABILITY,
            trustedOrigins: TRUSTED_KINDS
        });
        expect(capability).toBe(VALID_CAPABILITY);
    });
});

describe('createDocumentCapabilityValidator', () => {
    it('returns a validator that accepts a matching request at the current revision', () => {
        let revision = 4;
        const validate = createDocumentCapabilityValidator({
            documentId: 'doc-1',
            getRevision: () => revision,
            resolveCapability: (id) => (id === 'cap-1' ? { ...VALID_CAPABILITY, baseRevision: revision } : undefined),
            trustedOrigins: TRUSTED_KINDS
        });

        expect(validate(VALID_REQUEST)).toStrictEqual(VALID_CAPABILITY);

        // Validator tracks the live revision via getRevision.
        revision = 5;
        const requestAtNewRevision = { ...VALID_REQUEST, baseRevision: 5 };
        expect(validate(requestAtNewRevision)).toMatchObject({ id: 'cap-1', baseRevision: 5 });
    });
});
