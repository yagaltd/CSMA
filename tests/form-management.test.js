import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { FormManagementService } from '../src/modules/form-management/services/FormManagementService.js';

describe('FormManagementService', () => {
    let eventBus;
    let storage;
    let service;

    beforeEach(() => {
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        storage = {
            data: new Map(),
            getItem: vi.fn(function (key) {
                return this.data.get(key) || null;
            }),
            setItem: vi.fn(function (key, value) {
                this.data.set(key, value);
            }),
            removeItem: vi.fn(function (key) {
                this.data.delete(key);
            })
        };
        service = new FormManagementService(eventBus, { storage, autoSaveDelay: 0 });
        service.init({ storageService: storage });
    });

    it('tracks field updates and emits validity changes', () => {
        const updates = [];
        eventBus.subscribe('FORM_FIELD_UPDATED', (payload) => updates.push(payload));

        service.registerForm({
            formId: 'profile',
            schema: (values) => (values.name ? {} : { name: 'Name required' }),
            initialValues: { name: '' }
        });

        service.updateField({ formId: 'profile', name: 'name', value: '' });
        expect(updates.at(-1).valid).toBe(false);

        service.updateField({ formId: 'profile', name: 'name', value: 'Ada' });
        expect(updates.at(-1).valid).toBe(true);
        expect(storage.setItem).toHaveBeenCalled();
    });

    it('blocks submission and emits errors when validation fails', async () => {
        const errors = [];
        eventBus.subscribe('FORM_ERROR', (payload) => errors.push(payload));

        service.registerForm({
            formId: 'contact',
            schema: (values) => (values.email ? {} : { email: 'Email required' }),
            initialValues: { email: '' }
        });

        const result = await service.submitForm({ formId: 'contact' });
        expect(result.success).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].errors.email).toBe('Email required');
    });

    it('enqueues submissions when queue strategy is used', async () => {
        const enqueue = vi.fn();
        const queueService = { enqueue };

        service.destroy();
        service = new FormManagementService(eventBus, { storage, autoSaveDelay: 0 });
        service.init({ storageService: storage, syncQueueService: queueService });

        service.registerForm({
            formId: 'order',
            schema: () => ({}),
            initialValues: { item: 'A' }
        });

        await service.submitForm({ formId: 'order', strategy: 'queue' });
        expect(enqueue).toHaveBeenCalledTimes(1);
        expect(enqueue.mock.calls[0][0].payload.formId).toBe('order');
    });

    it('signs payloads when integrity is required and hmac service is available', async () => {
        const hmacEnvelope = { intent: 'FORM_SUBMIT_SECURE', nonce: 'n', signature: 'sig', timestamp: Date.now(), expiresAt: Date.now() + 1000 };
        const hmacService = {
            signPayload: vi.fn().mockResolvedValue(hmacEnvelope)
        };

        service.destroy();
        service = new FormManagementService(eventBus, { storage, autoSaveDelay: 0, hmacService });
        service.init({ storageService: storage, hmacService });

        service.registerForm({
            formId: 'secureForm',
            schema: () => ({}),
            initialValues: { message: 'Hello' },
            metadata: { integrity: { require: true, intent: 'SECURE_INTENT' } }
        });

        const result = await service.submitForm({ formId: 'secureForm' });
        expect(result.integrity).toBeDefined();
        expect(hmacService.signPayload).toHaveBeenCalledWith({
            intent: 'SECURE_INTENT',
            payload: { message: 'Hello' },
            nonce: undefined
        });
    });
});
