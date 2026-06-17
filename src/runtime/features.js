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

    state.runtimeConfig = cloneRuntimeSection(runtimeConfig, {});
    state.securityPolicy = securityPolicy;

    const pageServices = initializePageServices(state, {
        pages,
        runtimeConfig,
        documentRef,
        windowRef
    });

    if (pwaEnabled) {
        try {
            if (!window.Capacitor && !window.Neutralino && 'serviceWorker' in navigator) {
                await navigator.serviceWorker.register(offlineCacheConfig.swUrl || '/sw.js', {
                    scope: offlineCacheConfig.scope,
                    type: 'module'
                });
                console.log('[PWA] Service worker registered');
            }
        } catch (error) {
            console.warn('[PWA] Service worker registration failed:', error);
        }
    }

    if (networkStatusEnabled) {
        try {
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
            window.csma = window.csma || {};
            window.csma.networkStatus = networkStatus;
            console.log('[NetworkStatus] Connectivity monitoring enabled');
        } catch (error) {
            console.warn('[NetworkStatus] Failed to load module:', error);
        }
    }

    if (authEnabled) {
        try {
            await moduleManager.loadModule('auth');
            const authService = serviceManager.get('auth');
            await authService?.init({
                baseUrl: authConfig.baseUrl || apiBaseUrl,
                securityPolicy,
                ...authConfig
            });
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

    if (syncQueueEnabled) {
        if (!networkStatusEnabled) {
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
                endpoint: resolveSsmaWsEndpoint('/optimistic/ws', optimisticSyncConfig.wsEndpoint, runtimeConfig),
                eventsEndpoint: resolveSsmaHttpEndpoint('/optimistic/events', optimisticSyncConfig.eventsEndpoint, runtimeConfig),
                channelManager,
                securityPolicy,
                subprotocol: protocolConfig.subprotocol
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

    if (FEATURES.CAPTCHA_MODULE) {
        try {
            await moduleManager.loadModule('captcha');
            const captcha = serviceManager.get('captcha');
            captcha?.init({
                adapter: 'captcha.cap',
                ...captchaConfig,
                adapterRegistry: registries.adapters
            });
            window.csma = window.csma || {};
            window.csma.captcha = captcha;
            console.log('[Captcha] CAPTCHA provider orchestration enabled');
        } catch (error) {
            console.warn('[Captcha] Failed to load module:', error);
        }
    }

    if (FEATURES.FORM_MANAGEMENT) {
        try {
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
            window.csma = window.csma || {};
            window.csma.form = formManager;
            console.log('[FormManagement] Form orchestration enabled');
        } catch (error) {
            console.warn('[FormManagement] Failed to load module:', error);
        }
    }

    if (FEATURES.AUTH_UI_MODULE) {
        if (!FEATURES.FORM_MANAGEMENT || !authEnabled) {
            console.warn('[AuthUI] Requires FORM_MANAGEMENT and AUTH_SERVICE. Skipping load.');
        } else {
            try {
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
                    allowGuestOptimistic: Boolean(checkoutConfig.allowGuestCheckout ?? optimisticSyncConfig.allowGuestCheckout)
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
            searchService?.init({
                ...searchConfig,
                adapterRegistry: registries.adapters
            });
            window.csma = window.csma || {};
            window.csma.search = searchService;
            console.log('[Search] Tiered search module enabled');
        } catch (error) {
            console.warn('[Search] Failed to load module:', error);
        }
    }

    if (FEATURES.FEATURE_FLAGS) {
        try {
            await moduleManager.loadModule('feature-flags');
            const featureFlags = serviceManager.get('featureFlags');
            featureFlags?.init(featureFlagsConfig);
            window.csma = window.csma || {};
            window.csma.featureFlags = featureFlags;
            console.log('[FeatureFlags] Client feature flags enabled');
        } catch (error) {
            console.warn('[FeatureFlags] Failed to load module:', error);
        }
    }

    if (FEATURES.CONTENT_PREFETCH) {
        try {
            await moduleManager.loadModule('content-prefetch');
            const contentPrefetch = serviceManager.get('contentPrefetch');
            contentPrefetch?.init(contentPrefetchConfig);
            window.csma = window.csma || {};
            window.csma.contentPrefetch = contentPrefetch;
            console.log('[ContentPrefetch] Route/content prefetch enabled');
        } catch (error) {
            console.warn('[ContentPrefetch] Failed to load module:', error);
        }
    }

    if (FEATURES.CMS_CONTENT) {
        try {
            await moduleManager.loadModule('cms-content');
            const cmsContent = serviceManager.get('cmsContent');
            cmsContent?.init(cmsContentConfig);
            window.csma = window.csma || {};
            window.csma.cmsContent = cmsContent;
            console.log('[CMSContent] Structured content loading enabled');
        } catch (error) {
            console.warn('[CMSContent] Failed to load module:', error);
        }
    }

    if (FEATURES.CATALOG_MODULE) {
        try {
            await moduleManager.loadModule('catalog');
            const catalog = serviceManager.get('catalog');
            catalog?.init(catalogConfig);
            window.csma = window.csma || {};
            window.csma.catalog = catalog;
            console.log('[Catalog] Catalog state and filters enabled');
        } catch (error) {
            console.warn('[Catalog] Failed to load module:', error);
        }
    }

    if (FEATURES.CART_MODULE) {
        try {
            await moduleManager.loadModule('cart');
            const cart = serviceManager.get('cart');
            cart?.init(cartConfig);
            window.csma = window.csma || {};
            window.csma.cart = cart;
            console.log('[Cart] Client cart state enabled');
        } catch (error) {
            console.warn('[Cart] Failed to load module:', error);
        }
    }

    if (FEATURES.PAYMENT_ADAPTERS) {
        try {
            await moduleManager.loadModule('payment-adapters');
            const paymentAdapters = serviceManager.get('paymentAdapters');
            paymentAdapters?.init(paymentAdaptersConfig);
            window.csma = window.csma || {};
            window.csma.paymentAdapters = paymentAdapters;
            console.log('[PaymentAdapters] Client payment adapters enabled');
        } catch (error) {
            console.warn('[PaymentAdapters] Failed to load module:', error);
        }
    }

    if (FEATURES.REVIEWS_MODULE) {
        try {
            await moduleManager.loadModule('reviews');
            const reviews = serviceManager.get('reviews');
            reviews?.init(reviewsConfig);
            window.csma = window.csma || {};
            window.csma.reviews = reviews;
            console.log('[Reviews] Review state enabled');
        } catch (error) {
            console.warn('[Reviews] Failed to load module:', error);
        }
    }

    if (FEATURES.AB_TESTING) {
        try {
            await moduleManager.loadModule('ab-testing');
            const abTesting = serviceManager.get('abTesting');
            abTesting?.init(abTestingConfig);
            window.csma = window.csma || {};
            window.csma.abTesting = abTesting;
            console.log('[ABTesting] Experiment assignment enabled');
        } catch (error) {
            console.warn('[ABTesting] Failed to load module:', error);
        }
    }

    if (FEATURES.PERMISSIONS_UI) {
        try {
            await moduleManager.loadModule('permissions-ui');
            const permissionsUI = serviceManager.get('permissionsUI');
            permissionsUI?.init(permissionsUiConfig);
            window.csma = window.csma || {};
            window.csma.permissionsUI = permissionsUI;
            console.log('[PermissionsUI] Capability-aware UI state enabled');
        } catch (error) {
            console.warn('[PermissionsUI] Failed to load module:', error);
        }
    }

    if (FEATURES.CHARTS_MODULE) {
        try {
            await moduleManager.loadModule('charts');
            const charts = serviceManager.get('charts');
            charts?.init(chartsConfig);
            window.csma = window.csma || {};
            window.csma.charts = charts;
            console.log('[Charts] Dashboard chart state enabled');
        } catch (error) {
            console.warn('[Charts] Failed to load module:', error);
        }
    }

    if (FEATURES.ADMIN_AUDIT_LOG) {
        try {
            await moduleManager.loadModule('admin-audit-log');
            const adminAuditLog = serviceManager.get('adminAuditLog');
            adminAuditLog?.init(adminAuditLogConfig);
            window.csma = window.csma || {};
            window.csma.adminAuditLog = adminAuditLog;
            console.log('[AdminAuditLog] Audit log UI state enabled');
        } catch (error) {
            console.warn('[AdminAuditLog] Failed to load module:', error);
        }
    }

    if (FEATURES.IMPORT_EXPORT) {
        try {
            await moduleManager.loadModule('import-export');
            const importExport = serviceManager.get('importExport');
            importExport?.init(importExportConfig);
            window.csma = window.csma || {};
            window.csma.importExport = importExport;
            console.log('[ImportExport] Import/export preview enabled');
        } catch (error) {
            console.warn('[ImportExport] Failed to load module:', error);
        }
    }

    if (FEATURES.COMMENTS_MODULE) {
        try {
            await moduleManager.loadModule('comments');
            const comments = serviceManager.get('comments');
            comments?.init(commentsConfig);
            window.csma = window.csma || {};
            window.csma.comments = comments;
            console.log('[Comments] Comment UI state enabled');
        } catch (error) {
            console.warn('[Comments] Failed to load module:', error);
        }
    }

    if (FEATURES.CONTENT_WORKFLOW) {
        try {
            await moduleManager.loadModule('content-workflow');
            const contentWorkflow = serviceManager.get('contentWorkflow');
            contentWorkflow?.init(contentWorkflowConfig);
            window.csma = window.csma || {};
            window.csma.contentWorkflow = contentWorkflow;
            console.log('[ContentWorkflow] Content workflow UI state enabled');
        } catch (error) {
            console.warn('[ContentWorkflow] Failed to load module:', error);
        }
    }

    if (FEATURES.EDGE_SEARCH) {
        try {
            await moduleManager.loadModule('edge-search');
            const edgeSearch = serviceManager.get('edgeSearch');
            edgeSearch?.init(edgeSearchConfig);
            window.csma = window.csma || {};
            window.csma.edgeSearch = edgeSearch;
            console.log('[EdgeSearch] Edge/static search client enabled');
        } catch (error) {
            console.warn('[EdgeSearch] Failed to load module:', error);
        }
    }

    if (FEATURES.AI_MODULE) {
        try {
            await moduleManager.loadModule('ai');
            const aiService = serviceManager.get('ai');
            const aiConfig = cloneRuntimeSection(aiConfigBase, {});
            if (aiConfig.providers?.ssma && !aiConfig.providers.ssma.endpoint) {
                const queryName = aiConfig.providers.ssma.queryName || 'ai.generate';
                aiConfig.providers.ssma.endpoint = resolveSsmaHttpEndpoint(`/query/${encodeURIComponent(queryName)}`, undefined, runtimeConfig);
            }
            await aiService?.init(aiConfig);
            window.csma = window.csma || {};
            window.csma.ai = aiService;
            console.log('[AI] Multi-provider AI orchestration enabled');
        } catch (error) {
            console.warn('[AI] Failed to load module:', error);
        }
    }

    const consentEnabled = Boolean(FEATURES.CONSENT_MODULE || FEATURES.ANALYTICS_CONSENT);
    let consentService = null;

    if (consentEnabled) {
        try {
            await moduleManager.loadModule('consent');
            consentService = serviceManager.get('consent');
            consentService?.init(consentConfig);
            window.csma = window.csma || {};
            window.csma.consent = consentService;
            window.csma.analyticsConsent = consentService;
            window.csma.seoAudit = auditPage;
            state.consentCleanup?.();
            state.consentCleanup = initConsentUI(consentService, documentRef);
            state.analyticsConsentCleanup = null;
            console.log('[Consent] Consent preferences enabled');
        } catch (error) {
            console.warn('[Consent] Failed to load module:', error);
        }
    }

    if (FEATURES.NOTIFICATIONS_MODULE) {
        try {
            await moduleManager.loadModule('notifications');
            const notifications = serviceManager.get('notifications');
            notifications?.init({
                consent: consentService,
                ...notificationsConfig
            });
            window.csma = window.csma || {};
            window.csma.notifications = notifications;
            console.log('[Notifications] Notification center and browser delivery enabled');
        } catch (error) {
            console.warn('[Notifications] Failed to load module:', error);
        }
    }

    if (FEATURES.ANALYTICS_MODULE) {
        try {
            await moduleManager.loadModule('analytics');
            const analyticsConfig = cloneRuntimeSection(analyticsConfigBase, {});
            const analyticsService = serviceManager.get('analytics');
            await analyticsService.init({
                ...analyticsConfig,
                endpoint: buildLogEndpoint(analyticsConfig.endpoint, runtimeConfig),
                ...(consentService ? { consent: consentService } : {})
            });
            window.csma = window.csma || {};
            window.csma.analytics = analyticsService;
            if (consentService) {
                window.csma.analyticsConsent = consentService;
            }
            window.csma.seoAudit = auditPage;
            console.log('[Analytics] Web analytics module enabled');
        } catch (error) {
            console.warn('[Analytics] Failed to load module:', error);
        }
    }

    if (FEATURES.SHARE_MODULE) {
        try {
            await moduleManager.loadModule('share');
            const share = serviceManager.get('share');
            share?.init(shareConfig);
            window.csma = window.csma || {};
            window.csma.share = share;
            console.log('[Share] Web Share and clipboard fallback enabled');
        } catch (error) {
            console.warn('[Share] Failed to load module:', error);
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
            window.csma = window.csma || {};
            window.csma.i18n = i18nService;
            window.csma.metaManagerModule = metaManagerModule;
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

    if (FEATURES.ROUTER_MODULE) {
        try {
            await moduleManager.loadModule('router');
            const router = serviceManager.get('router');
            router?.init({
                ...(runtimeConfig.router || {}),
                viewRegistry: registries.views,
                clientNavigation: pageServices.clientNavigation
            });
            pageServices.router = router;
            window.csma = window.csma || {};
            window.csma.router = router;
            console.log('[Router] SPA/hybrid routing enabled');
        } catch (error) {
            console.warn('[Router] Failed to load module:', error);
        }
    }

    if (FEATURES.CLIENT_NAVIGATION) {
        try {
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
            window.csma = window.csma || {};
            window.csma.clientNavigation = pageServices.clientNavigation;
            console.log('[ClientNavigation] History API navigation enabled');
        } catch (error) {
            console.warn('[ClientNavigation] Failed to initialize:', error);
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

    if (FEATURES.FILE_UPLOAD) {
        try {
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
            await fileUpload?.init({
                storage: storageAdapter,
                fileSystem: fileSystemService,
                syncQueue,
                networkStatus,
                captchaService: captcha,
                ...fileUploadConfig
            });
            window.csma = window.csma || {};
            window.csma.fileUpload = fileUpload;
            console.log('[FileUpload] Resumable upload utilities enabled');
        } catch (error) {
            console.warn('[FileUpload] Failed to load module:', error);
        }
    }

    // ─── Media Module (unified) ───────────────────────────
    // Alias old flags to FEATURES.MEDIA for deprecation window
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

    if (FEATURES.MEDIA) {
        try {
            await moduleManager.loadModule('media');
            const mediaService = serviceManager.get('media');
            const fileSystemService = serviceManager.get('fileSystem');
            mediaService?.init({ fileSystemService });
            window.csma = window.csma || {};
            window.csma.media = mediaService;
            // Legacy aliases for backward compat
            window.csma.camera = mediaService;
            window.csma.mediaCapture = mediaService;
            window.csma.mediaTransform = mediaService;
            window.csma.imageOptimizer = mediaService;
            console.log('[Media] Photo, video, audio, screen capture + image optimization enabled');
        } catch (error) {
            console.warn('[Media] Failed to load module:', error);
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

    // MEDIA_TRANSFORM and IMAGE_OPTIMIZER handled by unified MEDIA module above

    if (cacheManagerEnabled) {
        try {
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
            window.csma = window.csma || {};
            window.csma.cacheManager = cacheManager;
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
