import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { ModuleManager } from '../src/runtime/ModuleManager.js';
import { CommandRegistry } from '../src/runtime/CommandRegistry.js';
import { NavigationRegistry } from '../src/runtime/NavigationRegistry.js';
import { PanelRegistry } from '../src/runtime/PanelRegistry.js';
import { AdapterRegistry } from '../src/runtime/AdapterRegistry.js';
import { ViewRegistry } from '../src/runtime/ViewRegistry.js';
import { validateModuleDefinition } from '../src/runtime/ModuleManifest.js';

function createRuntime() {
    const eventBus = new EventBus();
    eventBus.contracts = Contracts;
    const serviceManager = new ServiceManager(eventBus);
    const registries = {
        commands: new CommandRegistry({ eventBus, serviceManager }),
        navigation: new NavigationRegistry({ eventBus }),
        panels: new PanelRegistry({ eventBus }),
        adapters: new AdapterRegistry({ eventBus, serviceManager }),
        views: new ViewRegistry({ eventBus, serviceManager })
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
        expect(validated.manifest.contributes.navigation).toHaveLength(1);
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

    it('rejects manifests that still declare contributed routes', () => {
        expect(() => validateModuleDefinition('demo', {
            manifest: {
                id: 'demo',
                name: 'Demo',
                version: '1.0.0',
                description: 'Bad manifest',
                dependencies: [],
                services: [],
                contracts: [],
                contributes: {
                    routes: [{ id: 'demo.route', path: '/demo', page: 'demo' }]
                }
            },
            services: {}
        })).toThrow(/Unknown contribution types: routes/i);
    });

    it('preserves module-scoped aiUi component declarations', () => {
        const validated = validateModuleDefinition('demo', {
            manifest: {
                id: 'demo',
                name: 'Demo',
                version: '1.0.0',
                description: 'Manifest with AI UI components',
                dependencies: [],
                services: [],
                contracts: [],
                aiUi: {
                    components: [
                        {
                            id: 'demo.panel',
                            alias: 'panel',
                            title: 'Demo Panel',
                            category: 'Demo',
                            propsSchema: {},
                            slots: {},
                            allowedChildren: [],
                            render: {
                                kind: 'element',
                                tag: 'section',
                                className: 'demo-panel'
                            }
                        }
                    ]
                }
            },
            services: {}
        });

        expect(validated.manifest.aiUi.components).toHaveLength(1);
        expect(validated.manifest.aiUi.components[0].id).toBe('demo.panel');
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
        expect(runtime.registries.navigation.get('example-module.nav')).toBeTruthy();
        expect(runtime.registries.panels.get('example-module.panel')).toBeTruthy();
        expect(runtime.registries.adapters.get('example-module.adapter')).toBeTruthy();
        expect(runtime.registries.views.get('example-module.status-card')).toBeTruthy();
        expect(loadedEvents).toHaveLength(1);
        expect(loadedEvents[0].contributions.commands).toBe(1);

        await runtime.moduleManager.unloadModule('example-module');

        expect(runtime.serviceManager.get('ExampleModuleService')).toBeNull();
        expect(runtime.registries.commands.list()).toHaveLength(0);
        expect(runtime.registries.navigation.list()).toHaveLength(0);
        expect(runtime.registries.panels.list()).toHaveLength(0);
        expect(runtime.registries.adapters.list()).toHaveLength(0);
        expect(runtime.registries.views.list()).toHaveLength(0);
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

    it('executes commands through INTENT_COMMAND_EXECUTE using the runtime registry as the canonical path', async () => {
        const commandEvents = [];
        runtime.eventBus.subscribe('COMMAND_EXECUTED', (payload) => commandEvents.push(payload));

        await runtime.moduleManager.loadModule('example-module');

        await runtime.eventBus.publish('INTENT_COMMAND_EXECUTE', {
            commandId: 'example-module.say-hello',
            payload: { message: 'Hello intent' },
            source: 'ui',
            timestamp: Date.now()
        });

        expect(commandEvents).toHaveLength(1);
        expect(commandEvents[0]).toMatchObject({
            commandId: 'example-module.say-hello',
            command: 'Example: Say Hello',
            payload: { message: 'Hello intent' },
            source: 'ui'
        });
    });

    it('publishes registry-backed COMMAND_RESULTS_UPDATED results for command search', async () => {
        const searchEvents = [];
        runtime.eventBus.subscribe('COMMAND_RESULTS_UPDATED', (payload) => searchEvents.push(payload));

        await runtime.moduleManager.loadModule('example-module');

        await runtime.eventBus.publish('INTENT_COMMAND_SEARCH', {
            query: 'hello',
            timestamp: Date.now()
        });

        expect(searchEvents).toHaveLength(1);
        expect(searchEvents[0].query).toBe('hello');
        expect(searchEvents[0].results).toEqual([
            expect.objectContaining({
                id: 'example-module.say-hello',
                title: 'Example: Say Hello',
                group: 'examples'
            })
        ]);
    });

    it('renders contributed views through INTENT_VIEW_RENDER using the runtime view registry', async () => {
        const renderedEvents = [];
        const exampleViewEvents = [];
        runtime.eventBus.subscribe('VIEW_RENDERED', (payload) => renderedEvents.push(payload));
        runtime.eventBus.subscribe('EXAMPLE_MODULE_VIEW_RENDERED', (payload) => exampleViewEvents.push(payload));

        await runtime.moduleManager.loadModule('example-module');

        const result = await runtime.eventBus.publish('INTENT_VIEW_RENDER', {
            viewId: 'example-module.status-card',
            target: '#example-output',
            props: {
                title: 'Example View',
                message: 'Rendered from registry'
            },
            state: {
                tone: 'success'
            },
            source: 'ai',
            timestamp: Date.now()
        });

        expect(result).toBeTruthy();
        expect(renderedEvents).toHaveLength(1);
        expect(renderedEvents[0]).toMatchObject({
            viewId: 'example-module.status-card',
            target: '#example-output',
            mode: 'replace',
            source: 'ai'
        });
        expect(exampleViewEvents).toHaveLength(1);
        expect(exampleViewEvents[0].message).toBe('Rendered from registry');
    });

    it('sorts navigation entries by order and label', () => {
        runtime.registries.navigation.register('module-b', {
            id: 'module-b.nav',
            label: 'Beta',
            href: '/beta',
            order: 20
        });
        runtime.registries.navigation.register('module-a', {
            id: 'module-a.nav',
            label: 'Alpha',
            href: '/alpha',
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
