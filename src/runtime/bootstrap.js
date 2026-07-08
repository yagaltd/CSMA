import { EventBus } from './EventBus.js';
import { ServiceManager } from './ServiceManager.js';
import { ModuleManager } from './ModuleManager.js';
import { Contracts } from './Contracts.js';
import { MetaManager } from './MetaManager.js';
import { LogAccumulator } from './LogAccumulator.js';
import { CrossTabLeader } from './CrossTabLeader.js';
import { ChannelManager } from './ChannelManager.js';
import { CommandRegistry } from './CommandRegistry.js';
import { NavigationRegistry } from './NavigationRegistry.js';
import { PanelRegistry } from './PanelRegistry.js';
import { AdapterRegistry } from './AdapterRegistry.js';
import { ViewRegistry } from './ViewRegistry.js';
import { PageResolver } from './PageResolver.js';
import { ClientNavigationService } from './ClientNavigationService.js';
import { PlatformService } from '../services/PlatformService.js';
import { auditPage } from './seoAudit.js';
import { resolveSecurityPolicy } from './SecurityPolicy.js';

export const CORE_SERVICE_NAMES = new Set([
    'leader',
    'platform',
    'channels',
    'metaManager',
    'pageResolver',
    'clientNavigation',
    'commandRegistry',
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
    const pageResolver = new PageResolver();
    const clientNavigation = new ClientNavigationService();
    const registries = {
        commands: new CommandRegistry({ eventBus, serviceManager }),
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
    serviceManager.register('platform', new PlatformService(eventBus));
    serviceManager.register('channels', channelManager, {
        version: '1.0.0',
        description: 'Channel subscription orchestration'
    });
    serviceManager.register('metaManager', metaManager, {
        version: '2.0.0',
        description: 'Runtime head entry manager'
    });
    serviceManager.register('pageResolver', pageResolver, {
        version: '1.0.0',
        description: 'Render-page resolution for full-runtime delivery modes'
    });
    serviceManager.register('clientNavigation', clientNavigation, {
        version: '1.0.0',
        description: 'Optional History API navigation for full-runtime apps'
    });
    serviceManager.register('commandRegistry', registries.commands, {
        version: '1.0.0',
        description: 'Module-owned command contribution registry'
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
        pageResolver,
        clientNavigation,
        registries,
        i18nServiceRef: null,
        authServiceRef: null,
        uiCleanup: null,
        consentCleanup: null,
        analyticsConsentCleanup: null,
        themeToggleCleanup: null,
        authAccessSubscription: null,
        welcomeTimer: null
    };
}

export function syncWindowRuntime(state, { apiBaseUrl, destroyApp, securityPolicy } = {}) {
    const policy = securityPolicy || state.securityPolicy || resolveSecurityPolicy(state.runtimeConfig || {});
    const analytics = state.serviceManager?.get?.('analytics') || null;
    const consent = state.serviceManager?.get?.('consent') || null;
    const analyticsConsent = consent || state.serviceManager?.get?.('analyticsConsent') || null;
    const notifications = state.serviceManager?.get?.('notifications') || null;
    const share = state.serviceManager?.get?.('share') || null;
    const fileUpload = state.serviceManager?.get?.('fileUpload') || null;
    const captcha = state.serviceManager?.get?.('captcha') || null;
    const authUI = state.serviceManager?.get?.('authUI') || null;
    const cacheManager = state.serviceManager?.get?.('cacheManager') || null;

    if (policy.globals?.exposeInternals) {
        window.serviceManager = state.serviceManager;
    } else if ('serviceManager' in window) {
        window.serviceManager = null;
    }

    const publicRuntime = {
        ...(window.csma || {}),
        router: state.serviceManager?.get?.('router') || null,
        i18n: state.i18nServiceRef,
        auth: state.authServiceRef,
        authUI,
        analytics,
        consent,
        analyticsConsent,
        notifications,
        share,
        fileUpload,
        captcha,
        cacheManager,
        apiBaseUrl,
        destroyApp,
        diagnose: policy.profile === 'production'
            ? () => null
            : (options = {}) => state.logAccumulator?.diagnosticSnapshot?.(options) || null,
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

    window.csma = policy.globals?.exposeInternals
        ? {
            ...publicRuntime,
            eventBus: state.eventBus,
            serviceManager: state.serviceManager,
            moduleManager: state.moduleManager,
            channels: state.channelManager,
            leader: state.leaderService,
            metaManager: state.metaManager,
            metaManagerModule: state.serviceManager?.get?.('metaManagerModule') || null,
            pageResolver: state.pageResolver,
            clientNavigation: state.clientNavigation,
            logAccumulator: state.logAccumulator,
            registries: state.registries,
            runtimeConfig: state.runtimeConfig || null,
            securityPolicy: policy
        }
        : publicRuntime;
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
    state.consentCleanup?.();
    state.consentCleanup = null;
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
        metaManagerModule: null,
        pageResolver: null,
        clientNavigation: null,
        router: null,
        logAccumulator: null,
        registries: null,
        i18n: null,
        auth: null,
        authUI: null,
        runtimeConfig: null,
        analytics: null,
        consent: null,
        analyticsConsent: null,
        notifications: null,
        share: null,
        fileUpload: null,
        cacheManager: null,
        diagnose: () => null,
        seoAudit: () => null,
        destroyApp
    };
}
