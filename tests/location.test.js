import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { LocationService } from '../src/modules/location/services/LocationService.js';

describe('LocationService', () => {
    let events;
    let eventBus;
    let geo;

    beforeEach(() => {
        events = [];
        eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        eventBus.subscribe('LOCATION_UPDATED', (payload) => events.push(payload));

        let watchCallback;
        geo = {
            watchPosition: vi.fn((success) => {
                watchCallback = success;
                return 1;
            }),
            clearWatch: vi.fn()
        };

        geo.__emit = (coords) => {
            watchCallback({
                coords,
                timestamp: Date.now()
            });
        };

        const service = new LocationService(eventBus, { geoProvider: geo, enablePersistence: false });
        service.init();
        service.startTracking({});
        geo.__emit({ latitude: 40, longitude: -73, accuracy: 5 });
    });

    it('publishes LOCATION_UPDATED events', () => {
        expect(events).toHaveLength(1);
        expect(events[0].latitude).toBe(40);
    });
});
