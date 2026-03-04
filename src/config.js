import { platformCapabilities } from './utils/platform.js';

/**
 * Feature Configuration
 * Toggle features on/off with tree-shaking support
 */
export const FEATURES = {
    // Core Features (always enabled)
    VALIDATION: true,
    EVENT_BUS: true,
    SERVICE_MANAGER: true,

    // Optional Features (can be disabled)
    PWA: false,           // Service Worker + offline support
    ROUTER: false,        // SPA routing
    I18N: false,          // Translations
    INDEXEDDB: false,     // Local database

    // LLM Features (Tier 2.5)
    LLM_INSTRUCTOR: false,  // Structured LLM extraction (requires API key)

    // Core Services (Tier 3) - NEW
    CACHE_MANAGER: true,      // Recommended: true (offline-first, performance)
    DATA_AGGREGATOR: true,    // Recommended: true (complex UIs)
    API_WRAPPER: true,        // Recommended: true (centralized HTTP client)
    AUTH_SERVICE: true,       // Cookie-backed auth client
    FORM_VALIDATOR: false,    // Optional (nice to have)
    FORM_MANAGEMENT: true,    // Form state management module
    MODAL_SYSTEM: true,       // Modal stack controller
    AUTH_UI_MODULE: false,    // Auth UI orchestration
    CHECKOUT_MODULE: true,    // Checkout flow orchestration
    HMAC_INTEGRITY: false,    // Shared HMAC signing service for public forms
    DATA_TABLE_MODULE: false, // Data table utilities
    SEARCH_MODULE: false,     // FlexSearch-powered module
    ANALYTICS_CONSENT: false, // Centralized analytics consent/telemetry gating
    AI_MODULE: false,         // Multi-provider AI orchestration
    MEDIA_CAPTURE: false,     // Audio recording module (requires user permission)
    CAMERA_MODULE: false,     // Photo/video capture module
    LOCATION_MODULE: false,   // Geolocation tracking + geofence
    MEDIA_TRANSFORM: false,   // Client-side media conversions
    IMAGE_OPTIMIZER: false,   // High-level image optimization API
    NETWORK_STATUS_MODULE: true,  // Online/offline detection + latency
    SYNC_QUEUE: true,         // Background sync queue
    OPTIMISTIC_SYNC: true,    // Action log + optimistic sync module
    STATIC_RENDER: true,

    // Dev Tools (auto-enabled in development)
    DEVTOOLS: import.meta.env.DEV,

    // Analytics
    LOG_ACCUMULATOR: true,
    META_MANAGER: true,

    // Web Workers (Tier 4 - Advanced)
    THREAD_MANAGER: false,   // Enable for CPU-intensive operations

    // Platform-Specific Features (runtime-detected)
    FILE_SYSTEM: platformCapabilities.fileSystem(),     // File system access
    CAMERA: platformCapabilities.camera(),              // Camera/photo access
    NOTIFICATIONS: platformCapabilities.notifications(), // Push notifications
    SERVICE_WORKER: platformCapabilities.serviceWorker(), // PWA service worker
    GEOLOCATION: platformCapabilities.geolocation(),     // GPS location
    VIBRATION: platformCapabilities.vibration(),         // Haptic feedback
};

/**
 * Get feature status
 */
export function isEnabled(feature) {
    return FEATURES[feature] === true;
}

/**
 * Runtime feature check
 */
export function requireFeature(feature) {
    if (!isEnabled(feature)) {
        throw new Error(`Feature "${feature}" is not enabled. Enable it in src/config.js`);
    }
}

export const SEARCH_CONFIG = {
    tier: 'core',
    indexName: 'default',
    variant: 'light',
    persistence: false,
    pageSize: 20,
    facets: ['category', 'tags'],
    suggestions: {
        enabled: true,
        max: 5
    },
    context: {
        documents: 5,
        charLimit: 4000
    }
};

export const STATIC_RENDER_CONFIG = {
    enabled: true,
    pagesDir: './src/pages',
    outputDir: './dist/pages'
};

export const PROTOCOL = {
    subprotocol: '1.0.0'
};
