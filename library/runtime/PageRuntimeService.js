import { AIUIComposerService } from '../modules/ai-ui/services/AIUIComposerService.js';
import { componentCatalog } from '../modules/ai-ui/catalog/componentCatalog.js';
import { mountRenderContractPage } from '../modules/ai-ui/services/renderPageDom.js';

function ensureMetaInput(record = {}) {
    const attrs = {
        ...(record.attrs || {})
    };

    if ((record.classes || []).length > 0) {
        attrs.class = record.classes.join(' ');
    }

    if (record.style && Object.keys(record.style).length > 0) {
        attrs.style = { ...record.style };
    }

    return attrs;
}

function createAttrEntry(page = {}) {
    const entry = {};

    if (page.htmlAttrs) {
        entry.htmlAttrs = ensureMetaInput(page.htmlAttrs);
    }

    if (page.bodyAttrs) {
        entry.bodyAttrs = ensureMetaInput(page.bodyAttrs);
    }

    return entry;
}

export class PageRuntimeService {
    constructor(eventBus, { pageResolver, metaManager } = {}) {
        this.eventBus = eventBus;
        this.pageResolver = pageResolver;
        this.metaManager = metaManager;
        this.documentRef = null;
        this.windowRef = null;
        this.mount = null;
        this.composer = new AIUIComposerService(eventBus);
        this.currentPage = null;
        this.currentContract = null;
        this.pageAttrEntry = null;
    }

    init({
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        mount = null
    } = {}) {
        this.documentRef = documentRef;
        this.windowRef = windowRef;
        this.mount = mount || this.ensureMount();
        return this.mount;
    }

    ensureMount() {
        if (!this.documentRef?.body) {
            throw new Error('[PageRuntimeService] document body is required.');
        }

        const existing = this.documentRef.querySelector('[data-csma-page-root]');
        if (existing) {
            return existing;
        }

        const mount = this.documentRef.createElement('div');
        mount.setAttribute('data-csma-page-root', 'true');
        this.documentRef.body.appendChild(mount);
        return mount;
    }

    async renderPath(pathname, { source = 'csr' } = {}) {
        const page = this.pageResolver?.resolve?.(pathname);
        if (!page) {
            return null;
        }

        if (!page.viewId?.startsWith?.('ai-ui.')) {
            throw new Error(`[PageRuntimeService] Unsupported page view "${page.viewId}".`);
        }

        const contentArchetypeId = page.viewId.replace(/^ai-ui\./, '');
        const contract = this.composer.renderContentContract(contentArchetypeId, {
            viewId: page.viewId,
            pageId: page.id,
            routePath: page.routePath,
            canonicalUrl: page.canonicalUrl,
            lang: page.lang,
            props: {
                ...(page.props || {}),
                ...(page.title ? { title: page.title } : {}),
                ...(page.description ? { description: page.description } : {})
            },
            state: page.state || {}
        }, {
            source
        });

        mountRenderContractPage({
            documentRef: this.documentRef,
            mount: this.mount || this.ensureMount(),
            contract,
            catalog: componentCatalog
        });

        this.applyMeta(page, contract);
        this.currentPage = page;
        this.currentContract = contract;

        return contract;
    }

    applyMeta(page, contract) {
        this.eventBus?.publishSync?.('PAGE_CHANGED', {
            title: page.title || contract.head?.title || contract.page?.title || '',
            description: page.description || '',
            locale: page.lang || contract.head?.htmlAttrs?.attrs?.lang || 'en',
            canonical: page.canonicalUrl || undefined
        });

        const attrEntry = createAttrEntry(page);
        if (Object.keys(attrEntry).length === 0) {
            this.pageAttrEntry?.dispose?.();
            this.pageAttrEntry = null;
            return;
        }

        if (this.pageAttrEntry) {
            this.pageAttrEntry.patch(attrEntry);
            return;
        }

        this.pageAttrEntry = this.metaManager?.push?.(attrEntry, {
            owner: 'page-runtime',
            key: 'page-runtime:attrs',
            safe: true,
            priority: 1
        }) || null;
    }

    hydrateCurrentPage(page, contract) {
        this.currentPage = page || null;
        this.currentContract = contract || null;
        if (page && contract) {
            this.applyMeta(page, contract);
        }
    }

    destroy() {
        this.pageAttrEntry?.dispose?.();
        this.pageAttrEntry = null;
        this.currentPage = null;
        this.currentContract = null;
        this.mount = null;
    }
}
