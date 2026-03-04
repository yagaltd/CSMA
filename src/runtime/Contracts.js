/**
 * CSMA Contracts
 * All event/intent schemas with validation
 * Now using our forked validation library!
 */
import { object, string, number, boolean, enums, optional, size, array, any } from './validation/index.js';
import { FileSystemContracts } from '../modules/file-system/contracts/file-system-contracts.js';
import { MediaCaptureContracts } from '../modules/media-capture/contracts/media-capture-contracts.js';
import { CameraContracts } from '../modules/camera/contracts/camera-contracts.js';
import { LocationContracts } from '../modules/location/contracts/location-contracts.js';
import { MediaTransformContracts } from '../modules/media-transform/contracts/media-transform-contracts.js';
import { ImageOptimizerContracts } from '../modules/image-optimizer/contracts/image-optimizer-contracts.js';
import { NetworkStatusContracts } from '../modules/network-status/contracts/network-status-contracts.js';
import { SyncQueueContracts } from '../modules/sync-queue/contracts/sync-queue-contracts.js';
import { FormManagementContracts } from '../modules/form-management/contracts/form-management-contracts.js';
import { ModalSystemContracts } from '../modules/modal-system/contracts/modal-system-contracts.js';
import { DataTableContracts } from '../modules/data-table/contracts/data-table-contracts.js';
import { CheckoutContracts } from '../modules/checkout/contracts/checkout-contracts.js';
import { SearchContracts } from '../modules/search/contracts/search-contracts.js';
import { AIContracts } from '../modules/ai/contracts/ai-contracts.js';
import { ExampleModuleContracts } from '../modules/example-module/contracts/example-contracts.js';
import { StaticRenderContracts } from '../modules/static-render/contracts/island-contracts.js';
const AnalyticsContracts = {};

/**
 * Helper function for creating contracts with full ECCA metadata
 * 
 * @param {Object} metadata - Contract metadata (version, type, owner, lifecycle, etc.)
 * @param {Object} schema - Superstruct schema for payload validation
 * @returns {Object} Complete contract object
 */
export function contract(metadata, schema) {
    return {
        // Required ECCA metadata
        version: metadata.version || 1,
        type: metadata.type, // 'event' or 'intent'
        owner: metadata.owner,
        lifecycle: metadata.lifecycle || 'active', // draft | active | deprecated | retired
        stability: metadata.stability || 'stable', // experimental | stable
        compliance: metadata.compliance || 'public', // public | pii | confidential
        description: metadata.description,

        // Optional fields
        ...(metadata.security && { security: metadata.security }),
        ...(metadata.deprecation && { deprecation: metadata.deprecation }),
        ...(metadata.rationale && { rationale: metadata.rationale }),

        // Superstruct schema
        schema
    };
}

/**
 * Deprecated Events Set
 * Events in this set will trigger warnings when published via EventBus
 * 
 * When deprecating a contract:
 * 1. Add event name to this set
 * 2. Set lifecycle: 'deprecated' in contract metadata
 * 3. Add deprecation object with since, removeBy, reason, replacement
 */
export const DeprecatedEvents = new Set([
    // Example: 'OLD_EVENT_NAME'
]);

const CoreContracts = {
    // Example: Item saved event
    ITEM_SAVED: {
        version: 1,
        type: 'event',
        owner: 'storage-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when an item is successfully saved',

        schema: object({
            version: number(),
            id: string(),
            title: size(string(), 1, 200),
            description: optional(string()),
            status: enums(['pending', 'completed', 'failed']),
            priority: optional(enums(['low', 'medium', 'high'])),
            timestamp: number()
        })
    },

    // Example: Item status changed
    ITEM_STATUS_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when item status changes',

        schema: object({
            id: string(),
            status: enums(['pending', 'completed', 'failed']),
            timestamp: number()
        })
    },

    // Example: Theme changed
    THEME_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when user changes theme',

        schema: object({
            theme: enums(['light', 'dark']),
            timestamp: optional(number())
        })
    },

    // File Upload Events
    INTENT_FILE_UPLOAD: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to upload a file',

        schema: object({
            file: object(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_STARTED: {
        version: 1,
        type: 'event',
        owner: 'file-upload-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload has started',

        schema: object({
            fileId: string(),
            fileName: string(),
            fileSize: number(),
            fileType: string(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_PROGRESS: {
        version: 1,
        type: 'event',
        owner: 'file-upload-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload progress update',

        schema: object({
            fileId: string(),
            progress: number(),
            loaded: number(),
            total: number(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'file-upload-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload completed successfully',

        schema: object({
            fileId: string(),
            fileName: string(),
            fileSize: number(),
            fileType: string(),
            previewUrl: optional(string()),
            result: object(),
            timestamp: number()
        })
    },

    FILE_UPLOAD_FAILED: {
        version: 1,
        type: 'event',
        owner: 'file-upload-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File upload failed',

        schema: object({
            fileId: string(),
            fileName: string(),
            error: string(),
            timestamp: number()
        })
    },

    FILE_REMOVED: {
        version: 1,
        type: 'event',
        owner: 'file-upload-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'File removed from upload queue',

        schema: object({
            fileId: string(),
            timestamp: number()
        })
    },

    // Datepicker Events
    DATE_SELECTED: {
        version: 1,
        type: 'event',
        owner: 'date-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User selected a date',

        schema: object({
            date: string(),
            timestamp: number(),
            year: number(),
            month: number(),
            day: number(),
            instanceId: number(),
            startDate: optional(string()),
            endDate: optional(string())
        })
    },

    CALENDAR_RENDERED: {
        version: 1,
        type: 'event',
        owner: 'date-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Calendar view updated (month/year change)',

        schema: object({
            year: number(),
            month: number(),
            direction: enums(['prev', 'next']),
            timestamp: number()
        })
    },

    // UI: Button Clicked
    INTENT_BUTTON_CLICKED: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User clicked a button with an action',

        schema: object({
            action: string(),
            buttonId: string(),
            timestamp: number()
        })
    },

    // UI: Input Changed (Valid)
    INTENT_INPUT_CHANGED: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User input changed and passed validation',

        schema: object({
            inputId: string(),
            value: string(),
            isValid: enums([true]), // Must be true for this intent
            timestamp: number()
        })
    },

    // UI: Input Validation Failed
    INPUT_VALIDATION_FAILED: {
        version: 2,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User input failed validation - enhanced with size limits for security',

        schema: object({
            inputId: string(),
            error: size(string(), 1, 200), // Max 200 chars for error messages
            value: size(string(), 0, 16000), // Max 16KB for input values (LLM context limit)
            timestamp: number()
        })
    },

    // UI: Modal Open Intent
    INTENT_MODAL_OPEN: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to open a modal',

        schema: object({
            modalId: string(),
            timestamp: number()
        })
    },

    // UI: Modal Close Intent
    INTENT_MODAL_CLOSE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to close a modal',

        schema: object({
            modalId: string(),
            reason: string(),
            timestamp: number()
        })
    },

    // UI: Dropdown Menu Toggle
    INTENT_DROPDOWN_TOGGLE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User toggled dropdown menu',

        schema: object({
            dropdownId: string(),
            isOpen: enums([true, false]),
            timestamp: number()
        })
    },

    // UI: Dropdown Opened Event
    DROPDOWN_OPENED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown menu was opened',

        schema: object({
            dropdownId: string(),
            timestamp: number()
        })
    },

    // UI: Dropdown Closed Event
    DROPDOWN_CLOSED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown menu was closed',

        schema: object({
            dropdownId: string(),
            timestamp: number()
        })
    },

    // UI: Dropdown Initialized
    DROPDOWN_INITIALIZED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown component was initialized',

        schema: object({
            dropdownId: string(),
            itemCount: number(),
            timestamp: number()
        })
    },

    // UI: Dropdown Toggled Event
    DROPDOWN_TOGGLED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Dropdown was toggled',

        schema: object({
            dropdownId: string(),
            action: enums(['open', 'close']),
            timestamp: number()
        })
    },

    // UI: Dropdown Item Selected
    INTENT_DROPDOWN_ITEM_SELECT: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User selected dropdown menu item (legacy name)',

        schema: object({
            dropdownId: string(),
            value: string(),
            role: enums(['menuitem', 'menuitemcheckbox', 'menuitemradio']),
            itemId: optional(string()),
            timestamp: number()
        })
    },

    // UI: Dropdown Item Selected
    INTENT_DROPDOWN_ITEM_SELECTED: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User selected dropdown menu item',

        schema: object({
            dropdownId: string(),
            itemId: string(),
            itemValue: string(),
            itemLabel: string(),
            timestamp: number()
        })
    },

    // ========================================
    // Toast Component Contracts
    // ========================================

    // UI: Intent to Show Toast
    INTENT_TOAST_SHOW: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to show a toast notification',

        schema: object({
            type: optional(string()), // 'default' | 'success' | 'error' | 'warning'
            title: optional(string()),
            description: optional(string()),
            duration: optional(number())
        })
    },

    // UI: Toast Shown Event
    TOAST_SHOWN: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Toast notification was shown',

        schema: object({
            toastId: string(),
            type: string(),
            timestamp: number()
        })
    },

    // UI: Toast Dismissed Event
    TOAST_DISMISSED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Toast notification was dismissed',

        schema: object({
            toastId: string(),
            timestamp: number()
        })
    },

    // ========================================
    // Tabs Component Contracts
    // ========================================

    // UI: Intent to Switch Tab
    INTENT_TAB_SWITCH: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to switch a tab',

        schema: object({
            tabId: string(),
            containerId: optional(string()),
            timestamp: number()
        })
    },

    // UI: Tab Switched Event
    TAB_SWITCHED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Tab was switched',

        schema: object({
            tabId: string(),
            containerId: optional(string()),
            timestamp: number()
        })
    },

    // ========================================
    INTENT_CREATE_ITEM: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to create a new item',

        security: {
            rateLimits: {
                perUser: { requests: 10, window: 60000 }  // 10 requests per minute
            }
        },

        schema: object({
            title: size(string(), 1, 200),
            description: optional(string()),
            priority: optional(enums(['low', 'medium', 'high']))
        })
    },

    // Page metadata changed (for MetaManager)
    PAGE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'meta-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'SEO metadata update for current page',

        schema: object({
            title: size(string(), 1, 60),  // SEO limit
            description: size(string(), 1, 160),  // SEO limit
            image: optional(string()),
            locale: optional(enums(['en', 'es', 'fr', 'de']))
        })
    },

    INTENT_AUTH_LOGIN: {
        version: 1,
        type: 'intent',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User initiated an authentication flow',

        schema: object({
            method: enums(['password', 'register', 'api-key']),
            identifier: optional(size(string(), 2, 320)),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_LOGIN_SUCCEEDED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication completed with a valid session',

        schema: object({
            method: enums(['password', 'register', 'api-key']),
            userId: optional(string()),
            sessionId: string(),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_LOGIN_FAILED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication attempt failed',

        schema: object({
            method: enums(['password', 'register', 'api-key']),
            error: size(string(), 1, 400),
            code: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    API_KEY_LOGIN_SUCCEEDED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'API key authentication completed successfully',

        schema: object({
            method: enums(['api-key']),
            userId: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    USER_LOGGED_IN: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User session established on the client',

        schema: object({
            user: optional(object()),
            sessionId: string(),
            timestamp: number()
        })
    },

    USER_LOGGED_OUT: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User session terminated',

        schema: object({
            reason: string(),
            timestamp: number()
        })
    },

    USER_REGISTERED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'User completed registration',

        schema: object({
            user: optional(object()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    AUTH_ERROR: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Authentication subsystem reported an error',

        schema: object({
            method: optional(string()),
            error: size(string(), 1, 400),
            code: optional(string()),
            requestId: optional(string()),
            timestamp: number()
        })
    },

    TOKEN_REFRESHED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Access token rotated client-side',

        schema: object({
            requestId: optional(string()),
            timestamp: number()
        })
    },

    SESSION_EXPIRED: {
        version: 1,
        type: 'event',
        owner: 'auth-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Session expired or was invalidated',

        schema: object({
            requestId: optional(string()),
            reason: optional(string()),
            timestamp: number()
        })
    },

    HMAC_NONCE_REQUESTED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Client requested a new integrity nonce',

        schema: object({
            intentId: string(),
            nonce: string(),
            expiresAt: number(),
            timestamp: number()
        })
    },

    INTENT_PUBLIC_FORM_SUBMIT: {
        version: 1,
        type: 'intent',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Public form submission intent requiring integrity guarantees',

        schema: object({
            formId: string(),
            intent: string(),
            timestamp: number()
        })
    },

    PUBLIC_FORM_SIGNED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Integrity signature generated for a public form submission',

        schema: object({
            intent: string(),
            nonce: string(),
            payloadHash: string(),
            timestamp: number(),
            expiresAt: number(),
            sessionId: optional(string())
        })
    },

    PUBLIC_FORM_REJECTED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Integrity signing failed and submission was rejected client-side',

        schema: object({
            formId: optional(string()),
            intent: string(),
            reason: size(string(), 1, 400),
            timestamp: number()
        })
    },

    HMAC_VERIFICATION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'hmac-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Integrity verification failed for a signed payload',

        schema: object({
            intentId: string(),
            reason: size(string(), 1, 400),
            timestamp: number()
        })
    },

    // Log entry (for LogAccumulator)
    LOG_ENTRY: {
        version: 1,
        type: 'event',
        owner: 'log-accumulator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'System log entry',

        schema: object({
            type: enums(['click', 'navigation', 'error', 'security', 'css-change', 'event', 'promise-error']),
            data: object(),
            sessionId: string(),
            timestamp: number()
        })
    },

    // ========================================
    // UI: Pagination Navigation Intent
    INTENT_PAGINATION_NAVIGATE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to navigate pagination (prev/next)',

        schema: object({
            direction: enums(['prev', 'next']),
            timestamp: number()
        })
    },

    // UI: Pagination Page Changed Event
    PAGINATION_PAGE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when pagination page changes',

        schema: object({
            page: number(),
            timestamp: number()
        })
    },

    // UI: Pagination Size Changed Event
    PAGINATION_SIZE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when items per page changes',

        schema: object({
            size: number(),
            timestamp: number()
        })
    },

    // LLM: Intent to classify text
    INTENT_CLASSIFY_TEXT: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to classify text using LLM',

        security: {
            rateLimits: {
                perUser: { requests: 5, window: 60000 }  // 5 per minute (LLM is expensive)
            }
        },

        schema: object({
            text: size(string(), 1, 16000),  // Max 16K chars (~4K tokens)
            userId: string()
        })
    },

    // LLM: Text classification result
    TEXT_CLASSIFIED: {
        version: 1,
        type: 'event',
        owner: 'llm-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Text classification result from LLM',

        schema: object({
            userId: string(),
            category: enums(['task', 'idea', 'reference']),
            confidence: number(),
            tags: optional(object()),
            timestamp: number()
        })
    },

    // Security violation event (no validation to avoid infinite loop)
    SECURITY_VIOLATION: contract({
        version: 1,
        type: 'event',
        owner: 'event-bus',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Security violation detected',

        // NO SCHEMA - validated in EventBus directly to avoid infinite loop
    }),

    // ========================================
    // Tabs Component Contracts
    // ========================================

    // UI: Intent to Switch Tab
    INTENT_TAB_SWITCH: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to switch to a different tab',

        schema: object({
            containerId: string(),
            tabId: string(),
            timestamp: number()
        })
    },

    // UI: Tab Switched Event
    TAB_SWITCHED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Tab switch was completed and UI updated',

        schema: object({
            containerId: string(),
            tabId: string(),
            previousTab: optional(string()),
            timestamp: number()
        })
    },

    // ========================================
    // Accordion Component Contracts
    // ========================================

    // UI: Intent to Toggle Accordion Item
    INTENT_ACCORDION_TOGGLE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intent to toggle an accordion item',

        schema: object({
            containerId: string(),
            itemId: string(),
            timestamp: number()
        })
    },

    // UI: Accordion Item Toggled Event
    ACCORDION_TOGGLED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Accordion item was toggled and UI updated',

        schema: object({
            containerId: string(),
            itemId: string(),
            action: enums(['open', 'close']),
            timestamp: number()
        })
    },

    // UI: Accordion Initialized Event
    ACCORDION_INITIALIZED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Accordion component was initialized',

        schema: object({
            containerId: string(),
            itemCount: number(),
            singleOpen: enums([true, false]),
            timestamp: number()
        })
    },

    // ========================================
    // Progress Component Contracts
    // ========================================

    // UI: Intent to Update Progress
    INTENT_PROGRESS_UPDATE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Intent to update progress bar value',

        schema: object({
            progressId: string(),
            percentage: number(),
            status: optional(enums(['loading', 'complete', 'error', 'indeterminate'])),
            label: optional(string())
        })
    },

    // UI: Progress Updated Event
    PROGRESS_UPDATE: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Progress bar value was updated',

        schema: object({
            progressId: string(),
            percentage: number(),
            status: enums(['loading', 'complete', 'error', 'indeterminate']),
            label: optional(string()),
            timestamp: number()
        })
    },

    // UI: Progress Completed Event
    PROGRESS_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Progress reached 100% and completed',

        schema: object({
            progressId: string(),
            timestamp: number()
        })
    },

    // ========================================
    // Tooltip Component Contracts
    // ========================================

    // UI: Tooltip Initialized Event
    TOOLTIP_INITIALIZED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Tooltip component was initialized',

        schema: object({
            triggerId: string(),
            timestamp: number()
        })
    },

    // ========================================
    // Popover Component Contracts
    // ========================================

    // UI: Intent to Toggle Popover
    INTENT_POPOVER_TOGGLE: {
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        schema: object({
            popoverId: string(),
            action: enums(['toggle', 'open', 'close']),
            source: optional(string()),
            timestamp: number()
        })
    },

    // UI: Popover Toggled Event
    POPOVER_TOGGLED: {
        version: 1,
        type: 'event',
        owner: 'ui-service',
        schema: object({
            popoverId: string(),
            isOpen: boolean(),
            timestamp: number()
        })
    },

    // ========================================
    // Slider Component Contracts
    // ========================================

    // UI: Intent to Change Slider Value
    INTENT_SLIDER_VALUE_CHANGED: contract({
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User changed slider value via interaction'
    }, object({
        sliderId: string(),
        value: number(),
        min: number(),
        max: number(),
        step: number(),
        timestamp: number()
    })),

    // UI: Intent to Start Slider Drag
    INTENT_SLIDER_DRAG_STARTED: contract({
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User started dragging slider thumb'
    }, object({
        sliderId: string(),
        startValue: number(),
        timestamp: number()
    })),

    // UI: Intent to End Slider Drag
    INTENT_SLIDER_DRAG_ENDED: contract({
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User finished dragging slider thumb'
    }, object({
        sliderId: string(),
        startValue: number(),
        endValue: number(),
        timestamp: number()
    })),

    // UI: Slider Value Updated Event
    SLIDER_VALUE_UPDATED: contract({
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Slider value was updated and UI should reflect changes'
    }, object({
        sliderId: string(),
        value: number(),
        percentage: number(),
        min: number(),
        max: number(),
        timestamp: number()
    })),

    // UI: Slider State Changed Event
    SLIDER_STATE_CHANGED: contract({
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Slider state changed (dragging, idle, disabled)'
    }, object({
        sliderId: string(),
        state: enums(['idle', 'dragging', 'disabled']),
        timestamp: number()
    })),

    // ========================================
    // Command Menu Component Contracts
    // ========================================

    // Command Menu: Open Intent
    INTENT_COMMAND_OPEN: {
        version: 1,
        type: 'intent',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Open command menu (Cmd/Ctrl + K)',

        schema: object({
            trigger: string(), // 'keyboard' | 'click'
            timestamp: number()
        })
    },

    // Command Menu: Search Intent
    INTENT_COMMAND_SEARCH: {
        version: 1,
        type: 'intent',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Search command menu',

        schema: object({
            query: size(string(), 0, 100),
            timestamp: number()
        })
    },

    // Command Menu: Execute Command Intent
    INTENT_COMMAND_EXECUTE: {
        version: 1,
        type: 'intent',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Execute a selected command',

        schema: object({
            commandId: string(),
            command: string(), // Action event name
            payload: optional(object()),
            timestamp: number()
        })
    },

    // Command Menu: Opened Event
    COMMAND_OPENED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command menu was opened',

        schema: object({
            trigger: string(),
            timestamp: number()
        })
    },

    // Command Menu: Closed Event
    COMMAND_CLOSED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command menu was closed',

        schema: object({
            trigger: string(), // 'escape' | 'blur' | 'execute'
            timestamp: number()
        })
    },

    // Command Menu: Results Updated Event
    COMMAND_RESULTS_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command search results updated',

        schema: object({
            query: string(),
            results: array(object({
                id: string(),
                label: string(),
                type: enums(['navigation', 'action', 'search', 'setting']),
                icon: optional(string()),
                shortcut: optional(string()),
                action: string(),
                payload: optional(object()),
                tags: optional(array(string()))
            })),
            timestamp: number()
        })
    },

    // Command Menu: Command Executed Event
    COMMAND_EXECUTED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Command was executed',

        schema: object({
            commandId: string(),
            command: string(),
            payload: optional(object()),
            timestamp: number()
        })
    },

    // Command Menu: Command Registered Event (for dynamic registration)
    COMMAND_REGISTERED: {
        version: 1,
        type: 'event',
        owner: 'command-ui',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'New command was registered',

        schema: object({
            id: string(),
            label: string(),
            type: enums(['navigation', 'action', 'search', 'setting']),
            icon: optional(string()),
            shortcut: optional(string()),
            action: string(),
            payload: optional(object()),
            timestamp: number()
        })
    },
};

export const Contracts = {
    ...CoreContracts,
    ...FileSystemContracts,
    ...MediaCaptureContracts,
    ...CameraContracts,
    ...LocationContracts,
    ...MediaTransformContracts,
    ...ImageOptimizerContracts,
    ...NetworkStatusContracts,
    ...SyncQueueContracts,
    ...FormManagementContracts,
    ...ModalSystemContracts,
    ...DataTableContracts,
    ...CheckoutContracts,
    ...SearchContracts,
    ...AIContracts,
    ...ExampleModuleContracts,
    ...StaticRenderContracts,
    ...AnalyticsContracts,

    // Developer Logs
    LOG_ENTRY: {
        version: 1,
        type: 'event',
        owner: 'log-accumulator',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Developer debug log entry',

        schema: object({
            type: string(),
            data: any(),
            sessionId: optional(string()),
            timestamp: number()
        })
    }
};
