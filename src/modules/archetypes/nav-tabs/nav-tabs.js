/**
 * Nav Tabs Archetype — CSMA Token-Driven Horizontal Tab Bar
 *
 * Factory: createNavTabs(container, emit, options) → { update, destroy, getActive, setActive, addTab, removeTab, getTabs }
 *
 * Phase 3.0 — aiui-native (Option a: factory-wrapping). All DOM construction
 * routes through `getComposer().mountTree(spec, target)`; no raw
 * `document.createElement` in archetype internals. Events are wired on the
 * mounted DOM (see the Layer 2 archetype pattern in docs/architecture/SKILL.md).
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

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { clearChildren } from '../../../utils/dom.js';

// ─── SVG icon specs (composed through mountTree like all other DOM) ────

function svgIconSpec(children) {
    return spec('svg', {
        attrs: {
            viewBox: '0 0 12 12',
            fill: 'none',
            'aria-hidden': 'true',
            focusable: 'false',
            stroke: 'currentColor',
            'stroke-width': '1.5'
        },
        children
    });
}

function arrowIconSpec(direction) {
    const points = direction === 'left' ? '8 2 4 6 8 10' : '4 2 8 6 4 10';
    return svgIconSpec([spec('polyline', { attrs: { points } })]);
}

function closeIconSpec() {
    return svgIconSpec([
        spec('line', { attrs: { x1: '3', y1: '3', x2: '9', y2: '9' } }),
        spec('line', { attrs: { x1: '9', y1: '3', x2: '3', y2: '9' } })
    ]);
}

// ─── Spec builders ────────────────────────────────────────────────────

function arrowSpec(direction) {
    return spec('button', {
        className: `csma-navtabs__arrow csma-navtabs__arrow--${direction}`,
        attrs: { 'aria-label': `Scroll tabs ${direction}` },
        children: [arrowIconSpec(direction)]
    });
}

function tabSpec(tab, activeId, closable) {
    const children = [spec('span', { text: tab.label || tab.id })];
    if (tab.badge != null) {
        children.push(spec('span', { className: 'csma-navtabs__tab-badge', text: String(tab.badge) }));
    }
    if (closable) {
        children.push(spec('button', {
            className: 'csma-navtabs__close',
            attrs: { 'aria-label': `Close ${tab.label || tab.id}` },
            children: [closeIconSpec()]
        }));
    }
    const attrs = { role: 'tab', tabindex: String(tab.id === activeId ? 0 : -1) };
    if (tab.id === activeId) attrs['aria-selected'] = 'true';
    return spec('div', {
        className: 'csma-navtabs__tab',
        attrs,
        dataset: { tabId: tab.id },
        children
    });
}

export function createNavTabs(container, emit, options = {}) {
    const {
        tabs = [],
        closable = false,
        onTabClick = null,
        onTabClose = null,
    } = options;

    const composer = getComposer();

    let tabList = [...tabs];
    let activeId = tabs.find((t) => t.active)?.id || tabs[0]?.id || null;

    // ─── Initial mount (static shell; tabs render into the scroll slot) ──

    const { root, cleanup } = composer.mountTree(spec('div', {
        className: 'csma-navtabs',
        attrs: { role: 'tablist', 'aria-label': 'Navigation tabs' },
        children: [
            arrowSpec('left'),
            spec('div', { className: 'csma-navtabs__scroll' }),
            arrowSpec('right')
        ]
    }), container);

    const scrollEl = root.querySelector('.csma-navtabs__scroll');
    const arrowLeft = root.querySelector('.csma-navtabs__arrow--left');
    const arrowRight = root.querySelector('.csma-navtabs__arrow--right');

    arrowLeft.addEventListener('click', () => scrollTabs(-200));
    arrowRight.addEventListener('click', () => scrollTabs(200));

    let resizeObserver = null;

    // ─── Tab rendering + event wiring ────────────────────────────────

    function wireTabEvents(tabEl, tab) {
        tabEl.addEventListener('click', () => {
            setActive(tab.id);
            if (onTabClick) onTabClick(tab);
            if (emit) emit('navtabs:select', { id: tab.id, tab });
        });
        if (closable) {
            const closeBtn = tabEl.querySelector('.csma-navtabs__close');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTab(tab.id);
            });
        }
    }

    function renderAll() {
        clearChildren(scrollEl);
        if (tabList.length === 0) {
            updateOverflowIndicators();
            return;
        }
        const specs = tabList.map((tab) => tabSpec(tab, activeId, closable));
        const { root: frag } = composer.mountTree(specs);
        const tabEls = [...frag.children];
        tabList.forEach((tab, i) => wireTabEvents(tabEls[i], tab));
        scrollEl.appendChild(frag);
        updateOverflowIndicators();
    }

    // ─── Overflow ────────────────────────────────────────────────────

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

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(updateOverflowIndicators);
        resizeObserver.observe(scrollEl);
    }

    // ─── Keyboard ────────────────────────────────────────────────────

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

    // ─── Public Methods ──────────────────────────────────────────────

    function setActive(id) {
        activeId = id;
        renderAll();
        const activeEl = scrollEl.querySelector(`[data-tab-id="${id}"]`);
        if (activeEl && typeof activeEl.scrollIntoView === 'function') {
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

    // ─── Initial Render ──────────────────────────────────────────────

    renderAll();

    // ─── Public API ──────────────────────────────────────────────────

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
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            cleanup();
        },
    };
}
