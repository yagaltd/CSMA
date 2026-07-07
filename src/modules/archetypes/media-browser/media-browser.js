/**
 * Media Browser Archetype — CSMA Token-Driven Thumbnail Grid
 *
 * Factory: createMediaBrowser(container, emit, options) → { update, destroy, getSelected, getItems }
 *
 * Features:
 * - Responsive thumbnail grid with auto-fill columns
 * - Search/filter bar
 * - Sort dropdown (name, date, size)
 * - Item selection (single/multi)
 * - Loading / empty / error states
 * - CSMA design tokens for all visual values
 */

const FILE_ICONS = {
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    file:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
};

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

    // ─── DOM ───────────────────────────────────────────

    const root = document.createElement('div');
    root.className = 'csma-media';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Media browser');

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'csma-media__toolbar';

    const searchInput = document.createElement('input');
    searchInput.className = 'csma-media__search';
    searchInput.type = 'search';
    searchInput.placeholder = 'Search…';
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.toLowerCase();
        renderGrid();
    });

    const sortSelect = document.createElement('select');
    sortSelect.className = 'csma-media__sort';
    ['name', 'date', 'size'].forEach((key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
        sortSelect.appendChild(opt);
    });
    sortSelect.addEventListener('change', () => {
        sortKey = sortSelect.value;
        renderGrid();
    });

    if (searchable) toolbar.appendChild(searchInput);
    if (sortable) toolbar.appendChild(sortSelect);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'csma-media__grid';
    grid.setAttribute('role', 'listbox');
    if (multiSelect) grid.setAttribute('aria-multiselectable', 'true');

    // State overlays
    const stateEls = {};
    ['loading', 'empty', 'error'].forEach((state) => {
        const el = document.createElement('div');
        el.className = 'csma-media__state';
        el.dataset.state = state;
        el.setAttribute('role', 'status');

        if (state === 'loading') {
            const spinner = document.createElement('div');
            spinner.className = 'csma-media__spinner';
            el.appendChild(spinner);
        }
        const msg = document.createElement('span');
        msg.className = 'csma-media__state-message';
        msg.textContent = state === 'empty' ? emptyMessage : state === 'error' ? 'Failed to load' : 'Loading…';
        el.appendChild(msg);

        if (state === 'error') {
            const retry = document.createElement('button');
            retry.className = 'csma-media__state-retry';
            retry.textContent = 'Retry';
            retry.addEventListener('click', () => renderGrid());
            el.appendChild(retry);
        }
        stateEls[state] = el;
    });

    root.appendChild(toolbar);
    root.appendChild(grid);
    Object.values(stateEls).forEach((el) => root.appendChild(el));

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

    function buildItem(item) {
        const card = document.createElement('div');
        card.className = 'csma-media__item';
        card.setAttribute('role', 'option');
        card.dataset.itemId = item.id;
        card.tabIndex = 0;

        if (selectedIds.has(item.id)) {
            card.setAttribute('aria-selected', 'true');
        }

        // Thumbnail
        if (item.thumbnail || item.src) {
            const img = document.createElement('img');
            img.className = 'csma-media__thumbnail';
            img.src = item.thumbnail || item.src;
            img.alt = item.name || item.label || '';
            img.loading = 'lazy';
            img.addEventListener('error', () => {
                img.style.display = 'none';
                card.insertBefore(buildPlaceholder(item), card.firstChild);
            });
            card.appendChild(img);
        } else {
            card.appendChild(buildPlaceholder(item));
        }

        // Info
        const info = document.createElement('div');
        info.className = 'csma-media__info';

        const name = document.createElement('div');
        name.className = 'csma-media__name';
        name.textContent = item.name || item.label || item.id;
        info.appendChild(name);

        if (item.meta || item.size || item.date) {
            const meta = document.createElement('div');
            meta.className = 'csma-media__meta';
            meta.textContent = item.meta || formatMeta(item);
            info.appendChild(meta);
        }

        card.appendChild(info);

        // Click handler
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

        return card;
    }

    function buildPlaceholder(item) {
        const div = document.createElement('div');
        div.className = 'csma-media__thumbnail csma-media__thumbnail--placeholder';
        const type = item.type || 'file';
        div.innerHTML = FILE_ICONS[type] || FILE_ICONS.file;
        return div;
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
        grid.innerHTML = '';

        if (filtered.length === 0) {
            setState(searchQuery ? 'empty' : 'empty');
            return;
        }

        setState(null);
        filtered.forEach((item) => grid.appendChild(buildItem(item)));
    }

    function setState(state) {
        delete root.dataset.state;
        if (state) root.dataset.state = state;
    }

    // ─── Initial Render ────────────────────────────────

    container.appendChild(root);
    if (currentItems.length === 0) setState('empty');
    else renderGrid();

    // ─── Public API ────────────────────────────────────

    return {
        /** Update items array. */
        update(newItems) {
            currentItems = [...newItems];
            error = null;
            renderGrid();
        },

        /** Get currently selected item IDs. */
        getSelected() { return [...selectedIds]; },

        /** Get current items. */
        getItems() { return currentItems; },

        /** Set loading state. */
        setLoading(loading) {
            isLoading = loading;
            setState(loading ? 'loading' : null);
        },

        /** Destroy. */
        destroy() { root.remove(); },
    };
}
