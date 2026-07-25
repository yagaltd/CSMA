import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { HistoryService } from '../../src/modules/history/services/HistoryService.js';

/**
 * BroadcastSync — multi-tab cross-instance sync via BroadcastChannel.
 * jsdom doesn't ship BroadcastChannel; we mock the global with an
 * in-process bus shared between instances.
 */
describe('HistoryService broadcast', () => {
    let originalBC;
    let channels;

    beforeEach(() => {
        originalBC = globalThis.BroadcastChannel;
        channels = new Map(); // channelName -> Set of BroadcastChannel instances
        globalThis.BroadcastChannel = class MockBroadcastChannel {
            constructor(name) {
                this.name = name;
                this.listeners = new Set();
                if (!channels.has(name)) channels.set(name, new Set());
                channels.get(name).add(this);
            }
            addEventListener(type, listener) {
                if (type === 'message') this.listeners.add(listener);
            }
            removeEventListener(type, listener) {
                this.listeners.delete(listener);
            }
            postMessage(data) {
                const peers = channels.get(this.name);
                if (!peers) return;
                for (const peer of peers) {
                    if (peer === this) continue;
                    for (const listener of peer.listeners) {
                        listener({ data });
                    }
                }
            }
            close() {
                channels.get(this.name)?.delete(this);
            }
        };
    });

    afterEach(() => {
        globalThis.BroadcastChannel = originalBC;
    });

    it('two HistoryService instances sync via BroadcastChannel', async () => {
        const eventBus1 = new EventBus();
        const eventBus2 = new EventBus();
        const h1 = new HistoryService(eventBus1);
        const h2 = new HistoryService(eventBus2);

        // Both target the same logical store name so the broadcast channel matches.
        await h1.init({ broadcast: true, broadcastChannel: 'shared-test', broadcast: true });
        await h2.init({ broadcast: true, broadcastChannel: 'shared-test' });

        // H1 records an entry → H2 should reload and see it.
        // (Both use the memory backend; they don't share an IDB store. To simulate
        // shared persistence, we share the same store instance.)
        // For this test we only verify the broadcast reaches the peer; the actual
        // reload-from-store path is exercised in integration tests.
        const h2ReloadSpy = vi.spyOn(h2, '_reloadFromStore');

        h1.record('op:broadcast', {});

        // BroadcastChannel messages are synchronous in our mock.
        expect(h2ReloadSpy).toHaveBeenCalled();

        h1.destroy();
        h2.destroy();
    });

    it('disables broadcast when broadcast:false', async () => {
        const eventBus = new EventBus();
        const history = new HistoryService(eventBus);
        await history.init({ broadcast: false });
        expect(history.broadcastSync).toBeNull();
        history.destroy();
    });
});
