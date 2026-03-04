/**
 * CSMA Navbar Component
 * Type II (Self-Contained) - Navigation with mobile hamburger and EventBus integration
 *
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 *
 * Features:
 * - Mobile hamburger menu with smooth animations
 * - Desktop horizontal navigation
 * - Active state management via data attributes
 * - EventBus integration (INTENT_NAV_CLICK)
 * - Keyboard accessibility (ESC to close mobile menu)
 * - Touch-friendly mobile interactions
 */

let navbarInstances = new Map();

/**
 * Initialize Navbar system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initNavbarSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Navbar] EventBus not provided, Navbar system not initialized');
        return () => { };
    }

    const navbars = document.querySelectorAll('.navbar:not([data-initialized])');
    const cleanups = [];

    navbars.forEach(navbar => {
        const cleanup = initNavbar(navbar, eventBus);
        cleanups.push(cleanup);
        navbar.dataset.initialized = 'true';
    });

    // Subscribe to navigation events
    const unsubscribeNavClick = eventBus.subscribe('INTENT_NAV_CLICK', (payload) => {
        try {
            handleNavigationIntent(payload);
        } catch (error) {
            console.error('[Navbar] Failed to handle navigation intent:', error);
        }
    });

    const unsubscribeNavUpdate = eventBus.subscribe('NAV_ACTIVE_CHANGED', (payload) => {
        try {
            updateActiveNavItem(payload.activePath);
        } catch (error) {
            console.error('[Navbar] Failed to update active nav item:', error);
        }
    });

    return () => {
        unsubscribeNavClick();
        unsubscribeNavUpdate();
        cleanups.forEach(cleanup => cleanup());
        navbarInstances.clear();
    };
}

/**
 * Initialize a single navbar with EventBus integration
 * @param {HTMLElement} navbar - Navbar container element
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
function initNavbar(navbar, eventBus) {
    if (!navbar || !eventBus) return () => { };

    const navbarId = navbar.id || `navbar-${Date.now()}`;
    const hamburger = navbar.querySelector('.navbar-hamburger');
    const mobileMenu = navbar.querySelector('.navbar-mobile-menu');
    const navLinks = navbar.querySelectorAll('.navbar-link');
    const overlay = navbar.querySelector('.navbar-overlay');

    const eventHandlers = [];

    // Hamburger menu toggle
    if (hamburger) {
        const handleHamburgerClick = (e) => {
            e.preventDefault();
            toggleMobileMenu(navbar);
        };
        hamburger.addEventListener('click', handleHamburgerClick);
        eventHandlers.push({ element: hamburger, event: 'click', handler: handleHamburgerClick });
    }

    // Mobile menu overlay click
    if (overlay) {
        const handleOverlayClick = () => {
            closeMobileMenu(navbar);
        };
        overlay.addEventListener('click', handleOverlayClick);
        eventHandlers.push({ element: overlay, event: 'click', handler: handleOverlayClick });
    }

    // Navigation link clicks
    navLinks.forEach(link => {
        const handleLinkClick = (e) => {
            const href = link.getAttribute('href');
            const navPath = link.dataset.navPath || href;

            // Publish navigation intent
            eventBus.publish('INTENT_NAV_CLICK', {
                navPath,
                navbarId,
                linkText: link.textContent.trim(),
                timestamp: Date.now()
            });

            // Close mobile menu after navigation
            if (window.innerWidth < 768) {
                closeMobileMenu(navbar);
            }
        };
        link.addEventListener('click', handleLinkClick);
        eventHandlers.push({ element: link, event: 'click', handler: handleLinkClick });
    });

    // ESC key to close mobile menu
    const handleEscape = (e) => {
        if (e.key === 'Escape' && navbar.dataset.mobileOpen === 'true') {
            closeMobileMenu(navbar);
        }
    };
    document.addEventListener('keydown', handleEscape);
    eventHandlers.push({ element: document, event: 'keydown', handler: handleEscape });

    // Store instance for cleanup
    navbarInstances.set(navbarId, { navbar, eventBus });

    // Initialize active state
    updateActiveNavItem(window.location.pathname, navbar);

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        navbarInstances.delete(navbarId);
    };
}

/**
 * Toggle mobile menu visibility
 * @param {HTMLElement} navbar - Navbar container
 */
function toggleMobileMenu(navbar) {
    const isOpen = navbar.dataset.mobileOpen === 'true';
    if (isOpen) {
        closeMobileMenu(navbar);
    } else {
        openMobileMenu(navbar);
    }
}

/**
 * Open mobile menu
 * @param {HTMLElement} navbar - Navbar container
 */
function openMobileMenu(navbar) {
    navbar.dataset.mobileOpen = 'true';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Focus management
    const firstLink = navbar.querySelector('.navbar-mobile-menu .navbar-link');
    if (firstLink) {
        setTimeout(() => firstLink.focus(), 100);
    }
}

/**
 * Close mobile menu
 * @param {HTMLElement} navbar - Navbar container
 */
function closeMobileMenu(navbar) {
    navbar.dataset.mobileOpen = 'false';
    document.body.style.overflow = ''; // Restore scrolling

    // Focus management
    const hamburger = navbar.querySelector('.navbar-hamburger');
    if (hamburger) {
        hamburger.focus();
    }
}

/**
 * Handle navigation intent from EventBus
 * @param {Object} payload - Navigation intent payload
 */
function handleNavigationIntent(payload) {
    const { navPath } = payload;

    // Update URL if it's a client-side route
    if (navPath && navPath.startsWith('/')) {
        // For SPA routing, you might integrate with a router here
        // For now, just update active states
        updateActiveNavItem(navPath);
    }
}

/**
 * Update active navigation item across all navbars
 * @param {string} activePath - Active navigation path
 * @param {HTMLElement} targetNavbar - Specific navbar to update (optional)
 */
function updateActiveNavItem(activePath, targetNavbar) {
    const navbars = targetNavbar ? [targetNavbar] : document.querySelectorAll('.navbar');

    navbars.forEach(navbar => {
        const navLinks = navbar.querySelectorAll('.navbar-link');

        navLinks.forEach(link => {
            const linkPath = link.dataset.navPath || link.getAttribute('href');
            const isActive = linkPath === activePath ||
                (activePath && linkPath && activePath.startsWith(linkPath) && linkPath !== '/');

            if (isActive) {
                link.dataset.active = 'true';
                link.setAttribute('aria-current', 'page');
            } else {
                delete link.dataset.active;
                link.removeAttribute('aria-current');
            }
        });
    });
}

/**
 * Programmatically set active navigation item
 * @param {string} navPath - Navigation path to set as active
 */
export function setActiveNavItem(navPath) {
    updateActiveNavItem(navPath);
}

/**
 * Get current active navigation path
 * @returns {string|null} Current active path
 */
export function getActiveNavPath() {
    const activeLink = document.querySelector('.navbar-link[data-active="true"]');
    if (activeLink) {
        return activeLink.dataset.navPath || activeLink.getAttribute('href');
    }
    return null;
}

/**
 * Toggle navbar visibility (useful for sticky navbars)
 * @param {string} navbarId - Navbar ID
 * @param {boolean} visible - Whether to show or hide
 */
export function setNavbarVisibility(navbarId, visible) {
    const navbar = document.getElementById(navbarId);
    if (navbar) {
        navbar.dataset.hidden = visible ? 'false' : 'true';
    }
}