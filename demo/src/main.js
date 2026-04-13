/**
 * CSMA Kit - Main Entry Point
 */
import { APP_RUNTIME_CONFIG, FEATURES } from './config.js';
import { RENDER_PAGES } from './render.pages.js';
import { initUI } from '../../library/ui/init.js';
import { createRuntimeState, destroyRuntimeState, syncWindowRuntime } from '../../library/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../../library/runtime/features.js';
import { setupThemeToggle, loadTheme, resolveApiBaseUrl } from '../../library/style/theme/theme-helpers.js';

let runtimeState = null;
const apiBaseUrl = resolveApiBaseUrl(APP_RUNTIME_CONFIG);
let initPromise = null;
let appInitialized = false;
let appDestroyed = false;

function ensureRuntime() {
    if (runtimeState) {
        syncWindowRuntime(runtimeState, { apiBaseUrl, destroyApp });
        return runtimeState;
    }

    runtimeState = createRuntimeState();
    runtimeState.runtimeConfig = APP_RUNTIME_CONFIG;
    appDestroyed = false;
    syncWindowRuntime(runtimeState, { apiBaseUrl, destroyApp });
    return runtimeState;
}

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

        const state = ensureRuntime();
        console.log('[CSMA] Initializing application...');

        await loadOptionalFeatures(state, {
            FEATURES,
            apiBaseUrl,
            runtimeConfig: APP_RUNTIME_CONFIG,
            pages: RENDER_PAGES,
            documentRef: document,
            windowRef: window
        });
        syncWindowRuntime(state, { apiBaseUrl, destroyApp });

        state.uiCleanup = initUI(state.eventBus) || window.csma?.componentCleanup || null;

        state.themeToggleCleanup?.();
        state.themeToggleCleanup = setupThemeToggle(state.eventBus);
        loadTheme();

        if (FEATURES.CSMA_MODE === 'full') {
            await state.pageRuntime?.renderPath?.(window.location.pathname, { source: 'csr' });
        }

        console.log('[CSMA] Application ready');

        appInitialized = true;
        syncWindowRuntime(state, { apiBaseUrl, destroyApp });
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

    if (runtimeState) {
        await destroyRuntimeState(runtimeState, { destroyApp });
        runtimeState = null;
    }

    if (document.readyState === 'loading') {
        document.removeEventListener('DOMContentLoaded', handleDOMContentLoaded);
    }
}
