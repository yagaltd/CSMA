import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { Contracts } from '../../src/runtime/Contracts.js';
import { ServiceManager } from '../../src/runtime/ServiceManager.js';
import { ModuleManager } from '../../src/runtime/ModuleManager.js';
import { SerializerRegistry } from '../../src/runtime/SerializerRegistry.js';
import { AgentContextService } from '../../src/modules/agent-context/services/AgentContextService.js';
import { AgentContextContracts } from '../../src/modules/agent-context/contracts/agent-context-contracts.js';

function buildCore() {
    const eventBus = new EventBus();
    eventBus.contracts = { ...Contracts, ...AgentContextContracts };
    const serviceManager = new ServiceManager(eventBus);
    const serializerRegistry = new SerializerRegistry({ eventBus });
    const moduleManager = new ModuleManager(eventBus, serviceManager, {
        serializer: serializerRegistry
    });
    serviceManager.register('serializerRegistry', serializerRegistry, {
        version: '1.0.0',
        description: 'test registry'
    });
    const agentContext = new AgentContextService(eventBus);
    agentContext.init({ serializerRegistry, serviceManager });
    return { eventBus, serviceManager, serializerRegistry, moduleManager, agentContext };
}

describe('AgentContextService', () => {
    let core;

    beforeEach(() => {
        core = buildCore();
    });

    describe('discovery', () => {
        it('stores() returns empty when nothing registered', () => {
            expect(core.agentContext.stores()).toEqual([]);
        });

        it('stores() returns distinct store names after registration', () => {
            core.agentContext.register({
                store: 'maps', format: 'markdown', fn: () => '', moduleId: 'mindmap'
            });
            core.agentContext.register({
                store: 'cart', format: 'json', fn: () => '', moduleId: 'cart'
            });
            expect(core.agentContext.stores()).toEqual(['cart', 'maps']);
        });

        it('formats() always includes three built-in fallbacks', () => {
            const formats = core.agentContext.formats('maps');
            const names = formats.map((f) => f.format).sort();
            expect(names).toEqual(['ascii', 'json', 'markdown']);
        });

        it('formats() marks registered serializers as non-builtin', () => {
            core.agentContext.register({
                store: 'maps', format: 'markdown', fn: () => 'custom', moduleId: 'mindmap'
            });
            const formats = core.agentContext.formats('maps');
            const md = formats.find((f) => f.format === 'markdown');
            expect(md.builtin).toBe(false);
            expect(md.moduleId).toBe('mindmap');
        });
    });

    describe('get() with explicit data', () => {
        it('uses registered serializer when present', async () => {
            const serializer = (data) => `custom:${JSON.stringify(data)}`;
            core.agentContext.register({
                store: 'maps', format: 'markdown', fn: serializer, moduleId: 'mindmap'
            });
            const res = await core.agentContext.get({
                store: 'maps', format: 'markdown', data: { x: 1 }
            });
            expect(res.text).toBe('custom:{"x":1}');
            expect(res.format).toBe('markdown');
        });

        it('passes options to serializer', async () => {
            let captured;
            core.agentContext.register({
                store: 'maps', format: 'markdown',
                fn: (_d, opts) => { captured = opts; return 'ok'; },
                moduleId: 'mindmap'
            });
            await core.agentContext.get({
                store: 'maps', format: 'markdown',
                data: {}, filter: { status: 'blocked' }, depth: 3
            });
            expect(captured.filter).toEqual({ status: 'blocked' });
            expect(captured.depth).toBe(3);
            expect(captured.store).toBe('maps');
        });

        it('supports serializer returning { text, cursor }', async () => {
            core.agentContext.register({
                store: 'maps', format: 'markdown',
                fn: () => ({ text: 'page1', cursor: 'page2' }),
                moduleId: 'mindmap'
            });
            const res = await core.agentContext.get({
                store: 'maps', format: 'markdown', data: {}
            });
            expect(res.text).toBe('page1');
            expect(res.cursor).toBe('page2');
        });

        it('falls back to generic markdown when no serializer registered', async () => {
            const res = await core.agentContext.get({
                store: 'maps', format: 'markdown', data: { a: 1 }
            });
            expect(res.text).toContain('## maps');
            expect(res.text).toContain('- a: 1');
        });

        it('falls back to generic json when no serializer registered', async () => {
            const res = await core.agentContext.get({
                store: 'maps', format: 'json', data: { a: 1 }
            });
            const parsed = JSON.parse(res.text);
            expect(parsed.store).toBe('maps');
            expect(parsed.data.a).toBe(1);
        });

        it('markdown is the default format', async () => {
            const res = await core.agentContext.get({
                store: 'maps', data: { a: 1 }
            });
            expect(res.format).toBe('markdown');
            expect(res.text).toContain('## maps');
        });

        it('throws on unknown format with no fallback', async () => {
            await expect(core.agentContext.get({
                store: 'maps', format: 'xml', data: {}
            })).rejects.toThrow(/no serializer registered|not a built-in format/);
        });

        it('throws on missing store', async () => {
            await expect(core.agentContext.get({ format: 'markdown' }))
                .rejects.toThrow(/store/);
        });

        it('resolves string fn names via serviceManager lookup', async () => {
            // Register a fake service under moduleId 'mindmap' that has the
            // named method.
            const fakeMindmapService = {
                toMarkdown: (data) => `svc:${JSON.stringify(data)}`
            };
            core.serviceManager.register('mindmap', fakeMindmapService, {
                version: '1.0.0'
            });
            core.agentContext.register({
                store: 'maps', format: 'markdown', fn: 'toMarkdown', moduleId: 'mindmap'
            });
            const res = await core.agentContext.get({
                store: 'maps', format: 'markdown', data: { x: 1 }
            });
            expect(res.text).toBe('svc:{"x":1}');
        });

        it('falls back when string fn cannot be resolved', async () => {
            core.agentContext.register({
                store: 'maps', format: 'markdown', fn: 'nonexistent', moduleId: 'mindmap'
            });
            const res = await core.agentContext.get({
                store: 'maps', format: 'markdown', data: { a: 1 }
            });
            // Falls through to generic formatter.
            expect(res.text).toContain('## maps');
        });
    });

    describe('truncation', () => {
        it('truncates large output and sets truncated: true', async () => {
            const big = { text: 'x'.repeat(1000) };
            const res = await core.agentContext.get({
                store: 'maps', format: 'markdown', data: big, maxLength: 100
            });
            expect(res.truncated).toBe(true);
            expect(res.cursor).toBeDefined();
            expect(Buffer.byteLength(res.text, 'utf8')).toBeLessThanOrEqual(100);
        });

        it('does not truncate under maxLength', async () => {
            const res = await core.agentContext.get({
                store: 'maps', format: 'markdown', data: { a: 1 }, maxLength: 10_000
            });
            expect(res.truncated).toBeUndefined();
            expect(res.cursor).toBeUndefined();
        });
    });

    describe('register / unregister', () => {
        it('publishes AGENT_CONTEXT_REGISTERED on register', () => {
            const events = [];
            core.eventBus.subscribe('AGENT_CONTEXT_REGISTERED', (e) => events.push(e));
            core.agentContext.register({
                store: 'maps', format: 'markdown', fn: () => '', moduleId: 'mindmap'
            });
            expect(events).toHaveLength(1);
            expect(events[0].moduleId).toBe('mindmap');
            expect(events[0].store).toBe('maps');
        });

        it('publishes AGENT_CONTEXT_UNREGISTERED on unregister', () => {
            const events = [];
            core.eventBus.subscribe('AGENT_CONTEXT_UNREGISTERED', (e) => events.push(e));
            core.agentContext.register({
                store: 'maps', format: 'markdown', fn: () => '', moduleId: 'mindmap'
            });
            core.agentContext.register({
                store: 'maps', format: 'json', fn: () => '', moduleId: 'mindmap'
            });
            const count = core.agentContext.unregister('mindmap');
            expect(count).toBe(2);
            expect(events).toHaveLength(1);
            expect(events[0].count).toBe(2);
        });
    });

    describe('end-to-end with ModuleManager', () => {
        it('routes manifest contextSerializers to the registry on module load', async () => {
            // Build a stub module definition that we register directly with
            // ModuleManager via dynamic import is not feasible here; instead
            // we simulate by calling registerContributions via the manifest.
            const stubManifest = {
                id: 'stub-module',
                name: 'Stub',
                version: '1.0.0',
                description: 'test stub',
                dependencies: [],
                services: [],
                contracts: [],
                contributes: {
                    contextSerializers: [
                        { store: 'stub', format: 'markdown', fn: () => 'stub-out' }
                    ]
                }
            };
            // Use ModuleManager's registerContributions directly (normally
            // called inside loadModule).
            core.moduleManager.registerContributions(stubManifest);
            expect(core.agentContext.stores()).toContain('stub');

            const res = await core.agentContext.get({
                store: 'stub', format: 'markdown', data: {}
            });
            expect(res.text).toBe('stub-out');
        });
    });

    describe('lazy serviceManager lookup', () => {
        it('finds registry without explicit init when service registered', async () => {
            const eventBus = new EventBus();
            const serviceManager = new ServiceManager(eventBus);
            const reg = new SerializerRegistry({ eventBus });
            serviceManager.register('serializerRegistry', reg, { version: '1.0.0' });

            const agentContext = new AgentContextService(eventBus);
            // No init() call — should still work via serviceManager.
            agentContext.init({ serviceManager });

            const res = await agentContext.get({
                store: 'maps', format: 'markdown', data: { a: 1 }
            });
            expect(res.text).toContain('## maps');
        });
    });
});
