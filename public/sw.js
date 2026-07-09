const DEFAULT_CACHE_NAME = 'csma-offline-cache-v2';
const DEFAULT_SHELL_PATH = '/index.html';
const SAFE_PREFIXES = [
    '/assets/'
];
const SAFE_EXTENSIONS = [
    '.js',
    '.mjs',
    '.css',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf'
];
const BLOCKED_PREFIXES = [
    '/api/',
    '/auth/',
    '/forms/',
    '/media/',
    '/logs/',
    '/optimistic/',
    '/query/',
    '/admin/',
    '/internal/',
    '/login',
    '/logout',
    '/session'
];

function resolveUrl(input, origin) {
    if (typeof input === 'string') {
        return new URL(input, origin);
    }

    if (input?.url) {
        return new URL(input.url, origin);
    }

    return new URL(String(input), origin);
}

function isSameOrigin(url, origin) {
    return url.origin === origin;
}

function isNavigationRequest(request) {
    const accept = request?.headers?.get?.('accept') || '';
    return request?.mode === 'navigate' || accept.includes('text/html');
}

function hasAuthHeaders(request) {
    const headers = request?.headers;

    if (!headers?.get) {
        return false;
    }

    return Boolean(headers.get('authorization') || headers.get('x-csma-auth'));
}

function isAllowlistedPath(pathname) {
    if (BLOCKED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return false;
    }

    if (pathname === '/' || pathname === '/index.html') {
        return true;
    }

    const hasSafePrefix = SAFE_PREFIXES.some(prefix => pathname.startsWith(prefix));
    return hasSafePrefix && SAFE_EXTENSIONS.some(extension => pathname.endsWith(extension));
}

export function shouldHandleRequest(request, {
    origin = typeof location !== 'undefined' ? location.origin : 'http://localhost:5173'
} = {}) {
    if (!request || (request.method || 'GET').toUpperCase() !== 'GET') {
        return false;
    }

    const url = resolveUrl(request, origin);

    if (!isSameOrigin(url, origin)) {
        return false;
    }

    if (hasAuthHeaders(request)) {
        return false;
    }

    return isNavigationRequest(request) || isAllowlistedPath(url.pathname);
}

export function shouldCacheResponse(response) {
    if (!response || typeof response !== 'object') {
        return false;
    }

    if (response.status !== 200) {
        return false;
    }

    if (response.type === 'opaque') {
        return false;
    }

    const cacheControl = response.headers?.get?.('cache-control')?.toLowerCase?.() || '';

    if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
        return false;
    }

    return true;
}

function createCacheKey(request, origin, shellPath = DEFAULT_SHELL_PATH) {
    if (isNavigationRequest(request)) {
        return new URL(shellPath, origin).toString();
    }

    return resolveUrl(request, origin).toString();
}

export function createOfflineCacheRuntime({
    cachesImpl = globalThis.caches,
    fetchImpl = globalThis.fetch?.bind(globalThis),
    cacheName = DEFAULT_CACHE_NAME,
    origin = typeof location !== 'undefined' ? location.origin : 'http://localhost:5173',
    shellPath = DEFAULT_SHELL_PATH
} = {}) {
    async function openCache() {
        if (!cachesImpl?.open) {
            return null;
        }

        return cachesImpl.open(cacheName);
    }

    async function cacheResponse(cache, key, response) {
        if (!cache || !shouldCacheResponse(response)) {
            return;
        }

        await cache.put(key, response.clone());
    }

    async function handleNavigation(request) {
        const cache = await openCache();
        const shellKey = new URL(shellPath, origin).toString();

        try {
            const response = await fetchImpl(request);
            await cacheResponse(cache, shellKey, response);
            return response;
        } catch (error) {
            const cached = await cache?.match?.(shellKey);
            if (cached) {
                return cached;
            }

            throw error;
        }
    }

    async function handleAsset(request) {
        const cache = await openCache();
        const key = createCacheKey(request, origin, shellPath);
        const cached = await cache?.match?.(key);

        if (cached) {
            fetchImpl(request)
                .then(response => cacheResponse(cache, key, response))
                .catch(() => null);
            return cached;
        }

        const response = await fetchImpl(request);
        await cacheResponse(cache, key, response);
        return response;
    }

    async function handleFetch(request) {
        if (!shouldHandleRequest(request, { origin })) {
            return fetchImpl(request);
        }

        if (isNavigationRequest(request)) {
            return handleNavigation(request);
        }

        return handleAsset(request);
    }

    async function cleanupOldCaches() {
        if (!cachesImpl?.keys || !cachesImpl?.delete) {
            return;
        }

        const cacheNames = await cachesImpl.keys();
        await Promise.all(
            cacheNames
                .filter(name => name !== cacheName)
                .map(name => cachesImpl.delete(name))
        );
    }

    return {
        cacheName,
        origin,
        shellPath,
        handleFetch,
        handleNavigation,
        handleAsset,
        cleanupOldCaches
    };
}

const swGlobal = typeof self !== 'undefined' ? self : globalThis;

if (swGlobal?.addEventListener) {
    const runtime = createOfflineCacheRuntime({
        cachesImpl: swGlobal.caches,
        fetchImpl: swGlobal.fetch?.bind(swGlobal),
        origin: swGlobal.location?.origin || 'http://localhost:5173'
    });

    swGlobal.addEventListener('install', event => {
        event.waitUntil(Promise.resolve().then(() => swGlobal.skipWaiting?.()));
    });

    swGlobal.addEventListener('activate', event => {
        event.waitUntil(
            runtime.cleanupOldCaches()
                .then(() => swGlobal.clients?.claim?.())
        );
    });

    swGlobal.addEventListener('fetch', event => {
        event.respondWith(runtime.handleFetch(event.request));
    });
}

export { DEFAULT_CACHE_NAME, DEFAULT_SHELL_PATH };
