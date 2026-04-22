import { registerThemeToggle, applyStoredTheme } from './theme-manager.js';
import { resolveSsmaBaseUrl, resolveSsmaHttpEndpoint } from '../../runtime/ssma.js';

export function setupThemeToggle(eventBus) {
    const toggleBtn = document.querySelector('[data-theme-toggle]') || document.getElementById('theme-toggle');
    if (!toggleBtn) {
        return () => {};
    }

    const cleanup = registerThemeToggle(toggleBtn, ({ theme, next }) => {
        eventBus?.publish('THEME_CHANGED', { theme });
        toggleBtn.dataset.themeActive = theme;
        toggleBtn.dataset.themeNext = next;
    });

    return cleanup;
}

export function loadTheme() {
    applyStoredTheme();
}

export function resolveApiBaseUrl(runtimeConfig = {}) {
    return resolveSsmaBaseUrl(runtimeConfig);
}

export function buildLogEndpoint(baseUrl, runtimeConfig = {}) {
    return resolveSsmaHttpEndpoint('/logs/batch', baseUrl, runtimeConfig);
}
