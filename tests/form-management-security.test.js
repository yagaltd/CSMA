import { describe, expect, it, vi } from 'vitest';
import { FormManagementService } from '../src/modules/form-management/services/FormManagementService.js';

class EventBus {
    constructor() {
        this.publish = vi.fn();
        this.subscribe = vi.fn(() => () => {});
    }
}

function createStorage() {
    const store = new Map();
    return {
        getItem: vi.fn((key) => store.get(key) || null),
        setItem: vi.fn((key, value) => store.set(key, value)),
        removeItem: vi.fn((key) => store.delete(key)),
        dump: () => Object.fromEntries(store)
    };
}

describe('FormManagementService security hardening', () => {
    it('defaults autosave off and redacts sensitive fields from events', () => {
        const eventBus = new EventBus();
        const storage = createStorage();
        const service = new FormManagementService(eventBus, { storage });

        const state = service.registerForm({
            formId: 'login',
            initialValues: { email: 'a@example.com', password: 'secret' },
            fieldPolicies: { password: { sensitive: true } }
        });

        service.updateField({ formId: 'login', name: 'password', value: 'new-secret', validate: false });

        expect(state.values.password).toBe('[REDACTED]');
        expect(storage.setItem).not.toHaveBeenCalled();
        expect(eventBus.publish).toHaveBeenCalledWith('FORM_FIELD_UPDATED', expect.objectContaining({
            name: 'password',
            value: '[REDACTED]'
        }));
    });

    it('rejects honeypot submissions', async () => {
        const captchaService = {
            getToken: vi.fn(() => 'captcha-token'),
            getAdapterInfo: vi.fn(() => ({ id: 'captcha.cap', provider: 'cap' }))
        };
        const service = new FormManagementService(new EventBus(), { captchaService });
        service.registerForm({
            formId: 'contact',
            initialValues: { email: 'a@example.com', website: '' },
            metadata: { captcha: { required: true } },
            fieldPolicies: { website: { honeypot: true, emit: false } }
        });
        service.updateField({ formId: 'contact', name: 'website', value: 'bot', validate: false });

        await expect(service.submitForm({ formId: 'contact' })).resolves.toEqual({
            success: false,
            errors: { honeypot: 'Submission rejected' }
        });
        expect(captchaService.getToken).not.toHaveBeenCalled();
    });

    it('rejects captcha-required forms without a token', async () => {
        const service = new FormManagementService(new EventBus(), {
            captchaService: {
                getToken: vi.fn(() => ''),
                execute: vi.fn(() => '')
            }
        });
        service.registerForm({
            formId: 'contact',
            initialValues: { email: 'a@example.com' },
            metadata: { captcha: { required: true } }
        });

        await expect(service.submitForm({ formId: 'contact' })).resolves.toEqual({
            success: false,
            errors: { captcha: 'Captcha verification is required' }
        });
    });

    it('adds captcha metadata to successful submissions', async () => {
        const eventBus = new EventBus();
        const service = new FormManagementService(eventBus, {
            captchaService: {
                getToken: vi.fn(() => 'captcha-token'),
                getAdapterInfo: vi.fn(() => ({ id: 'captcha.cap', provider: 'cap' }))
            }
        });
        service.registerForm({
            formId: 'contact',
            initialValues: { email: 'a@example.com' },
            metadata: { captcha: { required: true } }
        });

        await expect(service.submitForm({ formId: 'contact' })).resolves.toEqual({
            success: true,
            integrity: undefined,
            captcha: {
                provider: 'cap',
                adapter: 'captcha.cap',
                token: 'captcha-token'
            }
        });

        expect(eventBus.publish).toHaveBeenCalledWith('FORM_SUBMITTED', expect.objectContaining({
            captcha: {
                provider: 'cap',
                adapter: 'captcha.cap',
                token: 'captcha-token'
            }
        }));
    });

    it('fails closed for public network forms without backend integrity', async () => {
        const service = new FormManagementService(new EventBus());
        service.registerForm({
            formId: 'lead',
            initialValues: { email: 'a@example.com' },
            trustLevel: 'public-network'
        });

        await expect(service.submitForm({ formId: 'lead' })).resolves.toEqual({
            success: false,
            errors: { integrity: 'Submission integrity is required' }
        });
    });
});
