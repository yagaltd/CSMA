// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntimeState, destroyRuntimeState, syncWindowRuntime } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../src/runtime/features.js';

describe('runtime bootstrap', () => {
    beforeEach(() => {
        window.csma = {};
    });

    it('createRuntimeState returns object with all expected keys', () => {
        const state = createRuntimeState();
        expect(state).toHaveProperty('eventBus');
        expect(state).toHaveProperty('serviceManager');
        expect(state).toHaveProperty('moduleManager');
        expect(state).toHaveProperty('channelManager');
        expect(state).toHaveProperty('registries');
        expect(state.registries).toHaveProperty('commands');
        expect(state.registries).toHaveProperty('navigation');
        expect(state.registries).toHaveProperty('panels');
        expect(state.registries).toHaveProperty('adapters');
        expect(state.registries).toHaveProperty('views');
        expect(state.pageResolver).toBeTruthy();
        expect(state.clientNavigation).toBeTruthy();
    });

    it('createRuntimeState does not reference islandRuntime or staticRender', () => {
        const state = createRuntimeState();
        expect(state).not.toHaveProperty('staticRender');
        expect(state.serviceManager.get('islandRuntime')).toBeFalsy();
    });

    it('syncWindowRuntime populates window.csma', () => {
        const state = createRuntimeState();
        const noop = () => {};
        syncWindowRuntime(state, { apiBaseUrl: '', destroyApp: noop });
        expect(window.csma).toBeDefined();
        expect(window.csma.serviceManager).toBe(state.serviceManager);
        expect(window.csma.eventBus).toBe(state.eventBus);
        expect(window.csma.metaManager).toBe(state.metaManager);
        expect(state.serviceManager.get('metaManager')).toBe(state.metaManager);
    });

    it('destroyRuntimeState nullifies window.csma references', async () => {
        const state = createRuntimeState();
        const noop = () => {};
        syncWindowRuntime(state, { apiBaseUrl: '', destroyApp: noop });
        await destroyRuntimeState(state, { destroyApp: noop });
        expect(window.csma.eventBus).toBeNull();
        expect(window.csma.serviceManager).toBeNull();
    });

    it('loadOptionalFeatures returns without error when all FEATURES flags are false', async () => {
        const state = createRuntimeState();
        const allOff = {
            PWA: false,
            CLIENT_NAVIGATION: false,
            NETWORK_STATUS_MODULE: false,
            AUTH_SERVICE: false,
            SYNC_QUEUE: false,
            OPTIMISTIC_SYNC: false,
            MODAL_SYSTEM: false,
            FORM_MANAGEMENT: false,
            AUTH_UI_MODULE: false,
            CHECKOUT_MODULE: false,
            DATA_TABLE_MODULE: false,
            ANALYTICS: false,
            SEO_AUDIT: false,
        };
        await expect(
            loadOptionalFeatures(state, { FEATURES: allOff, apiBaseUrl: '', runtimeConfig: {}, pages: [] })
        ).resolves.toBeUndefined();
    });
});
