import { initConsentUI } from '../modules/consent/ui/consent-ui.js';
import { auditPage } from './seoAudit.js';
import { buildLogEndpoint } from '../style/theme/theme-helpers.js';
import { resolveSsmaBaseUrl, resolveSsmaHttpEndpoint, resolveSsmaWsEndpoint } from './ssma.js';
import { assertProductionSecurityPolicy, resolveSecurityPolicy } from './SecurityPolicy.js';

function resolveOptionalSsmaEndpoint(path, override, runtimeConfig = {}) {
    if (override) {
        return override;
    }

    if (!resolveSsmaBaseUrl(runtimeConfig)) {
        return null;
    }

    return resolveSsmaHttpEndpoint(path, undefined, runtimeConfig);
}

function cloneRuntimeSection(value, fallback = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return structuredClone(fallback);
    }

    try {
        return structuredClone(value);
    } catch {
        return { ...value };
    }
}

function ensureCsma(windowRef = globalThis.window) {
    windowRef.csma = windowRef.csma || {};
    return windowRef.csma;
}

async function runFeature(label, fn) {
    try {
        await fn();
    } catch (error) {
        console.warn(label, error);
    }
}

async function initService(service, args) {
    if (!service?.init) {
        return undefined;
    }
    const result = arguments.length > 1 ? service.init(args) : service.init();
    if (result != null && typeof result.then === 'function') {
        return result;
    }
    return result;
}

function initializePageServices(state, {
    pages = [],
    runtimeConfig = {},
    documentRef = globalThis.document,
    windowRef = globalThis.window
} = {}) {
    const pageResolver = state.serviceManager.get('pageResolver');
    const clientNavigation = state.serviceManager.get('clientNavigation');
    const router = state.serviceManager.get('router');

    pageResolver?.init({ pages });

    return {
        pageResolver,
        clientNavigation,
        router,
        runtimeConfig
    };
}

export async function loadOptionalFeatures(state, {
    FEATURES,
    apiBaseUrl,
    runtimeConfig = {},
    pages = [],
    documentRef = globalThis.document,
    windowRef = globalThis.window
}) {
    const { eventBus, serviceManager, moduleManager, channelManager, registries } = state;
    const securityPolicy = resolveSecurityPolicy(runtimeConfig);
    assertProductionSecurityPolicy(securityPolicy, runtimeConfig);
    const searchConfig = cloneRuntimeSection(runtimeConfig.search, {});
    const protocolConfig = cloneRuntimeSection(runtimeConfig.protocol, {});
    const optimisticSyncConfig = cloneRuntimeSection(runtimeConfig.optimisticSync, {});
    const checkoutConfig = cloneRuntimeSection(runtimeConfig.checkout, {});
    const aiConfigBase = cloneRuntimeSection(runtimeConfig.ai, {});
    const analyticsConfigBase = cloneRuntimeSection(runtimeConfig.analytics, {});
    const consentConfig = cloneRuntimeSection(runtimeConfig.consent, {});
    const authConfig = cloneRuntimeSection(runtimeConfig.auth, {});
    const authUiConfig = cloneRuntimeSection(runtimeConfig.authUi, {});
    const notificationsConfig = cloneRuntimeSection(runtimeConfig.notifications, {});
    const offlineCacheConfig = cloneRuntimeSection(runtimeConfig.offlineCache, {});
    const shareConfig = cloneRuntimeSection(runtimeConfig.share, {});
    const fileUploadConfig = cloneRuntimeSection(runtimeConfig.fileUpload, {});
    const captchaConfig = cloneRuntimeSection(runtimeConfig.captcha, { adapter: 'captcha.cap' });
    const featureFlagsConfig = { endpoint: resolveOptionalSsmaEndpoint('/flags/client-config', runtimeConfig.featureFlags?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.featureFlags, {}) };
    const contentPrefetchConfig = { endpoint: resolveOptionalSsmaEndpoint('/content/manifest', runtimeConfig.contentPrefetch?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.contentPrefetch, {}) };
    const cmsContentConfig = { endpoint: resolveOptionalSsmaEndpoint('/content', runtimeConfig.cmsContent?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.cmsContent, {}) };
    const catalogConfig = { endpoint: resolveOptionalSsmaEndpoint('/catalog/items', runtimeConfig.catalog?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.catalog, {}) };
    const cartConfig = { validateEndpoint: resolveOptionalSsmaEndpoint('/cart/validate', runtimeConfig.cart?.validateEndpoint || runtimeConfig.cart?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.cart, {}) };
    const paymentAdaptersConfig = { sessionEndpoint: resolveOptionalSsmaEndpoint('/checkout/session', runtimeConfig.paymentAdapters?.sessionEndpoint || runtimeConfig.paymentAdapters?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.paymentAdapters, {}) };
    const reviewsConfig = { endpoint: resolveOptionalSsmaEndpoint('/reviews', runtimeConfig.reviews?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.reviews, {}) };
    const abTestingConfig = { assignEndpoint: resolveOptionalSsmaEndpoint('/experiments/assign', runtimeConfig.abTesting?.assignEndpoint || runtimeConfig.abTesting?.endpoint, runtimeConfig), exposureEndpoint: resolveOptionalSsmaEndpoint('/experiments/exposure', runtimeConfig.abTesting?.exposureEndpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.abTesting, {}) };
    const permissionsUiConfig = { endpoint: resolveOptionalSsmaEndpoint('/permissions/effective', runtimeConfig.permissionsUi?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.permissionsUi, {}) };
    const chartsConfig = { endpoint: resolveOptionalSsmaEndpoint('/metrics/query', runtimeConfig.charts?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.charts, {}) };
    const adminAuditLogConfig = { endpoint: resolveOptionalSsmaEndpoint('/admin/audit-log', runtimeConfig.adminAuditLog?.endpoint, runtimeConfig), exportEndpoint: resolveOptionalSsmaEndpoint('/admin/audit-log/export', runtimeConfig.adminAuditLog?.exportEndpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.adminAuditLog, {}) };
    const importExportConfig = { previewEndpoint: resolveOptionalSsmaEndpoint('/imports/preview', runtimeConfig.importExport?.previewEndpoint || runtimeConfig.importExport?.endpoint, runtimeConfig), exportEndpoint: resolveOptionalSsmaEndpoint('/exports/jobs', runtimeConfig.importExport?.exportEndpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.importExport, {}) };
    const commentsConfig = { endpoint: resolveOptionalSsmaEndpoint('/comments', runtimeConfig.comments?.endpoint, runtimeConfig), moderationEndpoint: resolveOptionalSsmaEndpoint('/comments', runtimeConfig.comments?.moderationEndpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.comments, {}) };
    const contentWorkflowConfig = { endpoint: resolveOptionalSsmaEndpoint('/workflow/items', runtimeConfig.contentWorkflow?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.contentWorkflow, {}) };
    const edgeSearchConfig = { endpoint: resolveOptionalSsmaEndpoint('/search', runtimeConfig.edgeSearch?.endpoint, runtimeConfig), ...cloneRuntimeSection(runtimeConfig.edgeSearch, {}) };
    const authEnabled = Boolean(FEATURES.AUTH_MODULE || FEATURES.AUTH_SERVICE);
    const offlineCacheEnabled = Boolean(FEATURES.OFFLINE_CACHE);
    const pwaEnabled = Boolean(FEATURES.PWA || offlineCacheEnabled);
    const networkStatusEnabled = Boolean(FEATURES.NETWORK_STATUS_MODULE || offlineCacheEnabled);
    const syncQueueEnabled = Boolean(FEATURES.SYNC_QUEUE || offlineCacheEnabled);
    const cacheManagerEnabled = Boolean(FEATURES.CACHE_MANAGER || offlineCacheEnabled);
    const consentEnabled = Boolean(FEATURES.CONSENT_MODULE || FEATURES.ANALYTICS_CONSENT);

    state.runtimeConfig = cloneRuntimeSection(runtimeConfig, {});
    state.securityPolicy = securityPolicy;

    const pageServices = initializePageServices(state, {
        pages,
        runtimeConfig,
        documentRef,
        windowRef
    });

    // PWA SW registration (early, sequential)
    if (pwaEnabled) {
        await runFeature('[PWA] Service worker registration failed:', async () => {
            if (!window.Capacitor && !window.Neutralino && 'serviceWorker' in navigator) {
                await navigator.serviceWorker.register(offlineCacheConfig.swUrl || '/sw.js', {
                    scope: offlineCacheConfig.scope,
                    type: 'module'
                });
                console.log('[PWA] Service worker registered');
            }
        });
    }

    // Wave A: network-status (required before sync-queue / optimistic-sync)
    if (networkStatusEnabled) {
        await runFeature('[NetworkStatus] Failed to load module:', async () => {
            await moduleManager.loadModule('network-status');
            const networkStatus = serviceManager.get('networkStatus');
            if (networkStatus) {
                networkStatus.options = {
                    ...(networkStatus.options || {}),
                    ...(offlineCacheConfig.pingUrl ? { pingUrl: offlineCacheConfig.pingUrl } : {}),
                    ...(typeof offlineCacheConfig.sampleInterval === 'number'
                        ? { sampleInterval: offlineCacheConfig.sampleInterval }
                        : {})
                };
            }
            networkStatus?.init();
            const csma = ensureCsma();
            csma.networkStatus = networkStatus;
            console.log('[NetworkStatus] Connectivity monitoring enabled');
        });
    }

    // Wave B: independent modules (no form / consent / fs / clientNav chain deps)
    // data-table stays here so it still loads before API_WRAPPER (schema may place
    // apiWrapper later; parallel does not wait on API — matching prior possible undefined api).
    await Promise.all([
        authEnabled && runFeature('[AuthService] Failed to initialize:', async () => {
            await moduleManager.loadModule('auth');
            const authService = serviceManager.get('auth');
            await initService(authService, {
                baseUrl: authConfig.baseUrl || apiBaseUrl,
                securityPolicy,
                ...authConfig
            });
            state.authServiceRef = authService;
            channelManager.setContextResolver(() => state.authServiceRef?.getUser?.());
            state.authAccessSubscription?.();
            state.authAccessSubscription = eventBus.subscribe('AUTH_SESSION_UPDATED', () => channelManager.reevaluateAccess());
            const csma = ensureCsma();
            csma.auth = authService;
            console.log('[AuthService] Session management ready');
        }),

        FEATURES.MODAL_SYSTEM && runFeature('[ModalSystem] Failed to load module:', async () => {
            await moduleManager.loadModule('modal-system');
            const modalService = serviceManager.get('modal');
            modalService?.init();
            const csma = ensureCsma();
            csma.modal = modalService;
            console.log('[ModalSystem] Modal stack enabled');
        }),

        FEATURES.CAPTCHA_MODULE && runFeature('[Captcha] Failed to load module:', async () => {
            await moduleManager.loadModule('captcha');
            const captcha = serviceManager.get('captcha');
            captcha?.init({
                adapter: 'captcha.cap',
                ...captchaConfig,
                adapterRegistry: registries.adapters
            });
            const csma = ensureCsma();
            csma.captcha = captcha;
            console.log('[Captcha] CAPTCHA provider orchestration enabled');
        }),

        FEATURES.DATA_TABLE_MODULE && runFeature('[DataTable] Failed to load module:', async () => {
            await moduleManager.loadModule('data-table');
            const dataTable = serviceManager.get('dataTable');
            const api = serviceManager.get('api');
            dataTable?.init({ apiService: api });
            const csma = ensureCsma();
            csma.dataTable = dataTable;
            console.log('[DataTable] Remote table utilities enabled');
        }),

        FEATURES.SEARCH_MODULE && runFeature('[Search] Failed to load module:', async () => {
            await moduleManager.loadModule('search');
            const searchService = serviceManager.get('search');
            searchService?.init({
                ...searchConfig,
                adapterRegistry: registries.adapters
            });
            const csma = ensureCsma();
            csma.search = searchService;
            console.log('[Search] Tiered search module enabled');
        }),

        FEATURES.FEATURE_FLAGS && runFeature('[FeatureFlags] Failed to load module:', async () => {
            await moduleManager.loadModule('feature-flags');
            const featureFlags = serviceManager.get('featureFlags');
            featureFlags?.init(featureFlagsConfig);
            const csma = ensureCsma();
            csma.featureFlags = featureFlags;
            console.log('[FeatureFlags] Client feature flags enabled');
        }),

        FEATURES.CONTENT_PREFETCH && runFeature('[ContentPrefetch] Failed to load module:', async () => {
            await moduleManager.loadModule('content-prefetch');
            const contentPrefetch = serviceManager.get('contentPrefetch');
            contentPrefetch?.init(contentPrefetchConfig);
            const csma = ensureCsma();
            csma.contentPrefetch = contentPrefetch;
            console.log('[ContentPrefetch] Route/content prefetch enabled');
        }),

        FEATURES.CMS_CONTENT && runFeature('[CMSContent] Failed to load module:', async () => {
            await moduleManager.loadModule('cms-content');
            const cmsContent = serviceManager.get('cmsContent');
            cmsContent?.init(cmsContentConfig);
            const csma = ensureCsma();
            csma.cmsContent = cmsContent;
            console.log('[CMSContent] Structured content loading enabled');
        }),

        FEATURES.CATALOG_MODULE && runFeature('[Catalog] Failed to load module:', async () => {
            await moduleManager.loadModule('catalog');
            const catalog = serviceManager.get('catalog');
            catalog?.init(catalogConfig);
            const csma = ensureCsma();
            csma.catalog = catalog;
            console.log('[Catalog] Catalog state and filters enabled');
        }),

        FEATURES.CART_MODULE && runFeature('[Cart] Failed to load module:', async () => {
            await moduleManager.loadModule('cart');
            const cart = serviceManager.get('cart');
            cart?.init(cartConfig);
            const csma = ensureCsma();
            csma.cart = cart;
            console.log('[Cart] Client cart state enabled');
        }),

        FEATURES.PAYMENT_ADAPTERS && runFeature('[PaymentAdapters] Failed to load module:', async () => {
            await moduleManager.loadModule('payment-adapters');
            const paymentAdapters = serviceManager.get('paymentAdapters');
            paymentAdapters?.init(paymentAdaptersConfig);
            const csma = ensureCsma();
            csma.paymentAdapters = paymentAdapters;
            console.log('[PaymentAdapters] Client payment adapters enabled');
        }),

        FEATURES.REVIEWS_MODULE && runFeature('[Reviews] Failed to load module:', async () => {
            await moduleManager.loadModule('reviews');
            const reviews = serviceManager.get('reviews');
            reviews?.init(reviewsConfig);
            const csma = ensureCsma();
            csma.reviews = reviews;
            console.log('[Reviews] Review state enabled');
        }),

        FEATURES.AB_TESTING && runFeature('[ABTesting] Failed to load module:', async () => {
            await moduleManager.loadModule('ab-testing');
            const abTesting = serviceManager.get('abTesting');
            abTesting?.init(abTestingConfig);
            const csma = ensureCsma();
            csma.abTesting = abTesting;
            console.log('[ABTesting] Experiment assignment enabled');
        }),

        FEATURES.PERMISSIONS_UI && runFeature('[PermissionsUI] Failed to load module:', async () => {
            await moduleManager.loadModule('permissions-ui');
            const permissionsUI = serviceManager.get('permissionsUI');
            permissionsUI?.init(permissionsUiConfig);
            const csma = ensureCsma();
            csma.permissionsUI = permissionsUI;
            console.log('[PermissionsUI] Capability-aware UI state enabled');
        }),

        FEATURES.CHARTS_MODULE && runFeature('[Charts] Failed to load module:', async () => {
            await moduleManager.loadModule('charts');
            const charts = serviceManager.get('charts');
            charts?.init(chartsConfig);
            const csma = ensureCsma();
            csma.charts = charts;
            console.log('[Charts] Dashboard chart state enabled');
        }),

        FEATURES.ADMIN_AUDIT_LOG && runFeature('[AdminAuditLog] Failed to load module:', async () => {
            await moduleManager.loadModule('admin-audit-log');
            const adminAuditLog = serviceManager.get('adminAuditLog');
            adminAuditLog?.init(adminAuditLogConfig);
            const csma = ensureCsma();
            csma.adminAuditLog = adminAuditLog;
            console.log('[AdminAuditLog] Audit log UI state enabled');
        }),

        FEATURES.IMPORT_EXPORT && runFeature('[ImportExport] Failed to load module:', async () => {
            await moduleManager.loadModule('import-export');
            const importExport = serviceManager.get('importExport');
            importExport?.init(importExportConfig);
            const csma = ensureCsma();
            csma.importExport = importExport;
            console.log('[ImportExport] Import/export preview enabled');
        }),

        FEATURES.COMMENTS_MODULE && runFeature('[Comments] Failed to load module:', async () => {
            await moduleManager.loadModule('comments');
            const comments = serviceManager.get('comments');
            comments?.init(commentsConfig);
            const csma = ensureCsma();
            csma.comments = comments;
            console.log('[Comments] Comment UI state enabled');
        }),

        FEATURES.CONTENT_WORKFLOW && runFeature('[ContentWorkflow] Failed to load module:', async () => {
            await moduleManager.loadModule('content-workflow');
            const contentWorkflow = serviceManager.get('contentWorkflow');
            contentWorkflow?.init(contentWorkflowConfig);
            const csma = ensureCsma();
            csma.contentWorkflow = contentWorkflow;
            console.log('[ContentWorkflow] Content workflow UI state enabled');
        }),

        FEATURES.EDGE_SEARCH && runFeature('[EdgeSearch] Failed to load module:', async () => {
            await moduleManager.loadModule('edge-search');
            const edgeSearch = serviceManager.get('edgeSearch');
            edgeSearch?.init(edgeSearchConfig);
            const csma = ensureCsma();
            csma.edgeSearch = edgeSearch;
            console.log('[EdgeSearch] Edge/static search client enabled');
        }),

        FEATURES.AI_MODULE && runFeature('[AI] Failed to load module:', async () => {
            await moduleManager.loadModule('ai');
            const aiService = serviceManager.get('ai');
            const aiConfig = cloneRuntimeSection(aiConfigBase, {});
            if (aiConfig.providers?.ssma && !aiConfig.providers.ssma.endpoint) {
                const queryName = aiConfig.providers.ssma.queryName || 'ai.generate';
                aiConfig.providers.ssma.endpoint = resolveSsmaHttpEndpoint(`/query/${encodeURIComponent(queryName)}`, undefined, runtimeConfig);
            }
            await initService(aiService, aiConfig);
            const csma = ensureCsma();
            csma.ai = aiService;
            console.log('[AI] Multi-provider AI orchestration enabled');
        }),

        FEATURES.SHARE_MODULE && runFeature('[Share] Failed to load module:', async () => {
            await moduleManager.loadModule('share');
            const share = serviceManager.get('share');
            share?.init(shareConfig);
            const csma = ensureCsma();
            csma.share = share;
            console.log('[Share] Web Share and clipboard fallback enabled');
        }),

        FEATURES.INDEXEDDB && runFeature('[Storage] Failed to load module:', async () => {
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
        }),

        FEATURES.THREAD_MANAGER && runFeature('[ThreadManager] Failed to load:', async () => {
            const { threadManager } = await import('../runtime/ThreadManager.js');
            const csma = ensureCsma();
            csma.threadManager = threadManager;
            console.log('[ThreadManager] Web Worker management enabled');
        }),

        FEATURES.ROUTER_MODULE && runFeature('[Router] Failed to load module:', async () => {
            await moduleManager.loadModule('router');
            const router = serviceManager.get('router');
            router?.init({
                ...(runtimeConfig.router || {}),
                viewRegistry: registries.views,
                clientNavigation: pageServices.clientNavigation
            });
            pageServices.router = router;
            const csma = ensureCsma();
            csma.router = router;
            console.log('[Router] SPA/hybrid routing enabled');
        }),

        FEATURES.LOCATION_MODULE && runFeature('[Location] Failed to load module:', async () => {
            await moduleManager.loadModule('location');
            const locationService = serviceManager.get('location');
            locationService?.init({ storageService: window.localStorage && {
                setItem: (key, value) => localStorage.setItem(key, value)
            }});
            const csma = ensureCsma();
            csma.location = locationService;
            console.log('[Location] Geolocation tracking enabled');
        }),

        FEATURES.DATA_AGGREGATOR && runFeature('[DataAggregator] Failed to load:', async () => {
            const { createDataAggregator } = await import('../services/core/DataAggregator.js');
            const dataAggregator = createDataAggregator(eventBus, {
                timeout: 30000,
                retries: 2,
                debug: import.meta.env.DEV
            });
            serviceManager.register('dataAggregator', dataAggregator);
            console.log('[DataAggregator] Initialized');
        }),

        FEATURES.FORM_VALIDATOR && runFeature('[FormValidator] Failed to load:', async () => {
            const { createFormValidator } = await import('../services/core/FormValidator.js');
            const formValidator = createFormValidator(eventBus, {
                debounceDelay: 300,
                debug: import.meta.env.DEV
            });
            serviceManager.register('formValidator', formValidator);
            console.log('[FormValidator] Initialized');
        })
    ].filter(Boolean));

    // Wave C: sync-queue (after network-status)
    if (syncQueueEnabled) {
        if (!networkStatusEnabled) {
            console.warn('[SyncQueue] Requires NETWORK_STATUS_MODULE feature. Skipping load.');
        } else {
            await runFeature('[SyncQueue] Failed to load module:', async () => {
                await moduleManager.loadModule('sync-queue');
                const syncQueue = serviceManager.get('syncQueue');
                const networkStatus = serviceManager.get('networkStatus');
                const storageService = window.localStorage && {
                    getItem: (key) => localStorage.getItem(key),
                    setItem: (key, value) => localStorage.setItem(key, value)
                };
                syncQueue?.init({ networkStatusService: networkStatus, storageService });
                const csma = ensureCsma();
                csma.syncQueue = syncQueue;
                console.log('[SyncQueue] Offline queue ready');
            });
        }
    }

    // Wave D: optimistic-sync (after network; keeps post-sync relative order)
    if (FEATURES.OPTIMISTIC_SYNC) {
        await runFeature('[OptimisticSync] Failed to load module:', async () => {
            await moduleManager.loadModule('optimistic-sync');
            const actionLogService = serviceManager.get('actionLog');
            const optimisticSync = serviceManager.get('optimisticSync');
            const transportService = serviceManager.get('optimisticTransport');
            await initService(actionLogService);
            await initService(transportService, {
                leaderService: serviceManager.get('leader'),
                endpoint: resolveSsmaWsEndpoint('/optimistic/ws', optimisticSyncConfig.wsEndpoint, runtimeConfig),
                eventsEndpoint: resolveSsmaHttpEndpoint('/optimistic/events', optimisticSyncConfig.eventsEndpoint, runtimeConfig),
                channelManager,
                securityPolicy,
                subprotocol: protocolConfig.subprotocol
            });
            await initService(optimisticSync, {
                actionLogService,
                leaderService: serviceManager.get('leader'),
                networkStatusService: serviceManager.get('networkStatus'),
                transportService
            });
            const csma = ensureCsma();
            csma.optimisticSync = optimisticSync;
            csma.actionLog = actionLogService;
            csma.optimisticTransport = transportService;
            console.log('[OptimisticSync] Optimistic sync enabled');
        });
    }

    // Wave E: form-management (after captcha may be present; uses syncQueue if loaded)
    if (FEATURES.FORM_MANAGEMENT) {
        await runFeature('[FormManagement] Failed to load module:', async () => {
            await moduleManager.loadModule('form-management');
            const formManager = serviceManager.get('formManager');
            const syncQueue = serviceManager.get('syncQueue');
            const captcha = serviceManager.get('captcha');
            const storageAdapter = window.localStorage && {
                getItem: (key) => localStorage.getItem(key),
                setItem: (key, value) => localStorage.setItem(key, value),
                removeItem: (key) => localStorage.removeItem(key)
            };
            formManager?.init({
                storageService: storageAdapter,
                syncQueueService: syncQueue,
                securityPolicy,
                captchaService: captcha,
                integrityService: serviceManager.get('integrityService') || serviceManager.get('hmac')
            });
            const csma = ensureCsma();
            csma.form = formManager;
            console.log('[FormManagement] Form orchestration enabled');
        });
    }

    // Wave F: auth-ui + checkout (need form; auth-ui also needs auth)
    await Promise.all([
        FEATURES.AUTH_UI_MODULE && (async () => {
            if (!FEATURES.FORM_MANAGEMENT || !authEnabled) {
                console.warn('[AuthUI] Requires FORM_MANAGEMENT and AUTH_SERVICE. Skipping load.');
                return;
            }
            await runFeature('[AuthUI] Failed to load module:', async () => {
                await moduleManager.loadModule('auth-ui');
                const authUI = serviceManager.get('authUI');
                const authService = serviceManager.get('auth');
                const formManager = serviceManager.get('formManager');
                const modalService = serviceManager.get('modal');
                const captchaService = serviceManager.get('captcha');
                authUI?.init({
                    authService,
                    formService: formManager,
                    captchaService,
                    modalService,
                    documentRef,
                    config: authUiConfig
                });
                const csma = ensureCsma();
                csma.authUI = authUI;
                console.log('[AuthUI] Authentication UI orchestration enabled');
            });
        })(),

        FEATURES.CHECKOUT_MODULE && (async () => {
            if (!FEATURES.FORM_MANAGEMENT) {
                console.warn('[Checkout] Requires FORM_MANAGEMENT. Skipping load.');
                return;
            }
            await runFeature('[Checkout] Failed to load module:', async () => {
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
                    allowGuestOptimistic: Boolean(checkoutConfig.allowGuestCheckout ?? optimisticSyncConfig.allowGuestCheckout)
                });
                const csma = ensureCsma();
                csma.checkout = checkout;
                console.log('[Checkout] Checkout orchestration enabled');
            });
        })()
    ].filter(Boolean));

    // Wave G: consent (before notifications / analytics)
    let consentService = null;
    if (consentEnabled) {
        await runFeature('[Consent] Failed to load module:', async () => {
            await moduleManager.loadModule('consent');
            consentService = serviceManager.get('consent');
            consentService?.init(consentConfig);
            const csma = ensureCsma();
            csma.consent = consentService;
            csma.analyticsConsent = consentService;
            csma.seoAudit = auditPage;
            state.consentCleanup?.();
            state.consentCleanup = initConsentUI(consentService, documentRef);
            state.analyticsConsentCleanup = null;
            console.log('[Consent] Consent preferences enabled');
        });
    }

    // Wave H: notifications + analytics (receive consentService when present)
    await Promise.all([
        FEATURES.NOTIFICATIONS_MODULE && runFeature('[Notifications] Failed to load module:', async () => {
            await moduleManager.loadModule('notifications');
            const notifications = serviceManager.get('notifications');
            notifications?.init({
                consent: consentService,
                ...notificationsConfig
            });
            const csma = ensureCsma();
            csma.notifications = notifications;
            console.log('[Notifications] Notification center and browser delivery enabled');
        }),

        FEATURES.ANALYTICS_MODULE && runFeature('[Analytics] Failed to load module:', async () => {
            await moduleManager.loadModule('analytics');
            const analyticsConfig = cloneRuntimeSection(analyticsConfigBase, {});
            const analyticsService = serviceManager.get('analytics');
            await analyticsService.init({
                ...analyticsConfig,
                endpoint: buildLogEndpoint(analyticsConfig.endpoint, runtimeConfig),
                ...(consentService ? { consent: consentService } : {})
            });
            const csma = ensureCsma();
            csma.analytics = analyticsService;
            if (consentService) {
                csma.analyticsConsent = consentService;
            }
            csma.seoAudit = auditPage;
            console.log('[Analytics] Web analytics module enabled');
        })
    ].filter(Boolean));

    // Wave I: i18n then meta-manager (sequential inside block)
    if (FEATURES.I18N) {
        await runFeature('[i18n] Failed to load module:', async () => {
            await moduleManager.loadModule('i18n');
            const i18nService = serviceManager.get('I18n');
            state.i18nServiceRef = i18nService;

            if (i18nService) {
                const locale = localStorage.getItem('locale') || 'en';
                const translations = await fetch(`/locales/${locale}.json`).then(r => r.json());
                await i18nService.loadLocale(locale, translations);

                if (i18nService.locale !== locale && i18nService.hasLocale(locale)) {
                    i18nService.setLocale(locale);
                }

                console.log('[i18n] Translations loaded:', locale);
            }

            await moduleManager.loadModule('meta-manager');
            const metaManagerModule = serviceManager.get('metaManagerModule');
            metaManagerModule?.init({
                metaManager: state.metaManager,
                i18nService
            });
            const csma = ensureCsma();
            csma.i18n = i18nService;
            csma.metaManagerModule = metaManagerModule;
        });
    }

    // Wave J: clientNavigation (after router if present)
    if (FEATURES.CLIENT_NAVIGATION) {
        await runFeature('[ClientNavigation] Failed to initialize:', async () => {
            const router = pageServices.router || serviceManager.get('router');
            const runtimeNavigationConfig = runtimeConfig.clientNavigation || {};
            pageServices.clientNavigation?.init({
                pageResolver: pageServices.pageResolver,
                canHandlePath: typeof runtimeNavigationConfig.canHandlePath === 'function'
                    ? runtimeNavigationConfig.canHandlePath
                    : router?.canHandlePath?.bind(router),
                handlePath: typeof runtimeNavigationConfig.handlePath === 'function'
                    ? runtimeNavigationConfig.handlePath
                    : router?.handlePath?.bind(router),
                windowRef,
                documentRef
            });
            const csma = ensureCsma();
            csma.clientNavigation = pageServices.clientNavigation;
            console.log('[ClientNavigation] History API navigation enabled');
        });
    }

    // Wave K: file-system then file-upload + media in parallel
    if (FEATURES.FILE_SYSTEM) {
        await runFeature('[FileSystem] Failed to load module:', async () => {
            await moduleManager.loadModule('file-system');
            const fileSystemService = serviceManager.get('fileSystem');
            if (fileSystemService?.configure) {
                fileSystemService.configure({
                    metadataStoreName: 'csma-file-index',
                    storageRoot: '/user-files'
                });
            }
            await initService(fileSystemService);
            const csma = ensureCsma();
            csma.fileSystem = fileSystemService;
            console.log('[FileSystem] Hybrid storage enabled');
        });
    }

    // Media deprecation aliases (before MEDIA load, same as before)
    if (FEATURES.CAMERA_MODULE || FEATURES.MEDIA_CAPTURE || FEATURES.MEDIA_TRANSFORM || FEATURES.IMAGE_OPTIMIZER) {
        if (!FEATURES.MEDIA) {
            const sources = [];
            if (FEATURES.CAMERA_MODULE) sources.push('CAMERA_MODULE');
            if (FEATURES.MEDIA_CAPTURE) sources.push('MEDIA_CAPTURE');
            if (FEATURES.MEDIA_TRANSFORM) sources.push('MEDIA_TRANSFORM');
            if (FEATURES.IMAGE_OPTIMIZER) sources.push('IMAGE_OPTIMIZER');
            console.warn(`[Features] ${sources.join(', ')} ${sources.length === 1 ? 'is' : 'are'} deprecated, use MEDIA`);
            FEATURES.MEDIA = true;
        }
    }

    await Promise.all([
        FEATURES.FILE_UPLOAD && runFeature('[FileUpload] Failed to load module:', async () => {
            await moduleManager.loadModule('file-upload');
            const fileUpload = serviceManager.get('fileUpload');
            const fileSystemService = serviceManager.get('fileSystem');
            const syncQueue = serviceManager.get('syncQueue');
            const networkStatus = serviceManager.get('networkStatus');
            const captcha = serviceManager.get('captcha');
            const storageAdapter = window.localStorage && {
                getItem: (key) => localStorage.getItem(key),
                setItem: (key, value) => localStorage.setItem(key, value),
                removeItem: (key) => localStorage.removeItem(key)
            };
            await initService(fileUpload, {
                storage: storageAdapter,
                fileSystem: fileSystemService,
                syncQueue,
                networkStatus,
                captchaService: captcha,
                ...fileUploadConfig
            });
            const csma = ensureCsma();
            csma.fileUpload = fileUpload;
            console.log('[FileUpload] Resumable upload utilities enabled');
        }),

        FEATURES.MEDIA && runFeature('[Media] Failed to load module:', async () => {
            await moduleManager.loadModule('media');
            const mediaService = serviceManager.get('media');
            const fileSystemService = serviceManager.get('fileSystem');
            mediaService?.init({ fileSystemService });
            const csma = ensureCsma();
            csma.media = mediaService;
            // Legacy aliases for backward compat
            csma.camera = mediaService;
            csma.mediaCapture = mediaService;
            csma.mediaTransform = mediaService;
            csma.imageOptimizer = mediaService;
            console.log('[Media] Photo, video, audio, screen capture + image optimization enabled');
        })
    ].filter(Boolean));

    // Wave L: cacheManager (INDEXEDDB may already be loaded; backend is flag-driven)
    if (cacheManagerEnabled) {
        await runFeature('[CacheManager] Failed to load:', async () => {
            const { createCacheManager } = await import('../services/core/CacheManager.js');
            const cacheConfig = cloneRuntimeSection(runtimeConfig.cache, {});
            const cacheManager = createCacheManager(eventBus, {
                backend: cacheConfig.backend || offlineCacheConfig.backend || (FEATURES.INDEXEDDB ? 'indexeddb' : 'localStorage'),
                defaultTTL: cacheConfig.defaultTTL || offlineCacheConfig.defaultTTL || 5 * 60 * 1000,
                maxSize: cacheConfig.maxSize || offlineCacheConfig.maxSize || 10 * 1024 * 1024,
                debug: import.meta.env.DEV
            });
            serviceManager.register('cacheManager', cacheManager);
            await cacheManager.init?.();
            const csma = ensureCsma();
            csma.cacheManager = cacheManager;
            console.log('[CacheManager] Initialized');
        });
    }

    // API wrapper after data-table wave (preserves prior relative timing vs data-table)
    if (FEATURES.API_WRAPPER) {
        await runFeature('[APIWrapper] Failed to load:', async () => {
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
        });
    }

    if (!securityPolicy.globals?.exposeInternals && window.csma) {
        for (const key of [
            'eventBus',
            'serviceManager',
            'moduleManager',
            'channels',
            'leader',
            'metaManager',
            'metaManagerModule',
            'pageResolver',
            'clientNavigation',
            'logAccumulator',
            'registries',
            'runtimeConfig',
            'optimisticTransport',
            'actionLog',
            'syncQueue',
            'cacheManager',
            'fileSystem'
        ]) {
            delete window.csma[key];
        }
    }
}
