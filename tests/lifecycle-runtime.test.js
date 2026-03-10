import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import EventBus from '../src/runtime/EventBus.js';
import { LifecycleScope } from '../src/runtime/LifecycleScope.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { ChannelManager } from '../src/runtime/ChannelManager.js';
import IslandRuntime from '../src/modules/static-render/runtime/IslandRuntime.js';

describe('LifecycleScope', () => {
    it('removes DOM listeners and EventBus subscriptions on destroy', async () => {
        const dom = new JSDOM('<!doctype html><html><body><button id="a"></button></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;

        const scope = new LifecycleScope('test-scope');
        const eventBus = new EventBus();
        const domHandler = vi.fn();
        const busHandler = vi.fn();

        scope.listen(document.getElementById('a'), 'click', domHandler);
        scope.subscribe(eventBus, 'PING', busHandler);

        document.getElementById('a').click();
        await eventBus.publish('PING', { ok: true });
        expect(domHandler).toHaveBeenCalledTimes(1);
        expect(busHandler).toHaveBeenCalledTimes(1);

        scope.destroy();
        document.getElementById('a').click();
        await eventBus.publish('PING', { ok: true });

        expect(domHandler).toHaveBeenCalledTimes(1);
        expect(busHandler).toHaveBeenCalledTimes(1);
        expect(eventBus.listeners.get('PING')).toHaveLength(0);
    });
});

describe('ServiceManager lifecycle', () => {
    it('injects EventBus and destroys services in reverse registration order', async () => {
        const eventBus = new EventBus();
        const manager = new ServiceManager(eventBus);
        const order = [];

        const serviceA = {
            setEventBus: vi.fn(),
            destroy: vi.fn(() => order.push('a'))
        };
        const serviceB = {
            setEventBus: vi.fn(),
            cleanup: vi.fn(() => order.push('b'))
        };

        manager.register('a', serviceA);
        manager.register('b', serviceB);
        await manager.destroyAll();

        expect(serviceA.setEventBus).toHaveBeenCalledWith(eventBus);
        expect(serviceB.setEventBus).toHaveBeenCalledWith(eventBus);
        expect(order).toEqual(['b', 'a']);
        expect(manager.getAllStatus()).toHaveLength(0);
    });
});

describe('ChannelManager lifecycle', () => {
    it('tears down active subscriptions on destroy', () => {
        const eventBus = { publish: vi.fn() };
        const manager = new ChannelManager(eventBus);
        const unload = vi.fn();
        manager.registerChannel('todos', {
            load: () => vi.fn(),
            unload
        });

        manager.subscribe('todos', { filter: 'open' });
        expect(manager.listSubscriptions()).toHaveLength(1);

        manager.destroy();

        expect(manager.listSubscriptions()).toHaveLength(0);
        expect(manager.listChannels()).toHaveLength(0);
        expect(unload).toHaveBeenCalledTimes(1);
    });
});

describe('IslandRuntime lifecycle', () => {
    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.sessionStorage = dom.window.sessionStorage;
        global.localStorage = dom.window.localStorage;
        window.csma = { config: { staticRender: {} } };
        global.IntersectionObserver = class {
            constructor(cb) {
                this.cb = cb;
            }
            observe() {
                this.cb([{ isIntersecting: true }]);
            }
            disconnect() {}
        };
    });

    it('removes EventBus subscriptions on destroy', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = {};
        document.body.innerHTML = '<div data-island="product-inventory"></div>';
        const runtime = new IslandRuntime(eventBus, {
            fetchImpl: () => Promise.resolve({
                ok: true,
                json: async () => ({
                    routes: {
                        '/products': {
                            islands: [{ id: 'product-inventory', trigger: 'manual' }]
                        }
                    }
                })
            })
        });

        await runtime.init();
        expect(eventBus.listeners.get('ISLAND_INVALIDATED')?.length || 0).toBeGreaterThan(0);
        expect(eventBus.listeners.get('ISLAND_DATA_RETURNED')?.length || 0).toBeGreaterThan(0);

        runtime.destroy();

        expect(eventBus.listeners.get('ISLAND_INVALIDATED') || []).toHaveLength(0);
        expect(eventBus.listeners.get('ISLAND_DATA_RETURNED') || []).toHaveLength(0);
    });
});
