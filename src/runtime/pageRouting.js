function extractPathname(input) {
    if (typeof input !== 'string' || input.trim() === '') {
        return '/';
    }

    const value = input.trim();

    try {
        if (/^[a-z]+:\/\//i.test(value)) {
            return new URL(value).pathname || '/';
        }
    } catch {}

    const withoutHash = value.split('#')[0] || '/';
    const withoutQuery = withoutHash.split('?')[0] || '/';
    return withoutQuery || '/';
}

export function normalizeRoutePath(input = '/') {
    let pathname = extractPathname(input);

    if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`;
    }

    pathname = pathname.replace(/\/{2,}/g, '/');

    if (pathname.length > 1) {
        pathname = pathname.replace(/\/+$/, '');
    }

    return pathname || '/';
}

export function matchRenderPage(pages = [], pathname = '/') {
    const normalizedPath = normalizeRoutePath(pathname);
    return pages.find((page) => normalizeRoutePath(page.routePath) === normalizedPath) || null;
}
