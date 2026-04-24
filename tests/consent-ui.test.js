// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsentService } from '../src/modules/consent/services/ConsentService.js';
import { initConsentUI } from '../src/modules/consent/ui/consent-ui.js';

function createEventBus() {
    return {
        publish: vi.fn(),
        subscribe: vi.fn(() => () => {})
    };
}

describe('consent UI', () => {
    let service;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<button type="button" data-consent-open>Privacy</button><p data-consent-status></p>';
        service = new ConsentService(createEventBus()).init();
    });

    it('shows the banner until consent is acknowledged', () => {
        const cleanup = initConsentUI(service, document);

        expect(document.querySelector('[data-consent-banner]').dataset.open).toBe('true');

        cleanup();
    });

    it('opens the modal from customize and keeps essential locked', () => {
        const cleanup = initConsentUI(service, document);

        document.querySelector('[data-consent-action="customize"]').click();

        expect(document.querySelector('[data-consent-modal]').dataset.open).toBe('true');
        expect(document.querySelector('[data-consent-toggle="essential"]').disabled).toBe(true);

        cleanup();
    });

    it('saves granular preferences', () => {
        const cleanup = initConsentUI(service, document);

        document.querySelector('[data-consent-action="customize"]').click();
        document.querySelector('[data-consent-toggle="analytics"]').checked = true;
        document.querySelector('[data-consent-action="save"]').click();

        expect(service.wasAcknowledged()).toBe(true);
        expect(service.hasConsent('analytics')).toBe(true);
        expect(document.querySelector('[data-consent-banner]').dataset.open).toBe('false');

        cleanup();
    });

    it('accepts all and rejects optional categories from banner actions', () => {
        const cleanup = initConsentUI(service, document);

        document.querySelector('[data-consent-action="accept-all"]').click();
        expect(service.hasConsent('analytics')).toBe(true);
        expect(service.hasConsent('marketing')).toBe(true);

        service.reset('test');
        document.querySelector('[data-consent-action="reject-optional"]').click();
        expect(service.hasConsent('essential')).toBe(true);
        expect(service.hasConsent('analytics')).toBe(false);

        cleanup();
    });

    it('cleanup removes generated consent surfaces', () => {
        const cleanup = initConsentUI(service, document);

        cleanup();

        expect(document.querySelector('[data-consent-banner]')).toBeNull();
        expect(document.querySelector('[data-consent-modal]')).toBeNull();
    });
});
