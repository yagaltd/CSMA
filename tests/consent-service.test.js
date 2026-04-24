import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsentService } from '../src/modules/consent/services/ConsentService.js';
import { Contracts } from '../src/runtime/Contracts.js';

function createEventBus() {
    const handlers = new Map();
    return {
        publish: vi.fn(),
        subscribe: vi.fn((eventName, handler) => {
            if (!handlers.has(eventName)) {
                handlers.set(eventName, new Set());
            }
            handlers.get(eventName).add(handler);
            return () => handlers.get(eventName)?.delete(handler);
        }),
        emit(eventName, payload) {
            handlers.get(eventName)?.forEach((handler) => handler(payload));
        }
    };
}

describe('ConsentService', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to essential-only opt-in state', () => {
        const service = new ConsentService(createEventBus()).init();

        expect(service.wasAcknowledged()).toBe(false);
        expect(service.hasConsent('essential')).toBe(true);
        expect(service.hasConsent('analytics')).toBe(false);
        expect(service.hasConsent('performance')).toBe(false);
        expect(service.hasConsent('marketing')).toBe(false);
    });

    it('keeps essential locked even when setConsent tries to disable it', () => {
        const service = new ConsentService(createEventBus()).init();

        service.setConsent('essential', false);

        expect(service.hasConsent('essential')).toBe(true);
        expect(service.getAllCategories().essential).toBe(true);
    });

    it('accepts all and rejects optional categories', () => {
        const service = new ConsentService(createEventBus()).init();

        service.acceptAll('test');
        expect(service.wasAcknowledged()).toBe(true);
        expect(service.hasConsent('analytics')).toBe(true);
        expect(service.hasConsent('marketing')).toBe(true);

        service.rejectOptional('test');
        expect(service.wasAcknowledged()).toBe(true);
        expect(service.hasConsent('essential')).toBe(true);
        expect(service.hasConsent('analytics')).toBe(false);
        expect(service.hasConsent('marketing')).toBe(false);
    });

    it('maps legacy analytics scopes to generic categories', () => {
        const service = new ConsentService(createEventBus()).init();

        service.setConsent('ui_analytics', true);
        service.setConsent('performance', true);

        expect(service.hasConsent('analytics')).toBe(true);
        expect(service.getConsent('ui_analytics')).toBe(true);
        expect(service.getAllScopes()).toEqual({
            ui_analytics: true,
            performance: true,
            error_tracking: true,
            security: true
        });
    });

    it('migrates old analytics consent storage to the new key', () => {
        localStorage.setItem('csma.analyticsConsent.v1', JSON.stringify({
            acknowledged: true,
            scopes: {
                ui_analytics: true,
                performance: false,
                error_tracking: true,
                security: true
            },
            updatedAt: 123
        }));

        const service = new ConsentService(createEventBus()).init();

        expect(service.wasAcknowledged()).toBe(true);
        expect(service.hasConsent('analytics')).toBe(true);
        expect(service.hasConsent('performance')).toBe(true);
        expect(JSON.parse(localStorage.getItem('csma.consent.v1')).migratedFrom).toBe('csma.analyticsConsent.v1');
    });

    it('falls back to defaults for corrupt storage', () => {
        localStorage.setItem('csma.consent.v1', '{bad json');

        const service = new ConsentService(createEventBus()).init();

        expect(service.hasConsent('essential')).toBe(true);
        expect(service.hasConsent('analytics')).toBe(false);
    });

    it('publishes contract-valid update events', () => {
        const eventBus = createEventBus();
        const service = new ConsentService(eventBus).init();

        service.setConsent('analytics', true, 'test');

        const [eventName, payload] = eventBus.publish.mock.calls.find(([name]) => name === 'CONSENT_UPDATED');
        const [error] = Contracts[eventName].schema.validate(payload);
        expect(error).toBeUndefined();
    });

    it('handles consent intents from the EventBus', () => {
        const eventBus = createEventBus();
        const service = new ConsentService(eventBus).init();

        eventBus.emit('INTENT_CONSENT_ACCEPT_ALL', { source: 'test', timestamp: Date.now() });

        expect(service.hasConsent('analytics')).toBe(true);
        expect(service.hasConsent('marketing')).toBe(true);
    });
});
