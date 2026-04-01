export function setupThemeToggle(eventBus) {
    const toggleBtn = document.getElementById('theme-toggle') || document.getElementById('themeToggle');
    if (!toggleBtn || toggleBtn.dataset.themeBound === 'true') return () => {};

    const handleClick = () => {
        const currentTheme = document.documentElement.dataset.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        eventBus?.publish('THEME_CHANGED', { theme: newTheme });
        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    };

    toggleBtn.addEventListener('click', handleClick);
    toggleBtn.dataset.themeBound = 'true';

    return () => {
        toggleBtn.removeEventListener('click', handleClick);
        delete toggleBtn.dataset.themeBound;
    };
}

export function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.dataset.theme = savedTheme;
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
