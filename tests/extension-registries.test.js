import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { ModuleManager } from '../src/runtime/ModuleManager.js';
import { CommandRegistry } from '../src/runtime/CommandRegistry.js';
import { RouteRegistry } from '../src/runtime/RouteRegistry.js';
import { NavigationRegistry } from '../src/runtime/NavigationRegistry.js';
import { PanelRegistry } from '../src/runtime/PanelRegistry.js';
import { AdapterRegistry } from '../src/runtime/AdapterRegistry.js';
import { validateModuleDefinition } from '../src/runtime/ModuleManifest.js';

function createRuntime() {
    const eventBus = new EventBus();
    eventBus.contracts = Contracts;
    const serviceManager = new ServiceManager(eventBus);
    const registries = {
        commands: new CommandRegistry({ eventBus, serviceManager }),
        routes: new RouteRegistry({ eventBus }),
        navigation: new NavigationRegistry({ eventBus }),
        panels: new PanelRegistry({ eventBus }),
        adapters: new AdapterRegistry({ eventBus, serviceManager })
    };
    const moduleManager = new ModuleManager(eventBus, serviceManager, registries);

    return { eventBus, serviceManager, registries, moduleManager };
}

describe('Module manifest validation', () => {
    it('accepts the canonical example-module shape', async () => {
        const moduleDefinition = await import('../src/modules/example-module/index.js');
        const validated = validateModuleDefinition('example-module', moduleDefinition);

        expect(validated.manifest.id).toBe('example-module');
        expect(validated.manifest.services).toEqual(['ExampleModuleService']);
        expect(validated.manifest.contributes.commands).toHaveLength(1);
    });

    it('rejects manifests that omit documented services', () => {
        expect(() => validateModuleDefinition('demo', {
            manifest: {
                id: 'demo',
                name: 'Demo',
                version: '1.0.0',
                description: 'Bad manifest',
                dependencies: [],
                services: [],
                contracts: []
            },
            services: {
                demoService: class DemoService {}
            }
        })).toThrow(/manifest\.services is missing declared services/i);
    });
});

describe('Contribution registries', () => {
    let runtime;

    beforeEach(() => {
        runtime = createRuntime();
    });

    it('loads example-module contributions and removes them on unload', async () => {
        const loadedEvents = [];
        runtime.eventBus.subscribe('MODULE_LOADED', (payload) => loadedEvents.push(payload));

        await runtime.moduleManager.loadModule('example-module');

        expect(runtime.serviceManager.get('ExampleModuleService')).toBeTruthy();
        expect(runtime.registries.commands.get('example-module.say-hello')).toBeTruthy();
        expect(runtime.registries.routes.get('example-module.dashboard')).toBeTruthy();
        expect(runtime.registries.navigation.get('example-module.nav')).toBeTruthy();
        expect(runtime.registries.panels.get('example-module.panel')).toBeTruthy();
        expect(runtime.registries.adapters.get('example-module.adapter')).toBeTruthy();
        expect(loadedEvents).toHaveLength(1);
        expect(loadedEvents[0].contributions.commands).toBe(1);

        await runtime.moduleManager.unloadModule('example-module');

        expect(runtime.serviceManager.get('ExampleModuleService')).toBeNull();
        expect(runtime.registries.commands.list()).toHaveLength(0);
        expect(runtime.registries.routes.list()).toHaveLength(0);
        expect(runtime.registries.navigation.list()).toHaveLength(0);
        expect(runtime.registries.panels.list()).toHaveLength(0);
        expect(runtime.registries.adapters.list()).toHaveLength(0);
    });

    it('executes command contributions through the owning service', async () => {
        const commandEvents = [];
        const exampleEvents = [];

        runtime.eventBus.subscribe('COMMAND_EXECUTED', (payload) => commandEvents.push(payload));
        runtime.eventBus.subscribe('EXAMPLE_MODULE_EVENT', (payload) => exampleEvents.push(payload));

        await runtime.moduleManager.loadModule('example-module');

        const result = await runtime.registries.commands.execute('example-module.say-hello', {
            message: 'Hello registry'
        });

        expect(result).toEqual({ ok: true, message: 'Hello registry' });
        expect(commandEvents).toHaveLength(1);
        expect(commandEvents[0].commandId).toBe('example-module.say-hello');
        expect(exampleEvents).toHaveLength(1);
        expect(exampleEvents[0].message).toBe('Hello registry');
    });

    it('attaches contributed routes to the router and unregisters them on unload', async () => {
        const router = {
            register: vi.fn(),
            unregister: vi.fn()
        };
        const routeRequests = [];

        runtime.registries.routes.attachRouter(router);
        runtime.eventBus.subscribe('ROUTE_CONTRIBUTION_REQUESTED', (payload) => routeRequests.push(payload));

        await runtime.moduleManager.loadModule('example-module');

        expect(router.register).toHaveBeenCalledWith(
            '/example-module',
            expect.any(Function),
            expect.objectContaining({
                meta: expect.objectContaining({
                    routeId: 'example-module.dashboard',
                    moduleId: 'example-module'
                })
            })
        );

        const routeHandler = router.register.mock.calls[0][1];
        await routeHandler();
        expect(routeRequests).toHaveLength(1);
        expect(routeRequests[0].routeId).toBe('example-module.dashboard');

        await runtime.moduleManager.unloadModule('example-module');

        expect(router.unregister).toHaveBeenCalledWith('/example-module');
    });

    it('sorts navigation entries by order and label', () => {
        runtime.registries.navigation.register('module-b', {
            id: 'module-b.nav',
            label: 'Beta',
            href: '#/beta',
            order: 20
        });
        runtime.registries.navigation.register('module-a', {
            id: 'module-a.nav',
            label: 'Alpha',
            href: '#/alpha',
            order: 10
        });

        expect(runtime.registries.navigation.list().map((entry) => entry.id)).toEqual([
            'module-a.nav',
            'module-b.nav'
        ]);
    });

    it('resolves adapter services by type', () => {
        const adapterService = { send: vi.fn() };
        runtime.serviceManager.register('demoAdapterService', adapterService);
        runtime.registries.adapters.register('demo-module', {
            id: 'demo.adapter',
            type: 'gateway',
            serviceName: 'demoAdapterService',
            capabilities: ['realtime']
        });

        expect(runtime.registries.adapters.resolve('gateway')).toBe(adapterService);
        expect(runtime.registries.adapters.listByType('gateway')).toHaveLength(1);
    });
});
