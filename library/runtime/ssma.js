function trimBaseUrl(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }

    return value.trim().replace(/\/$/, '');
}

function getRuntimeConfig() {
    if (typeof window === 'undefined') {
        return {};
    }

    return window.csma?.config || {};
}

export function resolveSsmaBaseUrl() {
    const config = getRuntimeConfig();
    const explicitBaseUrl = trimBaseUrl(config.ssma?.baseUrl);
    if (explicitBaseUrl) {
        return explicitBaseUrl;
    }

    const envBaseUrl = trimBaseUrl(import.meta.env?.VITE_API_URL);
    if (envBaseUrl) {
        return envBaseUrl;
    }

    const globalBaseUrl = typeof window !== 'undefined' ? window.__CSMA_API_URL : '';
    const compatibilityBaseUrl = trimBaseUrl(globalBaseUrl || config.apiBaseUrl);
    if (compatibilityBaseUrl) {
        return compatibilityBaseUrl;
    }

    return '';
}

export function resolveSsmaHttpEndpoint(path, override) {
    if (override) {
        return override;
    }

    const baseUrl = resolveSsmaBaseUrl();
    if (!baseUrl) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
}

export function resolveSsmaWsEndpoint(path, override) {
    if (override) {
        return override;
    }

    const baseUrl = resolveSsmaBaseUrl();
    if (!baseUrl) {
        if (typeof window === 'undefined') {
            return '';
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}${path}`;
    }

    const url = new URL(resolveSsmaHttpEndpoint(path));
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
}
