function shouldIgnoreClick(event) {
    return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export class ClientNavigationService {
    constructor() {
        this.pageResolver = null;
        this.canHandlePath = null;
        this.handlePath = null;
        this.fallbackNavigate = null;
        this.windowRef = null;
        this.documentRef = null;
        this.boundClick = null;
        this.boundPopState = null;
    }

    init({
        pageResolver,
        canHandlePath = null,
        handlePath = null,
        fallbackNavigate = null,
        windowRef = globalThis.window,
        documentRef = globalThis.document
    } = {}) {
        this.pageResolver = pageResolver;
        this.canHandlePath = typeof canHandlePath === 'function' ? canHandlePath : null;
        this.handlePath = typeof handlePath === 'function' ? handlePath : null;
        this.fallbackNavigate = typeof fallbackNavigate === 'function'
            ? fallbackNavigate
            : (href) => this.windowRef?.location?.assign?.(href);
        this.windowRef = windowRef;
        this.documentRef = documentRef;

        this.boundClick ??= this.handleDocumentClick.bind(this);
        this.boundPopState ??= this.handlePopState.bind(this);

        this.documentRef?.addEventListener?.('click', this.boundClick);
        this.windowRef?.addEventListener?.('popstate', this.boundPopState);
    }

    handleDocumentClick(event) {
        if (shouldIgnoreClick(event)) {
            return;
        }

        const anchor = event.target?.closest?.('a[href]');
        if (!anchor) {
            return;
        }

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#') || anchor.hasAttribute('download')) {
            return;
        }

        const target = anchor.getAttribute('target');
        if (target && target !== '_self') {
            return;
        }

        const url = new URL(anchor.href, this.windowRef.location.href);
        if (url.origin !== this.windowRef.location.origin) {
            return;
        }

        if (!this.shouldHandlePath(url.pathname)) {
            return;
        }

        event.preventDefault();
        this.navigate(`${url.pathname}${url.search}${url.hash}`);
    }

    shouldHandlePath(pathname) {
        if (typeof this.handlePath !== 'function') {
            return false;
        }

        if (typeof this.canHandlePath === 'function') {
            return this.canHandlePath(pathname);
        }

        return this.pageResolver?.has?.(pathname) || false;
    }

    async navigate(href, context = {}) {
        const url = new URL(href, this.windowRef.location.href);
        if (!this.shouldHandlePath(url.pathname)) {
            this.fallbackNavigate?.(url.toString());
            return null;
        }

        this.windowRef.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
        await this.handlePath?.(url.pathname, {
            ...context,
            source: context.source || 'client-navigation',
            replace: false
        });
        return null;
    }

    async replace(href, context = {}) {
        const url = new URL(href, this.windowRef.location.href);
        this.windowRef.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        await this.handlePath?.(url.pathname, {
            ...context,
            source: context.source || 'client-navigation',
            replace: true
        });
        return null;
    }

    async handlePopState() {
        if (this.shouldHandlePath(this.windowRef.location.pathname)) {
            await this.handlePath?.(this.windowRef.location.pathname, {
                source: 'client-navigation',
                replace: true
            });
        }
        return null;
    }

    destroy() {
        this.documentRef?.removeEventListener?.('click', this.boundClick);
        this.windowRef?.removeEventListener?.('popstate', this.boundPopState);
    }
}
