/**
 * CSMA Starter Entry Point
 *
 * Canonical lightweight bootstrap used by starter scaffolds.
 * The CLI should copy this file into src/main.js for starter mode
 * instead of synthesizing its own entrypoint.
 */
import { EventBus } from '../../library/runtime/EventBus.js';
import { ServiceManager } from '../../library/runtime/ServiceManager.js';
import { ModuleManager } from '../../library/runtime/ModuleManager.js';
import { FEATURES } from './config.js';
import { initUI as initStarterUI } from '../../library/ui/init.js';

const MODULE_FEATURE_PAIRS = [
    ['I18N', 'i18n'],
    ['INDEXEDDB', 'storage'],
    ['SEARCH_MODULE', 'search'],
    ['FILE_SYSTEM', 'file-system'],
    ['CAMERA_MODULE', 'camera'],
    ['MEDIA_CAPTURE', 'media-capture'],
    ['LOCATION_MODULE', 'location'],
    ['MEDIA_TRANSFORM', 'media-transform'],
    ['IMAGE_OPTIMIZER', 'image-optimizer'],
    ['FORM_MANAGEMENT', 'form-management'],
    ['MODAL_SYSTEM', 'modal-system'],
    ['CHECKOUT_MODULE', 'checkout'],
    ['DATA_TABLE_MODULE', 'data-table'],
    ['NETWORK_STATUS_MODULE', 'network-status'],
    ['SYNC_QUEUE', 'sync-queue'],
    ['OPTIMISTIC_SYNC', 'optimistic-sync'],
    ['AI_MODULE', 'ai']
];

const eventBus = new EventBus();
const serviceManager = new ServiceManager(eventBus);
const moduleManager = new ModuleManager(eventBus, serviceManager);

let uiCleanup = null;
let initPromise = null;

export { eventBus, serviceManager, moduleManager, FEATURES };

async function loadStarterModules() {
    for (const [featureName, moduleId] of MODULE_FEATURE_PAIRS) {
        if (FEATURES[featureName] === true) {
            await moduleManager.loadModule(moduleId);
        }
    }
}

export async function init() {
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        console.log('[CSMA Starter] Initializing...');
        await loadStarterModules();
        uiCleanup = initStarterUI(eventBus);
        window.csma = {
            ...(window.csma || {}),
            eventBus,
            serviceManager,
            moduleManager,
            destroyApp
        };
        console.log('[CSMA Starter] Ready');
    })().finally(() => {
        initPromise = null;
    });

    return initPromise;
}

export function destroyApp() {
    uiCleanup?.();
    uiCleanup = null;
}

if (typeof window !== 'undefined' && import.meta.url === window.location.href) {
    init().catch(console.error);
}
