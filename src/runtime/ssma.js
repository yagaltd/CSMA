function trimBaseUrl(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }

    return value.trim().replace(/\/$/, '');
}

function getCompatibilityBaseUrl() {
    if (typeof window === 'undefined') {
        return '';
    }

    return trimBaseUrl(window.__CSMA_API_URL);
}

export function resolveSsmaBaseUrl(runtimeConfig = {}) {
    const explicitBaseUrl = trimBaseUrl(runtimeConfig?.ssma?.baseUrl);
    if (explicitBaseUrl) {
        return explicitBaseUrl;
    }

    const envBaseUrl = trimBaseUrl(import.meta.env?.VITE_API_URL);
    if (envBaseUrl) {
        return envBaseUrl;
    }

    const compatibilityBaseUrl = getCompatibilityBaseUrl();
    if (compatibilityBaseUrl) {
        return compatibilityBaseUrl;
    }

    return '';
}

export function resolveSsmaHttpEndpoint(path, override, runtimeConfig = {}) {
    if (override) {
        return override;
    }

    const baseUrl = resolveSsmaBaseUrl(runtimeConfig);
    if (!baseUrl) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
}

export function resolveSsmaWsEndpoint(path, override, runtimeConfig = {}) {
    if (override) {
        return override;
    }

    const baseUrl = resolveSsmaBaseUrl(runtimeConfig);
    if (!baseUrl) {
        if (typeof window === 'undefined') {
            return '';
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}${path}`;
    }

    const url = new URL(resolveSsmaHttpEndpoint(path, undefined, runtimeConfig));
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
}
