/**
 * CSMA Kit - Main Entry Point
 */
import { EventBus } from './runtime/EventBus.js';
import { ServiceManager } from './runtime/ServiceManager.js';
import { ModuleManager } from './runtime/ModuleManager.js';
import { Contracts } from './runtime/Contracts.js';
import { MetaManager } from './runtime/MetaManager.js';
import { LogAccumulator } from './runtime/LogAccumulator.js';
import { CrossTabLeader } from './runtime/CrossTabLeader.js';
import { ChannelManager } from './runtime/ChannelManager.js';
import { CommandRegistry } from './runtime/CommandRegistry.js';
import { RouteRegistry } from './runtime/RouteRegistry.js';
import { NavigationRegistry } from './runtime/NavigationRegistry.js';
import { PanelRegistry } from './runtime/PanelRegistry.js';
import { AdapterRegistry } from './runtime/AdapterRegistry.js';
import { ExampleService } from './services/ExampleService.js';
import { LLMService } from './modules/llm/services/LLMService.js';
import { PlatformService } from './services/PlatformService.js';
import { FEATURES, SEARCH_CONFIG, STATIC_RENDER_CONFIG, PROTOCOL } from './config.js';
import { initUI } from './ui/init.js';

const CORE_SERVICE_NAMES = new Set([
    'leader',
    'example',
    'llm',
    'platform',
    'channels',
    'commandRegistry',
    'routeRegistry',
    'navigationRegistry',
    'panelRegistry',
    'adapterRegistry'
]);

let eventBus = null;
let serviceManager = null;
let moduleManager = null;
let routerServiceRef = null;
let i18nServiceRef = null;
const apiBaseUrl = resolveApiBaseUrl();
let authServiceRef = null;
let channelManager = null;
let metaManager = null;
let logAccumulator = null;
let leaderService = null;
let registries = null;
let uiCleanup = null;
let themeToggleCleanup = null;
let authAccessSubscription = null;
let welcomeTimer = null;
let initPromise = null;
let appInitialized = false;
let appDestroyed = false;

function syncWindowRuntime() {
    window.serviceManager = serviceManager;
    window.csma = {
        ...(window.csma || {}),
        eventBus,
        serviceManager,
        moduleManager,
        channels: channelManager,
        leader: leaderService,
        metaManager,
        logAccumulator,
        registries,
        router: routerServiceRef,
        i18n: i18nServiceRef,
        auth: authServiceRef,
        apiBaseUrl,
        destroyApp,
        exportAnalytics: () => logAccumulator?.export?.() || { logs: [], sessionId: null }
    };
}

function ensureRuntime() {
    if (eventBus && serviceManager && moduleManager) {
        syncWindowRuntime();
        return;
    }

    eventBus = new EventBus();
    eventBus.contracts = Contracts;

    serviceManager = new ServiceManager(eventBus);
    channelManager = new ChannelManager(eventBus);
    metaManager = new MetaManager(eventBus);
    logAccumulator = new LogAccumulator(eventBus);
    leaderService = new CrossTabLeader(eventBus);
    registries = {
        commands: new CommandRegistry({ eventBus, serviceManager }),
        routes: new RouteRegistry({ eventBus }),
        navigation: new NavigationRegistry({ eventBus }),
        panels: new PanelRegistry({ eventBus }),
        adapters: new AdapterRegistry({ eventBus, serviceManager })
    };
    moduleManager = new ModuleManager(eventBus, serviceManager, registries);

    serviceManager.register('leader', leaderService, {
        version: '1.0.0',
        description: 'Cross-tab leader election and coordination'
    });
    serviceManager.register('example', new ExampleService());
    serviceManager.register('llm', new LLMService(eventBus));
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

    leaderService.init();
    appDestroyed = false;
    syncWindowRuntime();
}

// Initialize UI
// Wait for DOM ready
const handleDOMContentLoaded = () => {
    init();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleDOMContentLoaded, { once: true });
} else {
    init();
}

async function init() {
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        if (appInitialized) {
            return;
        }

        ensureRuntime();
        console.log('[CSMA] Initializing application...');

        // Load optional features based on config
        await loadOptionalFeatures();

        // Initialize UI components (dropdowns, inputs, modals, etc.)
        uiCleanup = initUI(eventBus) || window.csma?.componentCleanup || null;

        // Setup theme toggle (kept for backward compatibility with index.html)
        themeToggleCleanup?.();
        themeToggleCleanup = setupThemeToggle();

        // Load saved theme
        loadTheme();

        const logEndpoint = buildLogEndpoint(apiBaseUrl);
        logAccumulator?.init?.({
            endpoint: logEndpoint,
            source: window.csma?.config?.logSource || 'csma',
            appVersion: window.csma?.config?.version || import.meta.env?.VITE_APP_VERSION || 'dev',
            maxBatchSize: 5,
            authProvider: () => {
                const authService = serviceManager?.get('auth');
                return authService?.getToken?.() || null;
            }
        });

        // Update page metadata
        eventBus.publish('PAGE_CHANGED', {
            title: 'CSMA Kit',
            description: 'A lean, secure, reactive CSMA application kit',
            locale: 'en'
        });

        console.log('[CSMA] Application ready');

        // Example: Create initial item
        welcomeTimer = window.setTimeout(() => {
            eventBus.publish('INTENT_CREATE_ITEM', {
                title: 'Welcome to CSMA!',
                description: 'This is an example card demonstrating CSS-class reactivity.',
                priority: 'high'
            });
        }, 500);
        appInitialized = true;
        syncWindowRuntime();
    })().finally(() => {
        initPromise = null;
    });

    return initPromise;
}

async function destroyApp() {
    if (appDestroyed) {
        return;
    }

    appDestroyed = true;
    appInitialized = false;
    if (welcomeTimer) {
        clearTimeout(welcomeTimer);
        welcomeTimer = null;
    }
    authAccessSubscription?.();
    authAccessSubscription = null;
    themeToggleCleanup?.();
    themeToggleCleanup = null;
    uiCleanup?.();
    uiCleanup = null;

    try {
        await moduleManager?.destroy?.();
    } catch (error) {
        console.warn('[CSMA] Failed to destroy modules:', error);
    }

    const nonCoreServices = serviceManager
        ? serviceManager.getAllStatus().map((entry) => entry.name).filter((name) => !CORE_SERVICE_NAMES.has(name))
        : [];
    for (const name of nonCoreServices.reverse()) {
        await serviceManager?.unregister(name);
    }

    try {
        await serviceManager?.destroyAll?.();
    } catch (error) {
        console.warn('[CSMA] Failed to destroy services:', error);
    }

    try {
        metaManager?.destroy?.();
        logAccumulator?.destroy?.();
    } catch (error) {
        console.warn('[CSMA] Failed to destroy runtime managers:', error);
    }

    eventBus = null;
    serviceManager = null;
    moduleManager = null;
    channelManager = null;
    metaManager = null;
    logAccumulator = null;
    leaderService = null;
    registries = null;
    routerServiceRef = null;
    i18nServiceRef = null;
    authServiceRef = null;

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
        destroyApp
    };

    if (document.readyState === 'loading') {
        document.removeEventListener('DOMContentLoaded', handleDOMContentLoaded);
    }
}

/**
 * Load optional features based on config
 * Uses dynamic imports for perfect tree-shaking
 */
async function loadOptionalFeatures() {
    // PWA Support
    if (FEATURES.PWA) {
        try {
            // Only load service worker on web (not in Capacitor/Neutralino)
            if (!window.Capacitor && !window.Neutralino) {
                if ('serviceWorker' in navigator) {
                    await navigator.serviceWorker.register('/sw.js');
                    console.log('[PWA] Service worker registered');
                }
            }
        } catch (error) {
            console.warn('[PWA] Service worker registration failed:', error);
        }
    }

    // Router Module
    if (FEATURES.STATIC_RENDER && STATIC_RENDER_CONFIG.enabled) {
        try {
            await moduleManager.loadModule('static-render');
            const runtime = serviceManager.get('islandRuntime');
            await runtime?.init();
            window.csma.staticRender = runtime;
            console.log('[StaticRender] Island runtime initialized');
        } catch (error) {
            console.warn('[StaticRender] Failed to load module:', error);
        }
    }

    if (FEATURES.ROUTER) {
        try {
            await moduleManager.loadModule('router');
            const routerService = serviceManager.get('Router');
            routerServiceRef = routerService;
            window.csma = window.csma || {};
            window.csma.router = routerService;
            registries?.routes?.attachRouter?.(routerService);

            // Example routes (customize as needed)
            if (routerService && routerService.register) {
                routerService.register('/', () => {
                    console.log('[Router] Home page');
                });
            }
        } catch (error) {
            console.warn('[Router] Failed to load module:', error);
        }
    }

    // IndexedDB Storage Module

    if (FEATURES.NETWORK_STATUS_MODULE) {
        try {
            await moduleManager.loadModule('network-status');
            const networkStatus = serviceManager.get('networkStatus');
            networkStatus?.init();
            window.csma = window.csma || {};
            window.csma.networkStatus = networkStatus;
            console.log('[NetworkStatus] Connectivity monitoring enabled');
        } catch (error) {
            console.warn('[NetworkStatus] Failed to load module:', error);
        }
    }

    if (FEATURES.AUTH_SERVICE) {
        try {
            const { createAuthService } = await import('./services/core/AuthService.js');
            const authService = createAuthService(eventBus, { baseUrl: apiBaseUrl });
            serviceManager.register('auth', authService, {
                version: '1.0.0',
                description: 'HTTP cookie-based authentication client'
            });
            await authService.init();
            authServiceRef = authService;
            channelManager.setContextResolver(() => authServiceRef?.getUser?.());
            authAccessSubscription?.();
            authAccessSubscription = eventBus.subscribe('AUTH_SESSION_UPDATED', () => channelManager.reevaluateAccess());
            window.csma = window.csma || {};
            window.csma.auth = authService;
            console.log('[AuthService] Session management ready');
        } catch (error) {
            console.warn('[AuthService] Failed to initialize:', error);
        }
    }

    if (FEATURES.SYNC_QUEUE) {
        if (!FEATURES.NETWORK_STATUS_MODULE) {
            console.warn('[SyncQueue] Requires NETWORK_STATUS_MODULE feature. Skipping load.');
        } else {
            try {
                await moduleManager.loadModule('sync-queue');
                const syncQueue = serviceManager.get('syncQueue');
                const networkStatus = serviceManager.get('networkStatus');
                const storageService = window.localStorage && {
                    getItem: (key) => localStorage.getItem(key),
                    setItem: (key, value) => localStorage.setItem(key, value)
                };
                syncQueue?.init({ networkStatusService: networkStatus, storageService });
                window.csma = window.csma || {};
                window.csma.syncQueue = syncQueue;
                console.log('[SyncQueue] Offline queue ready');
            } catch (error) {
                console.warn('[SyncQueue] Failed to load module:', error);
            }
        }
    }

    if (FEATURES.OPTIMISTIC_SYNC) {
        try {
            await moduleManager.loadModule('optimistic-sync');
            const actionLogService = serviceManager.get('actionLog');
            const optimisticSync = serviceManager.get('optimisticSync');
            const transportService = serviceManager.get('optimisticTransport');
            await actionLogService?.init();
            await transportService?.init({
                leaderService: serviceManager.get('leader'),
                endpoint: window.csma?.config?.optimisticSync?.wsEndpoint,
                eventsEndpoint: window.csma?.config?.optimisticSync?.eventsEndpoint,
                channelManager,
                subprotocol: PROTOCOL.subprotocol
            });
            await optimisticSync?.init({
                actionLogService,
                leaderService: serviceManager.get('leader'),
                networkStatusService: serviceManager.get('networkStatus'),
                transportService
            });
            window.csma = window.csma || {};
            window.csma.optimisticSync = optimisticSync;
            window.csma.actionLog = actionLogService;
            window.csma.optimisticTransport = transportService;
            console.log('[OptimisticSync] Optimistic sync enabled');
        } catch (error) {
            console.warn('[OptimisticSync] Failed to load module:', error);
        }
    }

    if (FEATURES.MODAL_SYSTEM) {
        try {
            await moduleManager.loadModule('modal-system');
            const modalService = serviceManager.get('modal');
            modalService?.init();
            window.csma = window.csma || {};
            window.csma.modal = modalService;
            console.log('[ModalSystem] Modal stack enabled');
        } catch (error) {
            console.warn('[ModalSystem] Failed to load module:', error);
        }
    }

    if (FEATURES.FORM_MANAGEMENT) {
        try {
            await moduleManager.loadModule('form-management');
            const formManager = serviceManager.get('formManager');
            const syncQueue = serviceManager.get('syncQueue');
            const storageAdapter = window.localStorage && {
                getItem: (key) => localStorage.getItem(key),
                setItem: (key, value) => localStorage.setItem(key, value),
                removeItem: (key) => localStorage.removeItem(key)
            };
            formManager?.init({
                storageService: storageAdapter,
                syncQueueService: syncQueue
            });
            window.csma = window.csma || {};
            window.csma.form = formManager;
            console.log('[FormManagement] Form orchestration enabled');
        } catch (error) {
            console.warn('[FormManagement] Failed to load module:', error);
        }
    }

    if (FEATURES.AUTH_UI_MODULE) {
        if (!FEATURES.FORM_MANAGEMENT || !FEATURES.AUTH_SERVICE) {
            console.warn('[AuthUI] Requires FORM_MANAGEMENT and AUTH_SERVICE. Skipping load.');
        } else {
            try {
                await moduleManager.loadModule('auth-ui');
                const authUI = serviceManager.get('authUI');
                const authService = serviceManager.get('auth');
                const formManager = serviceManager.get('formManager');
                const modalService = serviceManager.get('modal');
                authUI?.init({ authService, formService: formManager, modalService });
                window.csma = window.csma || {};
                window.csma.authUI = authUI;
                console.log('[AuthUI] Authentication UI orchestration enabled');
            } catch (error) {
                console.warn('[AuthUI] Failed to load module:', error);
            }
        }
    }

    if (FEATURES.CHECKOUT_MODULE) {
        if (!FEATURES.FORM_MANAGEMENT) {
            console.warn('[Checkout] Requires FORM_MANAGEMENT. Skipping load.');
        } else {
            try {
                await moduleManager.loadModule('checkout');
                const checkout = serviceManager.get('checkout');
                const formManager = serviceManager.get('formManager');
                const syncQueue = serviceManager.get('syncQueue');
                const authService = serviceManager.get('auth');
                const hmacService = serviceManager.get('hmac');
                const optimisticSyncService = serviceManager.get('optimisticSync');
                checkout?.init({
                    formService: formManager,
                    syncQueueService: syncQueue,
                    authService,
                    hmacService,
                    optimisticSyncService,
                    allowGuestOptimistic: Boolean(window.csma?.config?.optimisticSync?.allowGuestCheckout)
                });
                window.csma = window.csma || {};
                window.csma.checkout = checkout;
                console.log('[Checkout] Checkout orchestration enabled');
            } catch (error) {
                console.warn('[Checkout] Failed to load module:', error);
            }
        }
    }

    if (FEATURES.DATA_TABLE_MODULE) {
        try {
            await moduleManager.loadModule('data-table');
            const dataTable = serviceManager.get('dataTable');
            const api = serviceManager.get('api');
            dataTable?.init({ apiService: api });
            window.csma = window.csma || {};
            window.csma.dataTable = dataTable;
            console.log('[DataTable] Remote table utilities enabled');
        } catch (error) {
            console.warn('[DataTable] Failed to load module:', error);
        }
    }

    if (FEATURES.SEARCH_MODULE) {
        try {
            await moduleManager.loadModule('search');
            const searchService = serviceManager.get('search');
            searchService?.init(SEARCH_CONFIG);
            window.csma = window.csma || {};
            window.csma.search = searchService;
            console.log('[Search] Tiered search module enabled');
        } catch (error) {
            console.warn('[Search] Failed to load module:', error);
        }
    }

    if (FEATURES.AI_MODULE) {
        try {
            await moduleManager.loadModule('ai');
            const aiService = serviceManager.get('ai');
            const aiConfig = window.csma?.config?.ai || {};
            await aiService?.init(aiConfig);
            window.csma = window.csma || {};
            window.csma.ai = aiService;
            console.log('[AI] Multi-provider AI orchestration enabled');
        } catch (error) {
            console.warn('[AI] Failed to load module:', error);
        }
    }
    if (FEATURES.INDEXEDDB) {
        try {
            await moduleManager.loadModule('storage');
            const storageService = serviceManager.get('Storage');

            // Initialize with schema
            if (storageService && storageService.init) {
                await storageService.init({
                    items: {
                        keyPath: 'id',
                        indexes: {
                            byStatus: 'status',
                            byPriority: 'priority'
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('[Storage] Failed to load module:', error);
        }
    }

    // I18n Module
    if (FEATURES.I18N) {
        try {
            await moduleManager.loadModule('i18n');
            const i18nService = serviceManager.get('I18n');
            i18nServiceRef = i18nService;

            if (i18nService) {
                const locale = localStorage.getItem('locale') || 'en';
                // Load translations
                const translations = await fetch(`/locales/${locale}.json`).then(r => r.json());
                await i18nService.loadLocale(locale, translations);
                console.log('[i18n] Translations loaded:', locale);
            }
        } catch (error) {
            console.warn('[i18n] Failed to load module:', error);
        }
    }

    // ThreadManager Support (Web Workers)
    if (FEATURES.THREAD_MANAGER) {
        try {
            const { threadManager } = await import('./runtime/ThreadManager.js');
            window.csma = window.csma || {};
            window.csma.threadManager = threadManager;
            console.log('[ThreadManager] Web Worker management enabled');
        } catch (error) {
            console.warn('[ThreadManager] Failed to load:', error);
        }
    }

    if (FEATURES.FILE_SYSTEM) {
        try {
            await moduleManager.loadModule('file-system');
            const fileSystemService = serviceManager.get('fileSystem');
            if (fileSystemService?.configure) {
                fileSystemService.configure({
                    metadataStoreName: 'csma-file-index',
                    storageRoot: '/user-files'
                });
            }
            await fileSystemService?.init();
            window.csma = window.csma || {};
            window.csma.fileSystem = fileSystemService;
            console.log('[FileSystem] Hybrid storage enabled');
        } catch (error) {
            console.warn('[FileSystem] Failed to load module:', error);
        }
    }

    if (FEATURES.MEDIA_CAPTURE) {
        if (!FEATURES.FILE_SYSTEM) {
            console.warn('[MediaCapture] Requires FILE_SYSTEM feature. Skipping load.');
        } else {
            try {
                await moduleManager.loadModule('media-capture');
                const mediaCaptureService = serviceManager.get('mediaCapture');
                const fileSystemService = serviceManager.get('fileSystem');
                mediaCaptureService?.init({ fileSystemService });
                window.csma = window.csma || {};
                window.csma.mediaCapture = mediaCaptureService;
                console.log('[MediaCapture] Audio recording enabled');
            } catch (error) {
                console.warn('[MediaCapture] Failed to load module:', error);
            }
        }
    }

    if (FEATURES.CAMERA_MODULE) {
        if (!FEATURES.FILE_SYSTEM) {
            console.warn('[Camera] Requires FILE_SYSTEM feature. Skipping load.');
        } else {
            try {
                await moduleManager.loadModule('camera');
                const cameraService = serviceManager.get('camera');
                const fileSystemService = serviceManager.get('fileSystem');
                cameraService?.init({ fileSystemService });
                window.csma = window.csma || {};
                window.csma.camera = cameraService;
                console.log('[Camera] Photo/video capture enabled');
            } catch (error) {
                console.warn('[Camera] Failed to load module:', error);
            }
        }
    }

    if (FEATURES.LOCATION_MODULE) {
        try {
            await moduleManager.loadModule('location');
            const locationService = serviceManager.get('location');
            locationService?.init({ storageService: window.localStorage && {
                setItem: (key, value) => localStorage.setItem(key, value)
            }});
            window.csma = window.csma || {};
            window.csma.location = locationService;
            console.log('[Location] Geolocation tracking enabled');
        } catch (error) {
            console.warn('[Location] Failed to load module:', error);
        }
    }

    if (FEATURES.MEDIA_TRANSFORM) {
        try {
            await moduleManager.loadModule('media-transform');
            const mediaTransformService = serviceManager.get('mediaTransform');
            mediaTransformService?.init();
            window.csma = window.csma || {};
            window.csma.mediaTransform = mediaTransformService;
            console.log('[MediaTransform] Conversion utilities enabled');
        } catch (error) {
            console.warn('[MediaTransform] Failed to load module:', error);
        }
    }

    if (FEATURES.IMAGE_OPTIMIZER) {
        if (!FEATURES.MEDIA_TRANSFORM || !FEATURES.FILE_SYSTEM) {
            console.warn('[ImageOptimizer] Requires MEDIA_TRANSFORM and FILE_SYSTEM features. Skipping load.');
        } else {
            try {
                await moduleManager.loadModule('image-optimizer');
                const imageOptimizer = serviceManager.get('imageOptimizer');
                const mediaTransform = serviceManager.get('mediaTransform');
                const fileSystemService = serviceManager.get('fileSystem');
                imageOptimizer?.init({ mediaTransformService: mediaTransform, fileSystemService });
                window.csma = window.csma || {};
                window.csma.imageOptimizer = imageOptimizer;
                console.log('[ImageOptimizer] Image optimization enabled');
            } catch (error) {
                console.warn('[ImageOptimizer] Failed to load module:', error);
            }
        }
    }

    // === TIER 3: CORE SERVICES ===

    // CacheManager (Data Layer)
    if (FEATURES.CACHE_MANAGER) {
        try {
            const { createCacheManager } = await import('./services/core/CacheManager.js');
            const cacheManager = createCacheManager(eventBus, {
                backend: FEATURES.INDEXEDDB ? 'indexeddb' : 'localStorage',
                defaultTTL: 5 * 60 * 1000,  // 5 minutes
                maxSize: 10 * 1024 * 1024,  // 10MB
                debug: import.meta.env.DEV
            });
            serviceManager.register('cacheManager', cacheManager);
            console.log('[CacheManager] Initialized');
        } catch (error) {
            console.warn('[CacheManager] Failed to load:', error);
        }
    }

    // DataAggregator (Data Layer)
    if (FEATURES.DATA_AGGREGATOR) {
        try {
            const { createDataAggregator } = await import('./services/core/DataAggregator.js');
            const dataAggregator = createDataAggregator(eventBus, {
                timeout: 30000,  // 30s
                retries: 2,
                debug: import.meta.env.DEV
            });
            serviceManager.register('dataAggregator', dataAggregator);
            console.log('[DataAggregator] Initialized');
        } catch (error) {
            console.warn('[DataAggregator] Failed to load:', error);
        }
    }

    // === PHASE 2: API LAYER ===

    // APIWrapper (HTTP Client)
    if (FEATURES.API_WRAPPER) {
        try {
            const { createAPIWrapper } = await import('./services/core/APIWrapper.js');
            const apiWrapper = createAPIWrapper(eventBus, {
                baseURL: apiBaseUrl,
                timeout: 10000,  // 10s
                retries: 3,
                debug: import.meta.env.DEV
            });
            serviceManager.register('api', apiWrapper);
            if (!apiBaseUrl) {
                console.warn('[APIWrapper] No VITE_API_URL configured. Requests will use relative paths (client mode). Set VITE_API_URL or window.__CSMA_API_URL to proxy through SSMA.');
            } else {
                console.log('[APIWrapper] Initialized →', apiBaseUrl);
            }
        } catch (error) {
            console.warn('[APIWrapper] Failed to load:', error);
        }
    }

    // === PHASE 3: DEVELOPER EXPERIENCE ===

    // FormValidator (Real-time form validation)
    if (FEATURES.FORM_VALIDATOR) {
        try {
            const { createFormValidator } = await import('./services/core/FormValidator.js');
            const formValidator = createFormValidator(eventBus, {
                debounceDelay: 300,  // 300ms
                debug: import.meta.env.DEV
            });
            serviceManager.register('formValidator', formValidator);
            console.log('[FormValidator] Initialized');
        } catch (error) {
            console.warn('[FormValidator] Failed to load:', error);
        }
    }

    // Command Menu Feature
    // try {
    //     const { initCommandMenu, registerBuiltInCommands } = await import('./components/command-menu/command-menu.js');

    //     const cleanup = initCommandMenu(eventBus);
    //     registerBuiltInCommands(eventBus);

    //     console.log('[CommandMenu] Initialized');
    // } catch (error) {
    //     console.warn('[CommandMenu] Failed to load:', error);
    // }
}

/**
 * Setup theme toggle
 */
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle') || document.getElementById('themeToggle');
    if (!toggleBtn || toggleBtn.dataset.themeBound === 'true') return () => {};

    const handleClick = () => {
        const currentTheme = document.documentElement.dataset.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        // Publish theme change event
        eventBus?.publish('THEME_CHANGED', { theme: newTheme });

        // Apply theme
        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    };

    toggleBtn.addEventListener('click', handleClick);

    toggleBtn.dataset.themeBound = 'true';
    return () => {
        toggleBtn.removeEventListener('click', handleClick);
        delete toggleBtn.dataset.themeBound;
    };
}

/**
 * Load saved theme
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.dataset.theme = savedTheme;
}

function resolveApiBaseUrl() {
    const envUrl = import.meta.env?.VITE_API_URL?.trim();
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined') {
        const globalUrl = window.__CSMA_API_URL || window.csma?.config?.apiBaseUrl;
        if (globalUrl) return globalUrl;
    }

    if (import.meta.env?.DEV) {
        return 'http://localhost:5050';
    }

    return '';
}

function buildLogEndpoint(baseUrl) {
    if (!baseUrl) return '/logs/batch';
    return `${baseUrl.replace(/\/$/, '')}/logs/batch`;
}
