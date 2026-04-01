import './helpers/storage-polyfill.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConsentService } from '../src/modules/analytics/consent/ConsentService.js';

describe('ConsentService', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('persists scope preferences across instances', () => {
        const service = new ConsentService();
        service.setConsent('ui_analytics', false);
        service.setConsent('performance', true);

        const reloaded = new ConsentService();
        expect(reloaded.getConsent('ui_analytics')).toBe(false);
        expect(reloaded.getConsent('performance')).toBe(true);
    });

    it('clears telemetry data and tracks acknowledgment', () => {
        const service = new ConsentService();
        localStorage.setItem('analytics', JSON.stringify([{ event: 'x' }]));

        service.acknowledge();
        service.clearTelemetry();

        expect(service.wasAcknowledged()).toBe(true);
        expect(localStorage.getItem('analytics')).toBeNull();
    });

    it('acceptAll enables every scope', () => {
        const service = new ConsentService();
        service.acceptAll();
        expect(Object.values(service.getAllScopes()).every(Boolean)).toBe(true);
        expect(service.wasAcknowledged()).toBe(true);
    });
});
