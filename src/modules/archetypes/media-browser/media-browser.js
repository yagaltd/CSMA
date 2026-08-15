/**
 * Media Browser Archetype — CSMA Token-Driven Thumbnail Grid
 *
 * Factory: createMediaBrowser(container, emit, options) → { update, destroy, getSelected, getItems }
 *
 * Phase 3.1-C: all DOM construction routes through `getComposer().mountTree()`.
 * No raw document.createElement. Events are wired post-mount on the real DOM
 * elements the composer returns. SVG icons compose through mountTree.
 *
 * Features:
 * - Responsive thumbnail grid with auto-fill columns
 * - Search/filter bar
 * - Sort dropdown (name, date, size)
 * - Item selection (single/multi)
 * - Loading / empty / error states
 * - CSMA design tokens for all visual values
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { clearChildren } from '../../../utils/dom.js';

// ─── SVG icon specs (composed through mountTree) ──────────────────

function fileIconSpec(type = 'file') {
    const svgAttrs = {
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
        stroke: 'currentColor',
        'stroke-width': '1.5'
    };
    if (type === 'image') {
        return spec('svg', { attrs: svgAttrs, children: [
            spec('rect', { attrs: { x: '3', y: '3', width: '18', height: '18', rx: '2' } }),
            spec('circle', { attrs: { cx: '8.5', cy: '8.5', r: '1.5' } }),
            spec('path', { attrs: { d: 'm21 15-5-5L5 21' } })
        ]});
    }
    if (type === 'video') {
        return spec('svg', { attrs: svgAttrs, children: [
            spec('polygon', { attrs: { points: '5 3 19 12 5 21 5 3' } })
        ]});
    }
    return spec('svg', { attrs: svgAttrs, children: [
        spec('path', { attrs: { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' } }),
        spec('polyline', { attrs: { points: '14 2 14 8 20 8' } })
    ]});
}

export function createMediaBrowser(container, emit, options = {}) {
    const {
        items = [],
        searchable = true,
        sortable = true,
        selectable = false,
        multiSelect = false,
        itemRenderer = null,
        onItemClick = null,
        emptyMessage = 'No media found',
    } = options;

    let currentItems = [...items];
    let selectedIds = new Set();
    let searchQuery = '';
    let sortKey = 'name';
    let isLoading = false;
    let error = null;
    let itemCleanups = [];

    const composer = getComposer();

    // ─── Initial mount via mountTree ───────────────────

    const gridAttrs = { role: 'listbox' };
    if (multiSelect) gridAttrs['aria-multiselectable'] = 'true';

    const toolbarChildren = [];
    if (searchable) {
        toolbarChildren.push(spec('input', {
            className: 'csma-media__search',
            attrs: { type: 'search', placeholder: 'Search…' }
        }));
    }
    if (sortable) {
        toolbarChildren.push(spec('select', {
            className: 'csma-media__sort',
            children: ['name', 'date', 'size'].map((key) =>
                spec('option', {
                    attrs: { value: key },
                    text: key.charAt(0).toUpperCase() + key.slice(1)
                })
            )
        }));
    }

    function buildStateSpec(state) {
        const children = [];
        if (state === 'loading') {
            children.push(spec('div', { className: 'csma-media__spinner' }));
        }
        children.push(spec('span', {
            className: 'csma-media__state-message',
            text: state === 'empty' ? emptyMessage : state === 'error' ? 'Failed to load' : 'Loading…'
        }));
        if (state === 'error') {
            children.push(spec('button', { className: 'csma-media__state-retry', text: 'Retry' }));
        }
        return spec('div', {
            className: 'csma-media__state',
            dataset: { state },
            attrs: { role: 'status' },
            children
        });
    }

    const { root, cleanup: rootCleanup } = composer.mountTree(spec('div', {
        className: 'csma-media',
        attrs: { role: 'region', 'aria-label': 'Media browser' },
        children: [
            spec('div', { className: 'csma-media__toolbar', children: toolbarChildren }),
            spec('div', { className: 'csma-media__grid', attrs: gridAttrs }),
            buildStateSpec('loading'),
            buildStateSpec('empty'),
            buildStateSpec('error')
        ]
    }), container);

    // ─── Query mounted elements + wire events ──────────

    const toolbar = root.querySelector('.csma-media__toolbar');
    const searchInput = toolbar.querySelector('.csma-media__search');
    const sortSelect = toolbar.querySelector('.csma-media__sort');
    const grid = root.querySelector('.csma-media__grid');
    const retryBtn = root.querySelector('.csma-media__state-retry');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value.toLowerCase();
            renderGrid();
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            sortKey = sortSelect.value;
            renderGrid();
        });
    }
    if (retryBtn) {
        retryBtn.addEventListener('click', () => renderGrid());
    }

    // ─── Item spec builder ─────────────────────────────

    function buildPlaceholderSpec(item) {
        return spec('div', {
            className: 'csma-media__thumbnail csma-media__thumbnail--placeholder',
            children: [fileIconSpec(item.type || 'file')]
        });
    }

    /**
     * Image-URL policy for the media browser.
     *
     * mountTree's attribute whitelist (AIUIComposerService.isSafeUrl) only
     * accepts http/https/mailto/tel URLs, so data:/blob: thumbnails cannot be
     * mounted as `src` attributes. The media browser renders thumbnail URLs
     * supplied by the embedding app, so it applies those URLs as DOM
     * *properties* (post-mount) instead — and enforces its own image-only
     * policy here: http(s), same-origin relative paths, blob:, and data:image/*
     * are renderable; everything else (javascript:, etc.) falls back to the
     * placeholder icon.
     */
    function isRenderableImageUrl(value) {
        if (typeof value !== 'string' || value.length === 0) return false;
        try {
            const url = new URL(value, globalThis.location?.origin || 'http://localhost');
            if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'blob:') return true;
            if (url.protocol === 'data:') return /^data:image\//i.test(value);
            return false;
        } catch {
            return false;
        }
    }

    function buildItemSpec(item) {
        const cardAttrs = { role: 'option', tabindex: '0' };
        if (selectedIds.has(item.id)) cardAttrs['aria-selected'] = 'true';

        const children = [];
        const imageSrc = item.thumbnail || item.src;
        if (isRenderableImageUrl(imageSrc)) {
            const imgSpec = {
                className: 'csma-media__thumbnail',
                attrs: { alt: item.name || item.label || '' }
                // NOTE: 'loading' is set as a DOM PROPERTY post-mount
            };
            if (composer.isSafeUrl(imageSrc)) {
                // Composer-safe URL (http/https/mailto/tel + same-origin
                // relative paths) — mount as a validated attribute so the
                // golden DOM keeps its `src` attribute.
                imgSpec.attrs.src = imageSrc;
            } else {
                // data:/blob: URLs are safe for <img> but rejected by the
                // composer's attribute whitelist — carry them on an inert
                // data-* attribute and apply as a DOM property post-mount.
                imgSpec.dataset = { imgSrc: imageSrc };
            }
            children.push(spec('img', imgSpec));
        } else {
            children.push(buildPlaceholderSpec(item));
        }

        const infoChildren = [
            spec('div', { className: 'csma-media__name', text: item.name || item.label || item.id })
        ];
        if (item.meta || item.size || item.date) {
            infoChildren.push(spec('div', {
                className: 'csma-media__meta',
                text: item.meta || formatMeta(item)
            }));
        }
        children.push(spec('div', { className: 'csma-media__info', children: infoChildren }));

        return spec('div', {
            className: 'csma-media__item',
            attrs: cardAttrs,
            dataset: { itemId: item.id },
            children
        });
    }

    function wireItemEvents(card, item) {
        // Image properties set as DOM properties (not reflected to attributes)
        // + runtime error handler.
        const img = card.querySelector('img.csma-media__thumbnail');
        if (img) {
            img.loading = 'lazy';
            // Apply data:/blob: thumbnails as a DOM property (see
            // isRenderableImageUrl above). Already validated before it ever
            // reaches a data-* attribute, so assignment cannot execute script.
            const propertySrc = img.dataset.imgSrc;
            if (propertySrc) img.src = propertySrc;
            img.addEventListener('error', () => {
                img.style.display = 'none';
                const { root: phRoot, cleanup } = composer.mountTree(buildPlaceholderSpec(item), card);
                itemCleanups.push(cleanup);
                card.insertBefore(phRoot, img);
            });
        }

        card.addEventListener('click', () => {
            if (selectable) {
                if (multiSelect) {
                    if (selectedIds.has(item.id)) selectedIds.delete(item.id);
                    else selectedIds.add(item.id);
                } else {
                    selectedIds.clear();
                    selectedIds.add(item.id);
                }
                renderGrid();
            }
            if (onItemClick) onItemClick(item);
            if (emit) emit('media:select', { item, selectedIds: [...selectedIds] });
        });
    }

    // ─── Render ────────────────────────────────────────

    function getFilteredItems() {
        let filtered = [...currentItems];
        if (searchQuery) {
            filtered = filtered.filter((item) =>
                (item.name || item.label || '').toLowerCase().includes(searchQuery)
            );
        }
        filtered.sort((a, b) => {
            const aVal = a[sortKey] || '';
            const bVal = b[sortKey] || '';
            if (typeof aVal === 'number') return aVal - bVal;
            return String(aVal).localeCompare(String(bVal));
        });
        return filtered;
    }

    function formatMeta(item) {
        const parts = [];
        if (item.size) parts.push(formatSize(item.size));
        if (item.date) parts.push(item.date);
        if (item.type) parts.push(item.type);
        return parts.join(' · ');
    }

    function formatSize(bytes) {
        if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
        if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
        return bytes + ' B';
    }

    function renderGrid() {
        const filtered = getFilteredItems();
        itemCleanups.forEach((fn) => { try { fn(); } catch {} });
        itemCleanups = [];
        clearChildren(grid);

        if (filtered.length === 0) {
            setState('empty');
            return;
        }

        setState(null);
        filtered.forEach((item) => {
            const itemSpec = buildItemSpec(item);
            const { root: itemRoot, cleanup } = composer.mountTree(itemSpec, grid);
            itemCleanups.push(cleanup);
            wireItemEvents(itemRoot, item);
        });
    }

    function setState(state) {
        delete root.dataset.state;
        if (state) root.dataset.state = state;
    }

    // ─── Initial Render ────────────────────────────────

    if (currentItems.length === 0) setState('empty');
    else renderGrid();

    // ─── Public API ────────────────────────────────────

    return {
        update(newItems) {
            currentItems = [...newItems];
            error = null;
            renderGrid();
        },

        getSelected() { return [...selectedIds]; },

        getItems() { return currentItems; },

        setLoading(loading) {
            isLoading = loading;
            setState(loading ? 'loading' : null);
        },

        destroy() {
            itemCleanups.forEach((fn) => { try { fn(); } catch {} });
            itemCleanups = [];
            rootCleanup();
            root.remove();
        },
    };
}
