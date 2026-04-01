import { EventBus } from '../runtime/EventBus.js';
import { ServiceManager } from '../runtime/ServiceManager.js';
import { ModuleManager } from '../runtime/ModuleManager.js';
import { Contracts } from '../runtime/Contracts.js';
import { MetaManager } from '../runtime/MetaManager.js';
import { LogAccumulator } from '../runtime/LogAccumulator.js';
import { CrossTabLeader } from '../runtime/CrossTabLeader.js';
import { ChannelManager } from '../runtime/ChannelManager.js';
import { CommandRegistry } from '../runtime/CommandRegistry.js';
import { RouteRegistry } from '../runtime/RouteRegistry.js';
import { NavigationRegistry } from '../runtime/NavigationRegistry.js';
import { PanelRegistry } from '../runtime/PanelRegistry.js';
import { AdapterRegistry } from '../runtime/AdapterRegistry.js';
import { ViewRegistry } from '../runtime/ViewRegistry.js';
import { ExampleService } from '../services/ExampleService.js';
import { PlatformService } from '../services/PlatformService.js';
import { auditPage } from '../runtime/seoAudit.js';

export const CORE_SERVICE_NAMES = new Set([
    'leader',
    'example',
    'platform',
    'channels',
    'commandRegistry',
    'routeRegistry',
    'navigationRegistry',
    'panelRegistry',
    'adapterRegistry',
    'viewRegistry'
]);

export function createRuntimeState() {
    const eventBus = new EventBus();
    eventBus.contracts = Contracts;

    const serviceManager = new ServiceManager(eventBus);
    const channelManager = new ChannelManager(eventBus);
    const metaManager = new MetaManager(eventBus);
    const logAccumulator = new LogAccumulator(eventBus);
    const leaderService = new CrossTabLeader(eventBus);
    const registries = {
        commands: new CommandRegistry({ eventBus, serviceManager }),
        routes: new RouteRegistry({ eventBus }),
        navigation: new NavigationRegistry({ eventBus }),
        panels: new PanelRegistry({ eventBus }),
        adapters: new AdapterRegistry({ eventBus, serviceManager }),
        views: new ViewRegistry({ eventBus, serviceManager })
    };
    const moduleManager = new ModuleManager(eventBus, serviceManager, registries);

    serviceManager.register('leader', leaderService, {
        version: '1.0.0',
        description: 'Cross-tab leader election and coordination'
    });
    serviceManager.register('example', new ExampleService());
    serviceManager.register('platform', new PlatformService(eventBus));
    serviceManager.register('channels', channelManager, {
        version: '1.0.0',
        description: 'Channel subscription orchestration'
    });
    serviceManager.register('commandRegistry', registries.commands, {
        version: '1.0.0',
        description: 'Module-owned command contribution registry'
    });
    serviceManager.register('routeRegistry', registries.routes, {
        version: '1.0.0',
        description: 'Module-owned route contribution registry'
    });
    serviceManager.register('navigationRegistry', registries.navigation, {
        version: '1.0.0',
        description: 'Module-owned navigation contribution registry'
    });
    serviceManager.register('panelRegistry', registries.panels, {
        version: '1.0.0',
        description: 'Module-owned panel contribution registry'
    });
    serviceManager.register('adapterRegistry', registries.adapters, {
        version: '1.0.0',
        description: 'Module-owned adapter contribution registry'
    });
    serviceManager.register('viewRegistry', registries.views, {
        version: '1.0.0',
        description: 'Module-owned safe view contribution registry'
    });

    leaderService.init();

    return {
        eventBus,
        serviceManager,
        moduleManager,
        channelManager,
        metaManager,
        logAccumulator,
        leaderService,
        registries,
        routerServiceRef: null,
        i18nServiceRef: null,
        authServiceRef: null,
        uiCleanup: null,
        analyticsConsentCleanup: null,
        themeToggleCleanup: null,
        authAccessSubscription: null,
        welcomeTimer: null
    };
}

export function syncWindowRuntime(state, { apiBaseUrl, destroyApp }) {
    const analytics = state.serviceManager?.get?.('analytics') || null;
    const analyticsConsent = state.serviceManager?.get?.('analyticsConsent') || null;

    window.serviceManager = state.serviceManager;
    window.csma = {
        ...(window.csma || {}),
        eventBus: state.eventBus,
        serviceManager: state.serviceManager,
        moduleManager: state.moduleManager,
        channels: state.channelManager,
        leader: state.leaderService,
        metaManager: state.metaManager,
        logAccumulator: state.logAccumulator,
        registries: state.registries,
        router: state.routerServiceRef,
        i18n: state.i18nServiceRef,
        auth: state.authServiceRef,
        analytics,
        analyticsConsent,
        apiBaseUrl,
        destroyApp,
        diagnose: (options = {}) => state.logAccumulator?.diagnosticSnapshot?.(options) || null,
        seoAudit: () => auditPage(),
        exportAnalytics: () => {
            if (analytics?.buildBatchPayload) {
                return analytics.buildBatchPayload()?.payload || {
                    entries: [],
                    sessionId: analytics.sessionId || null
                };
            }

            return {
                entries: [],
                sessionId: null
            };
        }
    };
}

export async function destroyRuntimeState(state, { destroyApp }) {
    if (state.welcomeTimer) {
        clearTimeout(state.welcomeTimer);
        state.welcomeTimer = null;
    }
    state.authAccessSubscription?.();
    state.authAccessSubscription = null;
    state.themeToggleCleanup?.();
    state.themeToggleCleanup = null;
    state.analyticsConsentCleanup?.();
    state.analyticsConsentCleanup = null;
    state.uiCleanup?.();
    state.uiCleanup = null;

    try {
        await state.moduleManager?.destroy?.();
    } catch (error) {
        console.warn('[CSMA] Failed to destroy modules:', error);
    }

    const nonCoreServices = state.serviceManager
        ? state.serviceManager.getAllStatus().map((entry) => entry.name).filter((name) => !CORE_SERVICE_NAMES.has(name))
        : [];
    for (const name of nonCoreServices.reverse()) {
        await state.serviceManager?.unregister(name);
    }

    try {
        await state.serviceManager?.destroyAll?.();
    } catch (error) {
        console.warn('[CSMA] Failed to destroy services:', error);
    }

    try {
        state.metaManager?.destroy?.();
        state.logAccumulator?.destroy?.();
    } catch (error) {
        console.warn('[CSMA] Failed to destroy runtime managers:', error);
    }

    window.serviceManager = null;
    window.csma = {
        ...(window.csma || {}),
        eventBus: null,
        serviceManager: null,
        moduleManager: null,
        channels: null,
        leader: null,
        metaManager: null,
        logAccumulator: null,
        registries: null,
        router: null,
        i18n: null,
        auth: null,
        analytics: null,
        analyticsConsent: null,
        diagnose: () => null,
        seoAudit: () => null,
        destroyApp
    };
}
