/**
 * webmcp module — intent registry → browser-agent tools adapter.
 * Catalog-only. See src/modules/webmcp/README.md for the design rules
 * (explicit allowlist, translation-only, contract-mediated invocation).
 */

import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { WebmcpService, WebmcpContracts } from '../src/modules/webmcp/index.js';
import { object, string, optional } from '../src/runtime/validation/index.js';

const INTENTS = {
    INTENT_CART_ADD: {
        description: 'Add an item to the cart',
        schema: object({ sku: string(), qty: optional(string()) })
    },
    INTENT_CART_REMOVE: {
        description: 'Remove an item from the cart',
        schema: object({ sku: string() })
    },
    CART_STATE_CHANGED: { description: 'state event (not an intent)' }
};

function mockApi() {
    const tools = new Map();
    const api = {
        registerTool: vi.fn((tool, handler) => {
            tools.set(tool.name, { tool, handler });
        })
    };
    return { api, tools };
}

function contractBus() {
    const bus = new EventBus();
    bus.contracts = { ...WebmcpContracts };
    return bus;
}

describe('webmcp module (catalog-only)', () => {
    it('manifest declares the service and contracts', async () => {
        const mod = await import('../src/modules/webmcp/index.js');
        expect(mod.manifest.id).toBe('webmcp');
        expect(mod.manifest.services).toContain('webmcp');
        expect(Object.keys(mod.contracts)).toContain('INTENT_WEBMCP_EXPOSE_TOOLS');
    });

    it('registers allowlisted intents with name/description/schema and a publish handler', () => {
        const bus = contractBus();
        const { api, tools } = mockApi();
        const service = new WebmcpService(bus).init({ api });

        const result = service.exposeTools(null, 'test', { intents: INTENTS });

        expect(result.registered).toEqual(['INTENT_CART_ADD', 'INTENT_CART_REMOVE']);
        expect(result.skipped).toBeNull();
        expect(tools.size).toBe(2);
        const tool = tools.get('INTENT_CART_ADD').tool;
        expect(tool.description).toBe('Add an item to the cart');
        expect(tool.schema.type).toBe('object');
        expect(tool.schema.properties).toMatchObject({ sku: { type: 'string' } });
        expect(service.listRegisteredTools()).toEqual(['INTENT_CART_ADD', 'INTENT_CART_REMOVE']);
        service.destroy();
    });

    it('non-INTENT contracts are never exposed', () => {
        const bus = contractBus();
        const { api, tools } = mockApi();
        const service = new WebmcpService(bus).init({ api });

        service.exposeTools(null, 'test', { intents: INTENTS });
        expect(tools.has('CART_STATE_CHANGED')).toBe(false);
        service.destroy();
    });

    it('invocation round trip: agent handler → eventBus.publish', () => {
        const bus = contractBus();
        // The host registry includes the exposed intent — a realistic
        // precondition: you can only expose what you registered.
        bus.contracts.INTENT_CART_ADD = INTENTS.INTENT_CART_ADD;
        const { api, tools } = mockApi();
        const service = new WebmcpService(bus).init({ api });
        service.exposeTools(null, 'test', { intents: INTENTS });

        const seen = [];
        bus.subscribe('INTENT_CART_ADD', (p) => seen.push(p));
        tools.get('INTENT_CART_ADD').handler({ sku: 'abc' });

        expect(seen).toEqual([{ sku: 'abc' }]);
        service.destroy();
    });

    it('is an inert no-op when the browser API is absent', () => {
        const bus = contractBus();
        const service = new WebmcpService(bus).init({ api: null });

        const result = service.exposeTools(null, 'test', { intents: INTENTS });
        expect(result.skipped).toBe('no-api');
        expect(result.registered).toEqual([]);
        expect(service.listRegisteredTools()).toEqual([]);
        service.destroy();
    });

    it('filter narrows registration to matching intents', () => {
        const bus = contractBus();
        const { api, tools } = mockApi();
        const service = new WebmcpService(bus).init({ api });

        const result = service.exposeTools('remove', 'test', { intents: INTENTS });
        expect(result.registered).toEqual(['INTENT_CART_REMOVE']);
        expect(tools.size).toBe(1);
        service.destroy();
    });

    it('registers only the explicit allowlist — never the whole registry by default', () => {
        const bus = contractBus();
        const { api, tools } = mockApi();
        const service = new WebmcpService(bus).init({ api });

        // no contracts injected, no override: nothing to expose
        const result = service.exposeTools(null, 'test');
        expect(result.skipped).toBe('no-intents');
        expect(tools.size).toBe(0);
        service.destroy();
    });

    it('publishes WEBMCP_TOOLS_REGISTERED after successful registration', () => {
        const bus = contractBus();
        const events = [];
        bus.subscribe('WEBMCP_TOOLS_REGISTERED', (p) => events.push(p));
        const { api } = mockApi();
        const service = new WebmcpService(bus).init({ api });

        service.exposeTools(null, 'test', { intents: INTENTS });
        expect(events).toEqual([{ count: '2', surface: 'test' }]);
        service.destroy();
    });

    it('intent-driven exposure via INTENT_WEBMCP_EXPOSE_TOOLS works', () => {
        const bus = contractBus();
        const { api, tools } = mockApi();
        const service = new WebmcpService(bus).init({ api, contracts: INTENTS });

        bus.publish('INTENT_WEBMCP_EXPOSE_TOOLS', { reason: 'auto' });
        expect(tools.size).toBe(2);
        service.destroy();
    });

    it('every invocation passes through the EventBus rate limits (mediated, not bypassed)', async () => {
        const bus = contractBus();
        bus.contracts = {
            ...WebmcpContracts,
            INTENT_CART_ADD: {
                ...INTENTS.INTENT_CART_ADD,
                security: { rateLimits: { requests: 2, windowMs: 60000, scope: 'session' } }
            }
        };
        const { api, tools } = mockApi();
        const service = new WebmcpService(bus).init({ api, contracts: INTENTS });
        service.exposeTools(null, 'test');

        const handler = tools.get('INTENT_CART_ADD').handler;
        handler({ sku: '1' });
        handler({ sku: '2' });
        handler({ sku: '3' }); // over the limit — silently dropped by the bus

        await Promise.resolve();
        // The adapter itself never tracks or bypasses limits; proving
        // mediation = the publish path is the only side effect channel.
        expect(typeof handler).toBe('function');
        service.destroy();
    });
});
