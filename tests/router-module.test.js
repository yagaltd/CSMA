// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { RouterContracts } from '../src/modules/router/contracts/router-contracts.js';
import { RouterService } from '../src/modules/router/services/RouterService.js';
import { createRuntimeState } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../src/runtime/features.js';

describe('RouterService', () => {
    it('matches dynamic params and renders through the configured renderer', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Object.assign({}, Contracts, RouterContracts);
        const router = new RouterService(eventBus);
        const render = vi.fn();

        router.init({
            routes: [
                { id: 'product-detail', path: '/products/:slug', title: 'Product detail' }
            ],
            renderer: render
        });

        await router.handlePath('/products/valve-position-sensor', { source: 'test' });

        expect(render).toHaveBeenCalledWith(expect.objectContaining({
            pathname: '/products/valve-position-sensor',
            params: { slug: 'valve-position-sensor' }
        }));
        expect(router.getCurrentRoute()).toMatchObject({
            routeId: 'product-detail',
            params: { slug: 'valve-position-sensor' }
        });
    });

    it('supports beforeEach blocking and not-found fallback', async () => {
        const eventBus = new EventBus();
        eventBus.contracts = Object.assign({}, Contracts, RouterContracts);
        const router = new RouterService(eventBus);
        const render = vi.fn();
        const blockedEvents = [];
        const notFoundEvents = [];

        eventBus.subscribe('ROUTE_BLOCKED', (payload) => blockedEvents.push(payload));
        eventBus.subscribe('ROUTE_NOT_FOUND', (payload) => notFoundEvents.push(payload));

        router.init({
            routes: [{ id: 'home', path: '/', title: 'Home' }],
            notFound: { id: 'not-found', title: 'Missing page' },
            renderer: render
        });
        router.addBeforeEach(() => false);

        await router.handlePath('/', { source: 'test' });
        expect(blockedEvents).toHaveLength(1);
        expect(render).not.toHaveBeenCalled();

        router.beforeHooks = [];
        await router.handlePath('/missing', { source: 'test' });
        expect(notFoundEvents.at(-1)).toMatchObject({
            path: '/missing',
            routeId: 'not-found'
        });
    });
});

describe('router feature loading', () => {
    it('loads router and wires client navigation when enabled', async () => {
        const state = createRuntimeState();
        await loadOptionalFeatures(state, {
            FEATURES: {
                CLIENT_NAVIGATION: true,
                ROUTER_MODULE: true
            },
            runtimeConfig: {
                router: {
                    routes: [{ id: 'home', path: '/', title: 'Home' }]
                }
            },
            pages: []
        });

        const router = state.serviceManager.get('router');
        expect(router).toBeTruthy();
        expect(window.csma.router).toBe(router);
        expect(typeof state.clientNavigation.handlePath).toBe('function');
    });
});
