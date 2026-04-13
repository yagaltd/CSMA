/**
 * CSMA Kit - Main Entry Point
 */
import { FEATURES } from './config.js';
import { initUI } from '../../library/ui/init.js';
import { createRuntimeState, destroyRuntimeState, syncWindowRuntime } from '../../library/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../../library/runtime/features.js';
import { setupThemeToggle, loadTheme, resolveApiBaseUrl } from '../../library/style/theme/theme-helpers.js';

let runtimeState = null;
const apiBaseUrl = resolveApiBaseUrl();
let initPromise = null;
let appInitialized = false;
let appDestroyed = false;

function ensureRuntime() {
    if (runtimeState) {
        syncWindowRuntime(runtimeState, { apiBaseUrl, destroyApp });
        return runtimeState;
    }

    runtimeState = createRuntimeState();
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

        await loadOptionalFeatures(state, { FEATURES, apiBaseUrl });
        syncWindowRuntime(state, { apiBaseUrl, destroyApp });

        state.uiCleanup = initUI(state.eventBus) || window.csma?.componentCleanup || null;

        state.themeToggleCleanup?.();
        state.themeToggleCleanup = setupThemeToggle(state.eventBus);
        loadTheme();

        // Analytics initializes via features.js (ANALYTICS_MODULE flag).
        // LogAccumulator remains responsible for runtime/error logging only.

        state.eventBus.publish('PAGE_CHANGED', {
            title: 'CSMA Kit',
            description: 'A lean, secure, reactive CSMA application kit',
            locale: 'en'
        });

        console.log('[CSMA] Application ready');

        state.welcomeTimer = window.setTimeout(() => {
            state.eventBus.publish('INTENT_CREATE_ITEM', {
                title: 'Welcome to CSMA!',
                description: 'This is an example card demonstrating CSS-class reactivity.',
                priority: 'high'
            });
        }, 500);

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
