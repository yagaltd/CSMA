/**
 * CSMA Kit - Main Entry Point
 */
import { EventBus } from './runtime/EventBus.js';
import { ServiceManager } from './runtime/ServiceManager.js';
import { ModuleManager } from './runtime/ModuleManager.js';
import { Contracts } from './runtime/Contracts.js';
import { MetaManager } from './runtime/MetaManager.js';
import { LogAccumulator } from './runtime/LogAccumulator.js';
import { ExampleService } from './services/ExampleService.js';
import { LLMService } from './modules/llm/services/LLMService.js';
import { PlatformService } from './services/PlatformService.js';
import { FEATURES, SEARCH_CONFIG } from './config.js';
import { initUI } from './ui/init.js';

// Initialize CSMA runtime
const eventBus = new EventBus();
const serviceManager = new ServiceManager(eventBus);
const moduleManager = new ModuleManager(eventBus, serviceManager);

// Set contracts for validation
eventBus.contracts = Contracts;

// Make serviceManager globally accessible (for UI components)
window.serviceManager = serviceManager;
window.csma = window.csma || {};
window.csma.moduleManager = moduleManager;

// Initialize runtime components
const metaManager = new MetaManager(eventBus);
const logAccumulator = new LogAccumulator(eventBus);

// Register services
serviceManager.register('example', new ExampleService());
serviceManager.register('llm', new LLMService());
serviceManager.register('platform', new PlatformService(eventBus));

// Initialize UI
// Wait for DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function init() {
    console.log('[CSMA] Initializing application...');

    // Load optional features based on config
    await loadOptionalFeatures();

    // Initialize UI components (dropdowns, inputs, modals, etc.)
    initUI(eventBus);

    // Setup theme toggle (kept for backward compatibility with index.html)
    setupThemeToggle();

    // Load saved theme
    loadTheme();

    // Update page metadata
    eventBus.publish('PAGE_CHANGED', {
        title: 'CSMA Kit',
        description: 'A lean, secure, reactive CSMA application kit',
        locale: 'en'
    });

    console.log('[CSMA] Application ready');

    // Example: Create initial item
    setTimeout(() => {
        eventBus.publish('INTENT_CREATE_ITEM', {
            title: 'Welcome to CSMA!',
            description: 'This is an example card demonstrating CSS-class reactivity.',
            priority: 'high'
        });
    }, 500);
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
    if (FEATURES.ROUTER) {
        try {
            await moduleManager.loadModule('router');
            const routerService = serviceManager.get('Router');

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
            formManager?.init({ storageService: storageAdapter, syncQueueService: syncQueue });
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
                checkout?.init({ formService: formManager, syncQueueService: syncQueue });
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

    if (FEATURES.ANALYTICS_CONSENT) {
        try {
            await moduleManager.loadModule('analytics-consent');
            const analyticsConsent = serviceManager.get('analyticsConsent');
            analyticsConsent?.registerScope('search_analytics', {
                description: 'Help improve search relevance (hashed & aggregated)',
                defaultConsent: false
            });
            analyticsConsent?.registerScope('ui_analytics', {
                description: 'Help improve UI by sharing anonymized interaction counts',
                defaultConsent: false
            });
            analyticsConsent?.registerScope('perf_metrics', {
                description: 'Share coarse performance metrics (Web Vitals)',
                defaultConsent: false
            });
            window.csma = window.csma || {};
            window.csma.analyticsConsent = analyticsConsent;
            if (logAccumulator) {
                logAccumulator.analyticsConsent = analyticsConsent;
            }
            console.log('[AnalyticsConsent] Consent service ready');
        } catch (error) {
            console.warn('[AnalyticsConsent] Failed to load module:', error);
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
                baseURL: import.meta.env.VITE_API_URL || '',
                timeout: 10000,  // 10s
                retries: 3,
                debug: import.meta.env.DEV
            });
            serviceManager.register('api', apiWrapper);
            console.log('[APIWrapper] Initialized');
        } catch (error) {
            console.warn('[APIWrapper] Failed to load:', error);
        }
    }

    // AuthService (Authentication)
    if (FEATURES.AUTH_SERVICE) {
        try {
            const api = serviceManager.get('api');
            const storage = serviceManager.get('storage');

            if (!api) {
                console.warn('[AuthService] Skipped - API_WRAPPER required');
                return;
            }

            const { createAuthService } = await import('./services/core/AuthService.js');
            const authService = createAuthService(eventBus, {
                api,
                storage,
                refreshThreshold: 5 * 60 * 1000,  // Refresh 5 min before expiry
                debug: import.meta.env.DEV
            });
            serviceManager.register('auth', authService);

            // Inject auth headers into API requests
            api.addRequestInterceptor((config) => {
                if (authService.isAuthenticated()) {
                    config.headers['Authorization'] = `Bearer ${authService.getToken()}`;
                }
                return config;
            });

            // Handle 401 responses (auto-refresh)
            api.addResponseInterceptor(async (response, config) => {
                if (response.status === 401 && authService.getToken()) {
                    try {
                        // Try to refresh token
                        await authService.refreshAccessToken();

                        // Retry original request with new token
                        config.headers['Authorization'] = `Bearer ${authService.getToken()}`;
                        return fetch(response.url, config);
                    } catch (error) {
                        // Refresh failed, logout
                        await authService.logout('TOKEN_EXPIRED');
                        throw error;
                    }
                }
                return response;
            });

            console.log('[AuthService] Initialized');
        } catch (error) {
            console.warn('[AuthService] Failed to load:', error);
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
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.dataset.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        // Publish theme change event
        eventBus.publish('THEME_CHANGED', { theme: newTheme });

        // Apply theme
        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    });
}

/**
 * Load saved theme
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.dataset.theme = savedTheme;
}


// Export for debugging (optional)
window.csma = {
    ...window.csma,
    eventBus,
    serviceManager,
    metaManager,
    logAccumulator,
    router,
    storage,
    i18n,
    exportAnalytics: () => logAccumulator.export()
};
