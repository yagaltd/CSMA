import { SEARCH_CONFIG, STATIC_RENDER_CONFIG, PROTOCOL } from '../config.js';
import { initAnalyticsConsentUI } from '../modules/analytics/ui/analytics-consent.js';
import { auditPage } from '../runtime/seoAudit.js';

export async function loadOptionalFeatures(state, { FEATURES, apiBaseUrl }) {
    const { eventBus, serviceManager, moduleManager, channelManager, registries } = state;

    if (FEATURES.PWA) {
        try {
            if (!window.Capacitor && !window.Neutralino && 'serviceWorker' in navigator) {
                await navigator.serviceWorker.register('/sw.js');
                console.log('[PWA] Service worker registered');
            }
        } catch (error) {
            console.warn('[PWA] Service worker registration failed:', error);
        }
    }

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
            state.routerServiceRef = routerService;
            window.csma = window.csma || {};
            window.csma.router = routerService;
            registries?.routes?.attachRouter?.(routerService);

            if (routerService?.register) {
                routerService.register('/', () => {
                    console.log('[Router] Home page');
                });
            }
        } catch (error) {
            console.warn('[Router] Failed to load module:', error);
        }
    }

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
            const { createAuthService } = await import('../services/core/AuthService.js');
            const authService = createAuthService(eventBus, { baseUrl: apiBaseUrl });
            serviceManager.register('auth', authService, {
                version: '1.0.0',
                description: 'HTTP cookie-based authentication client'
            });
            await authService.init();
            state.authServiceRef = authService;
            channelManager.setContextResolver(() => state.authServiceRef?.getUser?.());
            state.authAccessSubscription?.();
            state.authAccessSubscription = eventBus.subscribe('AUTH_SESSION_UPDATED', () => channelManager.reevaluateAccess());
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

    if (FEATURES.ANALYTICS_MODULE || FEATURES.ANALYTICS_CONSENT) {
        try {
            await moduleManager.loadModule('analytics');
            const consentService = serviceManager.get('analyticsConsent');
            const analyticsConfig = window.csma?.config?.analytics || {};

            if (FEATURES.ANALYTICS_CONSENT) {
                window.csma = window.csma || {};
                window.csma.analyticsConsent = consentService;
                window.csma.seoAudit = auditPage;
                state.analyticsConsentCleanup?.();
                state.analyticsConsentCleanup = initAnalyticsConsentUI(consentService);
            }

            if (!FEATURES.ANALYTICS_MODULE) {
                console.log('[Analytics] Consent service enabled');
            } else {
                const analyticsService = serviceManager.get('analytics');
                await analyticsService.init({
                    ...analyticsConfig,
                    ...(FEATURES.ANALYTICS_CONSENT ? { consent: consentService } : {})
                });
                window.csma = window.csma || {};
                window.csma.analytics = analyticsService;
                if (FEATURES.ANALYTICS_CONSENT) {
                    window.csma.analyticsConsent = consentService;
                }
                window.csma.seoAudit = auditPage;
                console.log('[Analytics] Web analytics module enabled');
            }
        } catch (error) {
            console.warn('[Analytics] Failed to load module:', error);
        }
    }

    if (FEATURES.INDEXEDDB) {
        try {
            await moduleManager.loadModule('storage');
            const storageService = serviceManager.get('Storage');
            if (storageService?.init) {
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

    if (FEATURES.I18N) {
        try {
            await moduleManager.loadModule('i18n');
            const i18nService = serviceManager.get('I18n');
            state.i18nServiceRef = i18nService;

            if (i18nService) {
                const locale = localStorage.getItem('locale') || 'en';
                const translations = await fetch(`/locales/${locale}.json`).then(r => r.json());
                await i18nService.loadLocale(locale, translations);
                console.log('[i18n] Translations loaded:', locale);
            }
        } catch (error) {
            console.warn('[i18n] Failed to load module:', error);
        }
    }

    if (FEATURES.THREAD_MANAGER) {
        try {
            const { threadManager } = await import('../runtime/ThreadManager.js');
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

    if (FEATURES.CACHE_MANAGER) {
        try {
            const { createCacheManager } = await import('../services/core/CacheManager.js');
            const cacheManager = createCacheManager(eventBus, {
                backend: FEATURES.INDEXEDDB ? 'indexeddb' : 'localStorage',
                defaultTTL: 5 * 60 * 1000,
                maxSize: 10 * 1024 * 1024,
                debug: import.meta.env.DEV
            });
            serviceManager.register('cacheManager', cacheManager);
            console.log('[CacheManager] Initialized');
        } catch (error) {
            console.warn('[CacheManager] Failed to load:', error);
        }
    }

    if (FEATURES.DATA_AGGREGATOR) {
        try {
            const { createDataAggregator } = await import('../services/core/DataAggregator.js');
            const dataAggregator = createDataAggregator(eventBus, {
                timeout: 30000,
                retries: 2,
                debug: import.meta.env.DEV
            });
            serviceManager.register('dataAggregator', dataAggregator);
            console.log('[DataAggregator] Initialized');
        } catch (error) {
            console.warn('[DataAggregator] Failed to load:', error);
        }
    }

    if (FEATURES.API_WRAPPER) {
        try {
            const { createAPIWrapper } = await import('../services/core/APIWrapper.js');
            const apiWrapper = createAPIWrapper(eventBus, {
                baseURL: apiBaseUrl,
                timeout: 10000,
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

    if (FEATURES.FORM_VALIDATOR) {
        try {
            const { createFormValidator } = await import('../services/core/FormValidator.js');
            const formValidator = createFormValidator(eventBus, {
                debounceDelay: 300,
                debug: import.meta.env.DEV
            });
            serviceManager.register('formValidator', formValidator);
            console.log('[FormValidator] Initialized');
        } catch (error) {
            console.warn('[FormValidator] Failed to load:', error);
        }
    }
}
