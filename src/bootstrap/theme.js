import { registerThemeToggle, applyStoredTheme, cycleTheme, getNextThemeLabel } from '../theme/theme-manager.js';

export function setupThemeToggle(eventBus) {
    const toggleBtn = document.getElementById('theme-toggle');
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

export function resolveApiBaseUrl() {
    const envUrl = import.meta.env?.VITE_API_URL?.trim();
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined') {
        const globalUrl = window.__CSMA_API_URL || window.csma?.config?.apiBaseUrl;
        if (globalUrl) return globalUrl;
    }

    if (import.meta.env?.DEV) {
        return 'http://localhost:5050';
    }

    return '';
}

export function buildLogEndpoint(baseUrl) {
    if (!baseUrl) return '/logs/batch';
    return `${baseUrl.replace(/\/$/, '')}/logs/batch`;
}
