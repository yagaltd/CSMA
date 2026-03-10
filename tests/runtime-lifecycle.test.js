import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LifecycleScope } from '../src/runtime/LifecycleScope.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { ModuleManager } from '../src/runtime/ModuleManager.js';
import { MetaManager } from '../src/runtime/MetaManager.js';
import { Router } from '../src/modules/router/services/Router.js';
import { ChannelManager } from '../src/runtime/ChannelManager.js';

class StubEventBus {
    constructor() {
        this.listeners = new Map();
        this.publish = vi.fn();
    }

    subscribe(eventName, handler) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        const handlers = this.listeners.get(eventName);
        handlers.add(handler);
        return () => handlers.delete(handler);
    }

    listenerCount(eventName) {
        return this.listeners.get(eventName)?.size || 0;
    }
}

describe('LifecycleScope', () => {
    it('tears down listeners, subscriptions, timers, and observers exactly once', () => {
        const scope = new LifecycleScope('test-scope');
        const target = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };
        const eventBus = new StubEventBus();
        const observer = { disconnect: vi.fn() };
        const unsubscribeSpy = vi.fn();
        const handler = () => {};
        const originalSetInterval = globalThis.setInterval;
        const originalClearInterval = globalThis.clearInterval;

        globalThis.setInterval = vi.fn(() => 123);
        globalThis.clearInterval = vi.fn();
        scope.listen(target, 'click', handler);
        scope.add(unsubscribeSpy);
        scope.subscribe(eventBus, 'READY', handler);
        scope.interval(setInterval(() => {}, 10));
        scope.observer(observer);

        scope.destroy();
        scope.destroy();

        expect(target.addEventListener).toHaveBeenCalledWith('click', handler, undefined);
        expect(target.removeEventListener).toHaveBeenCalledWith('click', handler, undefined);
        expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
        expect(eventBus.listenerCount('READY')).toBe(0);
        expect(globalThis.clearInterval).toHaveBeenCalledWith(123);
        expect(observer.disconnect).toHaveBeenCalledTimes(1);

        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
    });
});

describe('ServiceManager lifecycle', () => {
    it('unregisters and destroys services in reverse registration order', async () => {
        const manager = new ServiceManager(new StubEventBus());
        const destroyCalls = [];

        manager.register('alpha', {
            destroy: vi.fn(async () => destroyCalls.push('alpha'))
        });
        manager.register('beta', {
            cleanup: vi.fn(async () => destroyCalls.push('beta'))
        });

        await manager.destroyAll();

        expect(destroyCalls).toEqual(['beta', 'alpha']);
        expect(manager.getAllStatus()).toHaveLength(0);
    });
});

describe('ModuleManager lifecycle', () => {
    it('unloads module-owned services via the service manager', async () => {
        const unregister = vi.fn(async () => true);
        const manager = new ModuleManager(new StubEventBus(), { unregister });

        manager.modules.set('demo', {
            manifest: { name: 'Demo' },
            status: 'loaded',
            serviceNames: ['one', 'two']
        });

        await manager.unloadModule('demo');

        expect(unregister).toHaveBeenNthCalledWith(1, 'two');
        expect(unregister).toHaveBeenNthCalledWith(2, 'one');
        expect(manager.isModuleLoaded('demo')).toBe(false);
    });
});

describe('MetaManager lifecycle', () => {
    it('removes PAGE_CHANGED subscription on destroy', () => {
        const eventBus = new StubEventBus();
        const manager = new MetaManager(eventBus);

        expect(eventBus.listenerCount('PAGE_CHANGED')).toBe(1);

        manager.destroy();

        expect(eventBus.listenerCount('PAGE_CHANGED')).toBe(0);
    });
});

describe('Router lifecycle', () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
        globalThis.window = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            location: { hash: '' },
            history: { replaceState: vi.fn(), back: vi.fn() }
        };
    });

    afterEach(() => {
        globalThis.window = originalWindow;
    });

    it('removes global routing listeners on destroy', () => {
        const router = new Router(new StubEventBus());

        expect(window.addEventListener).toHaveBeenCalledTimes(2);

        router.destroy();

        expect(window.removeEventListener).toHaveBeenCalledTimes(2);
    });
});

describe('ChannelManager lifecycle', () => {
    it('tears down active subscriptions on destroy', () => {
        const eventBus = new StubEventBus();
        const manager = new ChannelManager(eventBus);
        const cleanup = vi.fn();

        manager.registerChannel('todos', {
            load: vi.fn(() => cleanup)
        });
        manager.subscribe('todos', { status: 'open' });

        manager.destroy();

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(manager.listSubscriptions()).toHaveLength(0);
    });
});
