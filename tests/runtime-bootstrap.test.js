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
        expect(window.csma.metaManagerModule).toBeNull();
    });

    it('destroyRuntimeState nullifies window.csma references', async () => {
        const state = createRuntimeState();
        const noop = () => {};
        syncWindowRuntime(state, { apiBaseUrl: '', destroyApp: noop });
        await destroyRuntimeState(state, { destroyApp: noop });
        expect(window.csma.eventBus).toBeNull();
        expect(window.csma.serviceManager).toBeNull();
        expect(window.csma.metaManagerModule).toBeNull();
    });

    it('loadOptionalFeatures returns without error when all FEATURES flags are false', async () => {
        const state = createRuntimeState();
        const allOff = {
            PWA: false,
            OFFLINE_CACHE: false,
            CLIENT_NAVIGATION: false,
            ROUTER_MODULE: false,
            NETWORK_STATUS_MODULE: false,
            AUTH_MODULE: false,
            AUTH_SERVICE: false,
            SYNC_QUEUE: false,
            OPTIMISTIC_SYNC: false,
            MODAL_SYSTEM: false,
            FORM_MANAGEMENT: false,
            AUTH_UI_MODULE: false,
            CHECKOUT_MODULE: false,
            DATA_TABLE_MODULE: false,
            NOTIFICATIONS_MODULE: false,
            SHARE_MODULE: false,
            FILE_UPLOAD: false,
            CONSENT_MODULE: false,
            ANALYTICS_CONSENT: false,
            ANALYTICS_MODULE: false,
            ANALYTICS: false,
            SEO_AUDIT: false,
        };
        await expect(
            loadOptionalFeatures(state, { FEATURES: allOff, apiBaseUrl: '', runtimeConfig: {}, pages: [] })
        ).resolves.toBeUndefined();
    });

    it('loads the consent module with the canonical feature flag', async () => {
        const state = createRuntimeState();
        await loadOptionalFeatures(state, {
            FEATURES: {
                CONSENT_MODULE: true,
                ANALYTICS_CONSENT: false,
                ANALYTICS_MODULE: false
            },
            apiBaseUrl: '',
            runtimeConfig: {},
            pages: []
        });

        expect(state.serviceManager.get('consent')).toBeTruthy();
        expect(window.csma.consent).toBe(state.serviceManager.get('consent'));
        expect(window.csma.analyticsConsent).toBe(window.csma.consent);
    });

    it('keeps ANALYTICS_CONSENT as a legacy flag for consent loading', async () => {
        const state = createRuntimeState();
        await loadOptionalFeatures(state, {
            FEATURES: {
                CONSENT_MODULE: false,
                ANALYTICS_CONSENT: true,
                ANALYTICS_MODULE: false
            },
            apiBaseUrl: '',
            runtimeConfig: {},
            pages: []
        });

        expect(state.serviceManager.get('consent')).toBeTruthy();
        expect(window.csma.analyticsConsent).toBe(state.serviceManager.get('consent'));
    });

    it('passes consent into analytics when both modules are enabled', async () => {
        const state = createRuntimeState();
        await loadOptionalFeatures(state, {
            FEATURES: {
                CONSENT_MODULE: true,
                ANALYTICS_CONSENT: false,
                ANALYTICS_MODULE: true
            },
            apiBaseUrl: '',
            runtimeConfig: { analytics: { endpoint: null } },
            pages: []
        });

        expect(window.csma.analytics.analyticsConsent).toBe(window.csma.consent);
    });

    it('loads auth with the canonical feature flag and legacy alias stays off', async () => {
        const state = createRuntimeState();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({})
        });

        await loadOptionalFeatures(state, {
            FEATURES: {
                AUTH_MODULE: true,
                AUTH_SERVICE: false
            },
            apiBaseUrl: 'https://api.example.test',
            runtimeConfig: {
                auth: {
                    strategy: 'hybrid'
                }
            },
            pages: []
        });

        expect(state.serviceManager.get('auth')).toBeTruthy();
        expect(window.csma.auth).toBe(state.serviceManager.get('auth'));
        expect(typeof window.csma.auth.isAuthenticated).toBe('function');
    });

    it('loads share and notifications modules through feature flags', async () => {
        const state = createRuntimeState();
        await loadOptionalFeatures(state, {
            FEATURES: {
                NOTIFICATIONS_MODULE: true,
                SHARE_MODULE: true,
                CONSENT_MODULE: false,
                ANALYTICS_CONSENT: false
            },
            apiBaseUrl: '',
            runtimeConfig: {
                notifications: { consentCategory: 'preferences' },
                share: { toastIntent: 'INTENT_TOAST_SHOW' }
            },
            pages: []
        });

        expect(state.serviceManager.get('notifications')).toBeTruthy();
        expect(state.serviceManager.get('share')).toBeTruthy();
        expect(window.csma.notifications).toBe(state.serviceManager.get('notifications'));
        expect(window.csma.share).toBe(state.serviceManager.get('share'));
    });

    it('auto-loads meta-manager integration when I18N is enabled', async () => {
        const state = createRuntimeState();
        window.csma = {};
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ seo: { title: 'Pricing' } })
        });

        await loadOptionalFeatures(state, {
            FEATURES: {
                I18N: true
            },
            apiBaseUrl: '',
            runtimeConfig: {},
            pages: []
        });

        expect(state.serviceManager.get('I18n')).toBeTruthy();
        expect(state.serviceManager.get('metaManagerModule')).toBeTruthy();
        expect(window.csma.i18n).toBe(state.serviceManager.get('I18n'));
        expect(window.csma.metaManagerModule).toBe(state.serviceManager.get('metaManagerModule'));
    });

    it('loads file upload with optional dependencies when enabled', async () => {
        const state = createRuntimeState();
        await loadOptionalFeatures(state, {
            FEATURES: {
                FILE_UPLOAD: true,
                FILE_SYSTEM: false,
                SYNC_QUEUE: false,
                NETWORK_STATUS_MODULE: false
            },
            apiBaseUrl: '',
            runtimeConfig: {},
            pages: []
        });

        expect(state.serviceManager.get('fileUpload')).toBeTruthy();
        expect(window.csma.fileUpload).toBe(state.serviceManager.get('fileUpload'));
    });

    it('loads the composed offline/cache stack with OFFLINE_CACHE', async () => {
        const state = createRuntimeState();
        const originalNavigator = global.navigator;
        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: {
                onLine: true
            }
        });

        await loadOptionalFeatures(state, {
            FEATURES: {
                OFFLINE_CACHE: true,
                PWA: false,
                NETWORK_STATUS_MODULE: false,
                SYNC_QUEUE: false,
                CACHE_MANAGER: false,
                INDEXEDDB: false
            },
            apiBaseUrl: '',
            runtimeConfig: {
                offlineCache: {
                    sampleInterval: 0,
                    backend: 'memory'
                }
            },
            pages: []
        });

        expect(state.serviceManager.get('networkStatus')).toBeTruthy();
        expect(state.serviceManager.get('syncQueue')).toBeTruthy();
        expect(state.serviceManager.get('cacheManager')).toBeTruthy();
        expect(window.csma.cacheManager).toBe(state.serviceManager.get('cacheManager'));

        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: originalNavigator
        });
    });
});
