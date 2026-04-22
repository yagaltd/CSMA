import { describe, it, expect, vi, afterEach } from 'vitest';
import { CrossTabLeader } from '../src/runtime/CrossTabLeader.js';

const createMemoryStorage = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key)
    };
};

describe('CrossTabLeader', () => {
    const disposables = [];

    afterEach(() => {
        disposables.splice(0).forEach((dispose) => dispose());
    });

    it('claims leadership when navigator.locks is unavailable', async () => {
        const eventBus = { publish: vi.fn() };
        const storage = createMemoryStorage();
        const mockWindow = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            localStorage: storage
        };

        const leader = new CrossTabLeader(eventBus, {
            window: mockWindow,
            storage,
            locks: null,
            leaseDuration: 100
        });

        await leader.init();
        disposables.push(() => leader.destroy('test-cleanup'));

        expect(leader.isLeader()).toBe(true);
        expect(eventBus.publish).toHaveBeenCalledWith('LEADER_STATE_CHANGED', expect.objectContaining({ role: 'leader' }));
    });

    it('updates to follower when another tab becomes leader via storage event', async () => {
        const eventBus = { publish: vi.fn() };
        const storage = createMemoryStorage();
        const listeners = new Map();
        const mockWindow = {
            addEventListener: vi.fn((event, handler) => listeners.set(event, handler)),
            removeEventListener: vi.fn(),
            localStorage: storage
        };

        const leader = new CrossTabLeader(eventBus, {
            window: mockWindow,
            storage,
            locks: null,
            leaseDuration: 100
        });

        await leader.init();
        disposables.push(() => leader.destroy('test-cleanup'));

        const storageHandler = listeners.get('storage');
        expect(storageHandler).toBeTypeOf('function');

        storageHandler({
            key: 'csma_leader_state',
            newValue: JSON.stringify({ tabId: 'other-tab', role: 'leader', timestamp: Date.now() })
        });

        expect(eventBus.publish).toHaveBeenCalledWith('LEADER_STATE_CHANGED', expect.objectContaining({ role: 'follower' }));
        expect(leader.isLeader()).toBe(false);
    });
});
