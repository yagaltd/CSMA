import { LifecycleScope } from './LifecycleScope.js';

const DEFAULT_PAGE_OWNER = 'runtime:page';
const MANAGED_ATTR = 'data-csma-meta-managed';
const KEY_ATTR = 'data-csma-meta-key';
const META_TARGET_ATTRS = ['name', 'property', 'http-equiv', 'charset'];

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stripProtoKeys(value) {
    if (Array.isArray(value)) {
        return value.map(stripProtoKeys);
    }

    if (isPlainObject(value)) {
        const clean = {};
        Object.keys(value).forEach((key) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                return;
            }
            clean[key] = stripProtoKeys(value[key]);
        });
        return clean;
    }

    return value;
}

function pruneValue(value) {
    if (Array.isArray(value)) {
        const next = value
            .map((entry) => pruneValue(entry))
            .filter((entry) => entry !== undefined);
        return next.length ? next : undefined;
    }

    if (isPlainObject(value)) {
        const next = {};
        Object.entries(value).forEach(([key, entry]) => {
            const pruned = pruneValue(entry);
            if (pruned !== undefined) {
                next[key] = pruned;
            }
        });
        return Object.keys(next).length ? next : undefined;
    }

    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }

    return value;
}

function normalizeClassValue(value) {
    if (!value) {
        return [];
    }

    if (typeof value === 'string') {
        return value.split(/\s+/).filter(Boolean);
    }

    if (Array.isArray(value)) {
        return value.flatMap((entry) => normalizeClassValue(entry));
    }

    if (isPlainObject(value)) {
        return Object.entries(value)
            .filter(([, enabled]) => Boolean(enabled))
            .map(([name]) => name);
    }

    return [String(value)];
}

function normalizeStyleValue(value) {
    if (!value) {
        return {};
    }

    if (typeof value === 'string') {
        return value.split(';').reduce((acc, part) => {
            const [name, ...rest] = part.split(':');
            const key = name?.trim();
            const nextValue = rest.join(':').trim();
            if (key && nextValue) {
                acc[key] = nextValue;
            }
            return acc;
        }, {});
    }

    if (isPlainObject(value)) {
        return Object.entries(value).reduce((acc, [key, entry]) => {
            if (entry === undefined || entry === null || entry === '') {
                return acc;
            }
            acc[key] = String(entry).trim();
            return acc;
        }, {});
    }

    return {};
}

function normalizeAttributeRecord(input = {}) {
    const sanitized = stripProtoKeys(input);
    const attrs = {};
    let classes = [];
    let styles = {};

    Object.entries(sanitized).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return;
        }

        if (key === 'class') {
            classes = normalizeClassValue(value);
            return;
        }

        if (key === 'style') {
            styles = normalizeStyleValue(value);
            return;
        }

        if (typeof value === 'boolean') {
            if (value) {
                attrs[key] = '';
            }
            return;
        }

        const next = String(value).trim();
        if (next) {
            attrs[key] = next;
        }
    });

    return {
        attrs,
        classes: Array.from(new Set(classes)),
        style: styles
    };
}

function normalizeMetaTag(input = {}) {
    const sanitized = stripProtoKeys(input);
    const props = {};

    META_TARGET_ATTRS.forEach((attr) => {
        if (sanitized[attr] === undefined || sanitized[attr] === null || sanitized[attr] === '') {
            return;
        }
        props[attr] = String(sanitized[attr]).trim();
    });

    if (!props.charset && (sanitized.content === undefined || sanitized.content === null || sanitized.content === '')) {
        return null;
    }

    if (!props.charset) {
        props.content = String(sanitized.content).trim();
        if (!props.content) {
            return null;
        }
    }

    return {
        tag: 'meta',
        key: sanitized.key ? String(sanitized.key).trim() : undefined,
        props
    };
}

function normalizeLinkTag(input = {}) {
    const sanitized = stripProtoKeys(input);
    const rel = sanitized.rel ? String(sanitized.rel).trim() : '';
    if (!rel) {
        return null;
    }

    const props = { rel };
    Object.entries(sanitized).forEach(([key, value]) => {
        if (key === 'key' || key === 'rel' || value === undefined || value === null || value === '') {
            return;
        }
        props[key] = String(value).trim();
    });

    return {
        tag: 'link',
        key: sanitized.key ? String(sanitized.key).trim() : undefined,
        props
    };
}

function normalizeScriptTag(input = {}, safe = true) {
    const sanitized = stripProtoKeys(input);
    const type = sanitized.type ? String(sanitized.type).trim() : '';
    const json = pruneValue(sanitized.json);

    if (safe && type !== 'application/ld+json') {
        return null;
    }

    if (type !== 'application/ld+json' || json === undefined) {
        return null;
    }

    return {
        tag: 'script',
        key: sanitized.key ? String(sanitized.key).trim() : undefined,
        props: { type: 'application/ld+json' },
        json
    };
}

function escapeJsonForScript(value) {
    return JSON.stringify(value).replace(/</g, '\\u003C');
}

function getTagKey(tag) {
    if (tag.tag === 'title') {
        return 'title';
    }

    if (tag.tag === 'meta') {
        if (tag.key) {
            return `meta:key:${tag.key}`;
        }

        if (tag.props.charset) {
            return 'meta:charset';
        }

        if (tag.props.name) {
            return `meta:name:${tag.props.name}`;
        }

        if (tag.props.property) {
            return `meta:property:${tag.props.property}`;
        }

        if (tag.props['http-equiv']) {
            return `meta:http-equiv:${tag.props['http-equiv']}`;
        }
    }

    if (tag.tag === 'link') {
        if (tag.key) {
            return `link:key:${tag.key}`;
        }

        if (tag.props.rel === 'canonical') {
            return 'link:canonical';
        }

        return `link:${tag.props.rel}:${tag.props.hreflang || tag.props.type || tag.props.href || ''}`;
    }

    if (tag.tag === 'script') {
        if (tag.key) {
            return `script:key:${tag.key}`;
        }
        return `script:${tag.props.type}:${escapeJsonForScript(tag.json)}`;
    }

    return `${tag.tag}:${tag.key || JSON.stringify(tag.props || {})}`;
}

function selectorForTag(tag) {
    if (tag.tag === 'meta') {
        if (tag.props.charset) {
            return 'meta[charset]';
        }

        if (tag.props.name) {
            return `meta[name="${tag.props.name}"]`;
        }

        if (tag.props.property) {
            return `meta[property="${tag.props.property}"]`;
        }

        if (tag.props['http-equiv']) {
            return `meta[http-equiv="${tag.props['http-equiv']}"]`;
        }
    }

    if (tag.tag === 'link' && tag.props.rel === 'canonical') {
        return 'link[rel="canonical"]';
    }

    return null;
}

function createElementForTag(documentRef, tag) {
    const node = documentRef.createElement(tag.tag);
    node.setAttribute(MANAGED_ATTR, 'true');
    return node;
}

export class MetaManager {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.document = options.document || (typeof document !== 'undefined' ? document : null);
        this.lifecycle = new LifecycleScope('MetaManager');
        this.destroyed = false;
        this.entries = new Map();
        this.ownerEntries = new Map();
        this.entryCount = 0;
        this.sequence = 0;
        this.pageEntry = null;
        this.appliedRootState = {
            htmlAttrs: { attrs: {}, classes: [], style: {} },
            bodyAttrs: { attrs: {}, classes: [], style: {} }
        };
        this.init();
    }

    init() {
        if (!this.destroyed && this.lifecycle.cleanups.length > 0) {
            return;
        }

        if (this.destroyed) {
            this.lifecycle = new LifecycleScope('MetaManager');
            this.destroyed = false;
        }

        this.lifecycle.subscribe(this.eventBus, 'PAGE_CHANGED', this.updateMeta.bind(this));
    }

    updateMeta(payload) {
        this.setPageMeta(payload);
    }

    setPageMeta({ title, description, image, locale, canonical, robots } = {}) {
        const currentUrl = this.document?.defaultView?.location?.href || '';
        const entry = {
            title,
            htmlAttrs: locale ? { lang: locale } : {},
            meta: [
                { name: 'description', content: description, key: 'description' },
                { property: 'og:title', content: title, key: 'og:title' },
                { property: 'og:description', content: description, key: 'og:description' },
                { property: 'og:url', content: canonical || currentUrl, key: 'og:url' },
                image ? { property: 'og:image', content: image, key: 'og:image' } : null,
                { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary', key: 'twitter:card' },
                { name: 'twitter:title', content: title, key: 'twitter:title' },
                { name: 'twitter:description', content: description, key: 'twitter:description' },
                image ? { name: 'twitter:image', content: image, key: 'twitter:image' } : null,
                locale ? { property: 'og:locale', content: locale, key: 'og:locale' } : null,
                robots ? { name: 'robots', content: robots, key: 'robots' } : null
            ].filter(Boolean),
            link: canonical ? [{ rel: 'canonical', href: canonical, key: 'canonical' }] : []
        };

        if (this.pageEntry) {
            this.pageEntry.patch(entry);
            return this.pageEntry;
        }

        this.pageEntry = this.push(entry, {
            owner: DEFAULT_PAGE_OWNER,
            key: 'page',
            safe: true,
            priority: 0
        });
        return this.pageEntry;
    }

    push(input = {}, options = {}) {
        const entryId = `meta-${++this.entryCount}`;
        const owner = options.owner || 'runtime';
        const entry = {
            id: entryId,
            owner,
            key: options.key ? String(options.key) : null,
            priority: Number.isFinite(options.priority) ? options.priority : 0,
            safe: options.safe !== false,
            order: ++this.sequence,
            input
        };

        this.entries.set(entryId, entry);
        if (!this.ownerEntries.has(owner)) {
            this.ownerEntries.set(owner, new Set());
        }
        this.ownerEntries.get(owner).add(entryId);
        this.render();

        return {
            id: entryId,
            patch: (nextInput) => {
                const current = this.entries.get(entryId);
                if (!current) {
                    return;
                }
                current.input = nextInput || {};
                current.order = ++this.sequence;
                this.render();
            },
            dispose: () => {
                this.removeEntry(entryId);
            }
        };
    }

    clearOwner(owner) {
        const ids = Array.from(this.ownerEntries.get(owner) || []);
        ids.forEach((entryId) => this.removeEntry(entryId, false));
        if (ids.length) {
            this.ownerEntries.delete(owner);
            this.render();
        }
    }

    snapshot() {
        const resolved = this.resolveState();
        return {
            title: resolved.title,
            tags: resolved.tags.map((tag) => ({
                tag: tag.tag,
                key: tag._resolvedKey,
                props: { ...tag.props },
                json: tag.json ? stripProtoKeys(tag.json) : undefined
            })),
            htmlAttrs: {
                attrs: { ...resolved.htmlAttrs.attrs },
                classes: [...resolved.htmlAttrs.classes],
                style: { ...resolved.htmlAttrs.style }
            },
            bodyAttrs: {
                attrs: { ...resolved.bodyAttrs.attrs },
                classes: [...resolved.bodyAttrs.classes],
                style: { ...resolved.bodyAttrs.style }
            },
            entries: Array.from(this.entries.values()).map((entry) => ({
                id: entry.id,
                owner: entry.owner,
                key: entry.key,
                priority: entry.priority
            }))
        };
    }

    render() {
        if (!this.document) {
            return this.snapshot();
        }

        const resolved = this.resolveState();
        this.applyTitle(resolved.title);
        this.applyRootAttributes(this.document.documentElement, 'htmlAttrs', resolved.htmlAttrs);
        this.applyRootAttributes(this.document.body, 'bodyAttrs', resolved.bodyAttrs);
        this.applyHeadTags(resolved.tags);
        return resolved;
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.lifecycle.destroy();
        this.entries.clear();
        this.ownerEntries.clear();
        this.pageEntry = null;

        if (this.document) {
            this.applyRootAttributes(this.document.documentElement, 'htmlAttrs', { attrs: {}, classes: [], style: {} });
            this.applyRootAttributes(this.document.body, 'bodyAttrs', { attrs: {}, classes: [], style: {} });
            this.applyHeadTags([]);
        }
    }

    removeEntry(entryId, shouldRender = true) {
        const entry = this.entries.get(entryId);
        if (!entry) {
            return;
        }

        this.entries.delete(entryId);
        const ownedEntries = this.ownerEntries.get(entry.owner);
        ownedEntries?.delete(entryId);
        if (ownedEntries?.size === 0) {
            this.ownerEntries.delete(entry.owner);
        }
        if (this.pageEntry?.id === entryId) {
            this.pageEntry = null;
        }
        if (shouldRender) {
            this.render();
        }
    }

    resolveState() {
        const orderedEntries = Array.from(this.entries.values())
            .slice()
            .sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.order - b.order;
            });

        const tags = new Map();
        let title = '';
        let htmlAttrs = { attrs: {}, classes: [], style: {} };
        let bodyAttrs = { attrs: {}, classes: [], style: {} };

        orderedEntries.forEach((entry) => {
            const normalized = this.normalizeEntry(entry.input, entry.safe);

            if (normalized.title) {
                title = normalized.title;
            }

            if (normalized.htmlAttrs) {
                htmlAttrs = normalized.htmlAttrs;
            }

            if (normalized.bodyAttrs) {
                bodyAttrs = normalized.bodyAttrs;
            }

            normalized.tags.forEach((tag) => {
                tag._resolvedKey = getTagKey(tag);
                tags.set(tag._resolvedKey, tag);
            });
        });

        return {
            title,
            tags: Array.from(tags.values()),
            htmlAttrs,
            bodyAttrs
        };
    }

    normalizeEntry(input = {}, safe = true) {
        const normalized = {
            title: '',
            tags: [],
            htmlAttrs: null,
            bodyAttrs: null
        };

        if (typeof input.title === 'string' && input.title.trim()) {
            normalized.title = input.title.trim();
        }

        if (input.htmlAttrs) {
            normalized.htmlAttrs = normalizeAttributeRecord(input.htmlAttrs);
        }

        if (input.bodyAttrs) {
            normalized.bodyAttrs = normalizeAttributeRecord(input.bodyAttrs);
        }

        (Array.isArray(input.meta) ? input.meta : []).forEach((tag) => {
            const normalizedTag = normalizeMetaTag(tag);
            if (normalizedTag) {
                normalized.tags.push(normalizedTag);
            }
        });

        (Array.isArray(input.link) ? input.link : []).forEach((tag) => {
            const normalizedTag = normalizeLinkTag(tag);
            if (normalizedTag) {
                normalized.tags.push(normalizedTag);
            }
        });

        (Array.isArray(input.script) ? input.script : []).forEach((tag) => {
            const normalizedTag = normalizeScriptTag(tag, safe);
            if (normalizedTag) {
                normalized.tags.push(normalizedTag);
            }
        });

        return normalized;
    }

    applyTitle(title) {
        if (!this.document) {
            return;
        }

        if (title) {
            this.document.title = title;
        }
    }

    applyRootAttributes(element, target, nextState) {
        if (!element) {
            return;
        }

        const previous = this.appliedRootState[target];
        const next = nextState || { attrs: {}, classes: [], style: {} };

        Object.keys(previous.attrs).forEach((attr) => {
            if (!(attr in next.attrs)) {
                element.removeAttribute(attr);
            }
        });

        Object.entries(next.attrs).forEach(([attr, value]) => {
            element.setAttribute(attr, value);
        });

        previous.classes.forEach((className) => {
            if (!next.classes.includes(className)) {
                element.classList.remove(className);
            }
        });
        next.classes.forEach((className) => {
            if (className) {
                element.classList.add(className);
            }
        });

        Object.keys(previous.style).forEach((name) => {
            if (!(name in next.style)) {
                element.style.removeProperty(name);
            }
        });
        Object.entries(next.style).forEach(([name, value]) => {
            element.style.setProperty(name, value);
        });

        this.appliedRootState[target] = {
            attrs: { ...next.attrs },
            classes: [...next.classes],
            style: { ...next.style }
        };
    }

    applyHeadTags(tags) {
        if (!this.document) {
            return;
        }

        const desiredKeys = new Set(tags.map((tag) => tag._resolvedKey));
        const head = this.document.head;

        head.querySelectorAll(`[${MANAGED_ATTR}="true"]`).forEach((node) => {
            const key = node.getAttribute(KEY_ATTR);
            if (key && !desiredKeys.has(key)) {
                node.remove();
            }
        });

        tags.forEach((tag) => {
            const key = tag._resolvedKey;
            let node = head.querySelector(`[${KEY_ATTR}="${key}"]`);
            if (!node) {
                const selector = selectorForTag(tag);
                if (selector) {
                    node = head.querySelector(selector);
                }
            }
            if (!node) {
                node = createElementForTag(this.document, tag);
                head.appendChild(node);
            }

            node.setAttribute(MANAGED_ATTR, 'true');
            node.setAttribute(KEY_ATTR, key);
            this.applyTagToNode(node, tag);
        });
    }

    applyTagToNode(node, tag) {
        Array.from(node.attributes).forEach((attribute) => {
            if (attribute.name === MANAGED_ATTR || attribute.name === KEY_ATTR) {
                return;
            }
            node.removeAttribute(attribute.name);
        });

        Object.entries(tag.props || {}).forEach(([name, value]) => {
            if (value === '') {
                node.setAttribute(name, '');
                return;
            }
            node.setAttribute(name, String(value));
        });

        if (tag.tag === 'script') {
            node.textContent = escapeJsonForScript(tag.json);
            return;
        }

        node.textContent = '';
    }
}
