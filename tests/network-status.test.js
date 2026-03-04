import './helpers/storage-polyfill.js';
import { describe, it, expect } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { NetworkStatusService } from '../src/modules/network-status/services/NetworkStatusService.js';

describe('NetworkStatusService', () => {
    it('publishes status changes when manual status updates occur', () => {
        const eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        const events = [];
        eventBus.subscribe('NETWORK_STATUS_CHANGED', (payload) => events.push(payload));

        const service = new NetworkStatusService(eventBus, { sampleInterval: 0 });
        service.init();
        service.setStatus(false, 'test-offline');
        service.setStatus(true, 'test-online', 42);

        expect(events).toHaveLength(3); // init + two manual updates
        expect(events.at(-1).latency).toBe(42);
        service.destroy();
    });
});
