function shouldIgnoreClick(event) {
    return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export class ClientNavigationService {
    constructor() {
        this.pageResolver = null;
        this.pageRuntimeService = null;
        this.windowRef = null;
        this.documentRef = null;
        this.boundClick = null;
        this.boundPopState = null;
    }

    init({
        pageResolver,
        pageRuntimeService,
        windowRef = globalThis.window,
        documentRef = globalThis.document
    } = {}) {
        this.pageResolver = pageResolver;
        this.pageRuntimeService = pageRuntimeService;
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

        if (!this.pageResolver?.has?.(url.pathname)) {
            return;
        }

        event.preventDefault();
        this.navigate(`${url.pathname}${url.search}${url.hash}`);
    }

    async navigate(href) {
        const url = new URL(href, this.windowRef.location.href);
        if (!this.pageResolver?.has?.(url.pathname)) {
            this.windowRef.location.assign(url.toString());
            return null;
        }

        this.windowRef.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
        return this.pageRuntimeService?.renderPath?.(url.pathname, { source: 'client-navigation' }) || null;
    }

    async replace(href) {
        const url = new URL(href, this.windowRef.location.href);
        this.windowRef.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        return this.pageRuntimeService?.renderPath?.(url.pathname, { source: 'client-navigation' }) || null;
    }

    async handlePopState() {
        return this.pageRuntimeService?.renderPath?.(this.windowRef.location.pathname, { source: 'client-navigation' }) || null;
    }

    destroy() {
        this.documentRef?.removeEventListener?.('click', this.boundClick);
        this.windowRef?.removeEventListener?.('popstate', this.boundPopState);
    }
}
