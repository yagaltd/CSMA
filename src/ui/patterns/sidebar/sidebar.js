/**
 * Sidebar Navigation Component JavaScript
 */

let sidebarCleanup = null;
let domReadyCleanup = null;

export function initSidebars() {
    sidebarCleanup?.();

    const cleanups = [];
    document.querySelectorAll('.sidebar').forEach((sidebar) => {
        cleanups.push(initSidebar(sidebar));
    });

    sidebarCleanup = () => {
        cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
        sidebarCleanup = null;
    };

    return sidebarCleanup;
}

export function initSidebar(sidebar) {
    const toggleButtons = getToggleButtons(sidebar);
    const items = Array.from(sidebar.querySelectorAll('.sidebar-item'));
    const cleanups = [];

    const savedState = localStorage.getItem('sidebar-state');
    const initialState = savedState || sidebar.dataset.state || 'expanded';
    setSidebarState(sidebar, toggleButtons, initialState, { persist: false });

    toggleButtons.forEach((btn) => {
        const handleClick = () => {
            const isExpanded = sidebar.dataset.state === 'expanded';
            const newState = isExpanded ? 'collapsed' : 'expanded';
            setSidebarState(sidebar, toggleButtons, newState);
        };
        btn.addEventListener('click', handleClick);
        cleanups.push(() => btn.removeEventListener('click', handleClick));
    });

    items.forEach((item) => {
        const handleClick = () => {
            items.forEach((entry) => {
                entry.dataset.active = 'false';
                entry.removeAttribute('aria-current');
            });

            item.dataset.active = 'true';
            item.setAttribute('aria-current', 'page');
        };
        item.addEventListener('click', handleClick);
        cleanups.push(() => item.removeEventListener('click', handleClick));
    });

    return () => {
        cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
    };
}

function getToggleButtons(sidebar) {
    const sidebarId = sidebar.id;
    if (sidebarId) {
        const buttons = Array.from(document.querySelectorAll(`[data-sidebar-toggle="${sidebarId}"]`));
        if (buttons.length) {
            return buttons;
        }
    }
    return Array.from(sidebar.querySelectorAll('[data-sidebar-toggle]'));
}

function setSidebarState(sidebar, toggleButtons, state, options = {}) {
    const { persist = true } = options;
    sidebar.dataset.state = state;
    if (persist) {
        localStorage.setItem('sidebar-state', state);
    }
    applySidebarOffset(state);
    updateToggleButtons(toggleButtons, state);
}

function updateToggleButtons(toggleButtons, state) {
    toggleButtons.forEach((btn) => {
        const expanded = state === 'expanded';
        btn.setAttribute('aria-label', expanded ? 'Collapse sidebar' : 'Expand sidebar');
    });
}

function applySidebarOffset(state) {
    document.documentElement.dataset.sidebarState = state;
}

function bootSidebars() {
    domReadyCleanup?.();
    initSidebars();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        const handleReady = () => {
            domReadyCleanup?.();
            domReadyCleanup = null;
            bootSidebars();
        };
        document.addEventListener('DOMContentLoaded', handleReady, { once: true });
        domReadyCleanup = () => document.removeEventListener('DOMContentLoaded', handleReady);
    } else {
        bootSidebars();
    }
}
