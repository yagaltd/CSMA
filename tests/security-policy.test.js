import { describe, expect, it } from 'vitest';
import { assertProductionSecurityPolicy, resolveSecurityPolicy } from '../src/runtime/SecurityPolicy.js';

describe('SecurityPolicy', () => {
    it('defaults to production and keeps internals hidden', () => {
        const policy = resolveSecurityPolicy({});

        expect(policy.profile).toBe('production');
        expect(policy.globals.exposeInternals).toBe(false);
        expect(policy.forms.autoSave).toBe(false);
    });

    it('requires explicit development profile for relaxed defaults', () => {
        const policy = resolveSecurityPolicy({ securityProfile: 'development' });

        expect(policy.profile).toBe('development');
        expect(policy.globals.exposeInternals).toBe(true);
        expect(policy.forms.autoSave).toBe(true);
    });

    it('rejects insecure production auth and cross-origin SSMA config', () => {
        expect(() => assertProductionSecurityPolicy(resolveSecurityPolicy({}), {
            auth: { storage: { accessToken: 'localStorage' } }
        })).toThrow(/access-token/);

        expect(() => assertProductionSecurityPolicy(resolveSecurityPolicy({}), {
            ssma: { baseUrl: 'https://ssma.example.com' }
        })).toThrow(/cross-origin SSMA/);
    });
});
