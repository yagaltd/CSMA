import { matchRenderPage, normalizeRoutePath } from './pageRouting.js';

export class PageResolver {
    constructor() {
        this.pages = [];
        this.pagesByPath = new Map();
    }

    init({ pages = [] } = {}) {
        if (!Array.isArray(pages)) {
            throw new Error('[PageResolver] pages must be an array.');
        }

        this.pages = [];
        this.pagesByPath.clear();

        this.pages = pages.map((page) => {
            const normalizedPath = normalizeRoutePath(page.routePath);
            if (this.pagesByPath.has(normalizedPath)) {
                throw new Error(`[PageResolver] Duplicate page route "${normalizedPath}".`);
            }

            const normalizedPage = {
                ...page,
                routePath: normalizedPath
            };
            this.pagesByPath.set(normalizedPath, normalizedPage);
            return normalizedPage;
        });
    }

    list() {
        return [...this.pages];
    }

    resolve(pathname) {
        return matchRenderPage(this.pages, pathname);
    }

    has(pathname) {
        return this.pagesByPath.has(normalizeRoutePath(pathname));
    }

    normalizeRoutePath(pathname) {
        return normalizeRoutePath(pathname);
    }

    destroy() {
        this.pages = [];
        this.pagesByPath.clear();
    }
}
