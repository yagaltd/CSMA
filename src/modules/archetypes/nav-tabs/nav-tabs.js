/**
 * Nav Tabs Archetype — CSMA Token-Driven Horizontal Tab Bar
 *
 * Factory: createNavTabs(container, emit, options) → { update, destroy, getActive, setActive, addTab, removeTab }
 *
 * Features:
 * - Horizontal tab bar with overflow scroll
 * - Overflow arrow indicators (left/right)
 * - Active tab tracking with aria-selected
 * - Optional close button per tab
 * - Optional badge count per tab
 * - Keyboard navigation (Arrow keys)
 * - CSMA design tokens for all visual values
 */

import { clearChildren, createIcon, createSvgElement } from '../../../utils/dom.js';

function createCloseIcon() {
    return createIcon('0 0 12 12', [
        createSvgElement('line', { x1: 3, y1: 3, x2: 9, y2: 9 }),
        createSvgElement('line', { x1: 9, y1: 3, x2: 3, y2: 9 })
    ], { stroke: 'currentColor', 'stroke-width': 1.5 });
}

function createArrowIcon(direction) {
    return createIcon('0 0 12 12', [
        createSvgElement('polyline', { points: direction === 'left' ? '8 2 4 6 8 10' : '4 2 8 6 4 10' })
    ], { stroke: 'currentColor', 'stroke-width': 1.5 });
}

export function createNavTabs(container, emit, options = {}) {
    const {
        tabs = [],
        closable = false,
        onTabClick = null,
        onTabClose = null,
    } = options;

    let tabList = [...tabs];
    let activeId = tabs.find((t) => t.active)?.id || tabs[0]?.id || null;

    // ─── DOM ───────────────────────────────────────────

    const root = document.createElement('div');
    root.className = 'csma-navtabs';
    root.setAttribute('role', 'tablist');
    root.setAttribute('aria-label', 'Navigation tabs');

    // Left arrow
    const arrowLeft = document.createElement('button');
    arrowLeft.className = 'csma-navtabs__arrow csma-navtabs__arrow--left';
    arrowLeft.setAttribute('aria-label', 'Scroll tabs left');
    arrowLeft.appendChild(createArrowIcon('left'));
    arrowLeft.addEventListener('click', () => scrollTabs(-200));

    // Scroll container
    const scrollEl = document.createElement('div');
    scrollEl.className = 'csma-navtabs__scroll';

    // Right arrow
    const arrowRight = document.createElement('button');
    arrowRight.className = 'csma-navtabs__arrow csma-navtabs__arrow--right';
    arrowRight.setAttribute('aria-label', 'Scroll tabs right');
    arrowRight.appendChild(createArrowIcon('right'));
    arrowRight.addEventListener('click', () => scrollTabs(200));

    root.appendChild(arrowLeft);
    root.appendChild(scrollEl);
    root.appendChild(arrowRight);

    // ─── Build Tab ─────────────────────────────────────

    function buildTab(tab) {
        const el = document.createElement('div');
        el.className = 'csma-navtabs__tab';
        el.setAttribute('role', 'tab');
        el.dataset.tabId = tab.id;
        el.tabIndex = tab.id === activeId ? 0 : -1;

        if (tab.id === activeId) {
            el.setAttribute('aria-selected', 'true');
        }

        // Label
        const label = document.createElement('span');
        label.textContent = tab.label || tab.id;
        el.appendChild(label);

        // Badge
        if (tab.badge != null) {
            const badge = document.createElement('span');
            badge.className = 'csma-navtabs__tab-badge';
            badge.textContent = String(tab.badge);
            el.appendChild(badge);
        }

        // Close button
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'csma-navtabs__close';
            closeBtn.appendChild(createCloseIcon());
            closeBtn.setAttribute('aria-label', `Close ${tab.label || tab.id}`);
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTab(tab.id);
            });
            el.appendChild(closeBtn);
        }

        // Click
        el.addEventListener('click', () => {
            setActive(tab.id);
            if (onTabClick) onTabClick(tab);
            if (emit) emit('navtabs:select', { id: tab.id, tab });
        });

        return el;
    }

    function renderAll() {
        clearChildren(scrollEl);
        tabList.forEach((tab) => scrollEl.appendChild(buildTab(tab)));
        updateOverflowIndicators();
    }

    // ─── Overflow ──────────────────────────────────────

    function updateOverflowIndicators() {
        const canScrollLeft = scrollEl.scrollLeft > 1;
        const canScrollRight = scrollEl.scrollLeft + scrollEl.clientWidth < scrollEl.scrollWidth - 1;

        if (canScrollLeft) root.classList.add('csma-navtabs--overflow-left');
        else root.classList.remove('csma-navtabs--overflow-left');

        if (canScrollRight) root.classList.add('csma-navtabs--overflow-right');
        else root.classList.remove('csma-navtabs--overflow-right');
    }

    function scrollTabs(delta) {
        scrollEl.scrollBy({ left: delta, behavior: 'smooth' });
        setTimeout(updateOverflowIndicators, 200);
    }

    scrollEl.addEventListener('scroll', updateOverflowIndicators);

    // Resize observer for overflow
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(updateOverflowIndicators).observe(scrollEl);
    }

    // ─── Keyboard ──────────────────────────────────────

    root.addEventListener('keydown', (e) => {
        const tabs = scrollEl.querySelectorAll('[role="tab"]');
        const idx = Array.from(tabs).findIndex((t) => t.dataset.tabId === activeId);
        if (idx < 0) return;

        let next = idx;
        if (e.key === 'ArrowRight') next = Math.min(idx + 1, tabs.length - 1);
        else if (e.key === 'ArrowLeft') next = Math.max(idx - 1, 0);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;

        e.preventDefault();
        const tabId = tabs[next].dataset.tabId;
        setActive(tabId);
        tabs[next].focus();
    });

    // ─── Public Methods ────────────────────────────────

    function setActive(id) {
        activeId = id;
        renderAll();
        // Scroll active tab into view
        const activeEl = scrollEl.querySelector(`[data-tab-id="${id}"]`);
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function removeTab(id) {
        const tab = tabList.find((t) => t.id === id);
        tabList = tabList.filter((t) => t.id !== id);

        if (id === activeId) {
            const removedIdx = (tabs.findIndex((t) => t.id === id));
            const next = tabList[Math.min(removedIdx, tabList.length - 1)];
            activeId = next?.id || null;
        }

        renderAll();
        if (onTabClose && tab) onTabClose(tab);
        if (emit) emit('navtabs:close', { id, tab });
    }

    function addTab(tab) {
        tabList.push(tab);
        renderAll();
    }

    function getActive() {
        return activeId;
    }

    function getTabs() {
        return tabList;
    }

    // ─── Initial Render ────────────────────────────────

    container.appendChild(root);
    renderAll();

    // ─── Public API ────────────────────────────────────

    return {
        update(newTabs) {
            tabList = [...newTabs];
            if (!tabList.find((t) => t.id === activeId)) {
                activeId = tabList[0]?.id || null;
            }
            renderAll();
        },
        getActive,
        getTabs,
        setActive,
        addTab,
        removeTab,
        destroy() {
            root.remove();
        },
    };
}
