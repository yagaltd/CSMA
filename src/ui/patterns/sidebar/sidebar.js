/**
 * Sidebar Navigation Component JavaScript
 */

export function initSidebars() {
    document.querySelectorAll('.sidebar').forEach(initSidebar);
}

export function initSidebar(sidebar) {
    const toggleButtons = getToggleButtons(sidebar);
    const items = sidebar.querySelectorAll('.sidebar-item');

    // Load saved state from localStorage
    const savedState = localStorage.getItem('sidebar-state');
    const initialState = savedState || sidebar.dataset.state || 'expanded';
    setSidebarState(sidebar, toggleButtons, initialState, { persist: false });

    // Toggle buttons
    toggleButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const isExpanded = sidebar.dataset.state === 'expanded';
            const newState = isExpanded ? 'collapsed' : 'expanded';
            setSidebarState(sidebar, toggleButtons, newState);
        });
    });

    // Navigation items
    items.forEach(item => {
        item.addEventListener('click', (e) => {
            // Remove active from all items
            items.forEach(i => {
                i.dataset.active = 'false';
                i.removeAttribute('aria-current');
            });

            // Set active on clicked item
            item.dataset.active = 'true';
            item.setAttribute('aria-current', 'page');
        });
    });
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

// Auto-init
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebars);
    } else {
        initSidebars();
    }
}
