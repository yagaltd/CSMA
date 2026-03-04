/**
 * CSMA UI Component Registry
 * 
 * Auto-initializes all UI components with EventBus integration.
 * This is the single source of truth for UI component initialization.
 * 
 * Component Types:
 * - Type I (Pure UI): No JavaScript (badge, card, avatar, separator, skeleton, select)
 * - Type II (Self-Contained): Component manages its own state via EventBus
 *   Exports: init[Component]System(eventBus) -> cleanupFunction
 *   Examples: Dialog, Popover, Toast, Tabs, Accordion, Dropdown
 * - Type III (Service-Backed): Component logic in separate Service
 *   Exports: create[Component]Service(eventBus) -> serviceInstance
 *   Examples: Slider (SliderService.js)
 * 
 * Initialization Pattern (Type II):
 * 1. Export init[Component]System(eventBus) that returns cleanup function
 * 2. System subscribes to INTENT_[COMPONENT]_* events
 * 3. Components publish events for other listeners
 * 4. Register in this file for auto-initialization
 * 
 * ⚠️  WARNING: Manual Registration Required
 * When adding new components to this file, you MUST do all:
 * 1. IMPORT: Add import statement (lines 27-40)
 * 2. INITIALIZE: Call init function in initUI() (lines 55-106)
 * 3. CLEANUP: Add cleanup() to window.csma.componentCleanup (lines 93-106)
 * See docs/guides/BUILDING-COMPONENTS.md for full instructions
 * 
 * Auto-initializes all UI components with EventBus integration
 * Minimal JavaScript - only for essential interactions
 */

import { EventBus } from '../runtime/EventBus.js';
import { initPopovers } from './components/popover/popover.js';
import { initToastSystem } from './components/toast/toast.js';
import { initDialogSystem } from './components/dialog/dialog.js';
import { initDropdownSystem } from './components/dropdown/dropdown.js';
import { initTabsSystem } from './components/tabs/tabs.js';
import { initInputSystem } from './components/input/input.js';
import { initTextareaSystem } from './components/textarea/textarea.js';
import { initCheckboxSystem } from './components/checkbox/checkbox.js';
import { initRadioSystem } from './components/radio/radio.js';
import { initSwitchSystem } from './components/switch/switch.js';
import { initAccordionSystem } from './components/accordion/accordion.js';
import { initProgressSystem } from './components/progress/progress.js';
import { initSliderUI } from './components/slider/slider.js';
import { createSliderService } from '../services/SliderService.js';
import { initNavbarSystem } from './components/navbar/navbar.js';
import { initFileUpload } from './components/file-upload/file-upload.js';
import { initDatepickerUI } from './components/datepicker/datepicker.js';
import { initAnalyticsConsentControls } from './components/analytics-consent/analytics-consent.js';

/**
 * Initialize all UI components
 * @param {EventBus} eventBus - The CSMA EventBus instance
 */
export function initUI(eventBus) {
    console.log('[CSMA UI] Initializing UI components...');

    // Initialize buttons with data-action attribute
    initButtons(eventBus);

    // Initialize theme toggle
    initThemeToggle(eventBus);

    // Initialize Toast system
    const toastCleanup = initToastSystem(eventBus);

    // Initialize Dialog system
    const dialogCleanup = initDialogSystem(eventBus);

    // Initialize Popover system
    // Popovers, Tooltips and Dropdowns share similar floating UI logic
    const popoverCleanup = initPopovers(eventBus);

    // Initialize Dropdown system
    const dropdownCleanup = initDropdownSystem(eventBus);

    // Initialize Tabs system
    const tabsCleanup = initTabsSystem(eventBus);

    // Initialize form components
    const inputCleanup = initInputSystem(eventBus);
    const textareaCleanup = initTextareaSystem(eventBus);
    const checkboxCleanup = initCheckboxSystem(eventBus);
    const radioCleanup = initRadioSystem(eventBus);
    const switchCleanup = initSwitchSystem(eventBus);

    // Initialize Accordion system
    const accordionCleanup = initAccordionSystem(eventBus);

    // Initialize Progress system
    const progressCleanup = initProgressSystem(eventBus);

    // Initialize Slider system
    // Component Service: Logic for Slider UI
    const sliderService = createSliderService(eventBus);
    if (window.serviceManager) window.serviceManager.register('slider', sliderService);

    const sliderCleanup = initSliderUI(eventBus);

    // Initialize Navbar system
    const navbarCleanup = initNavbarSystem(eventBus);

    // Initialize File Upload system
    const fileUploadCleanup = initFileUploadSystem();

    // Initialize Datepicker system
    const datepickerCleanup = initDatepickerUI(eventBus);
    const consentCleanup = initAnalyticsConsentControls();

    // Store cleanup functions for hot reload
    window.csma = window.csma || {};
    window.csma.componentCleanup = () => {
        toastCleanup();
        dialogCleanup();
        popoverCleanup();
        dropdownCleanup();
        tabsCleanup();
        inputCleanup();
        textareaCleanup();
        checkboxCleanup();
        radioCleanup();
        switchCleanup();
        accordionCleanup();
        progressCleanup();
        sliderCleanup();
        navbarCleanup();
        fileUploadCleanup();
        datepickerCleanup();
        consentCleanup();
    };

    console.log('[CSMA UI] All components initialized ✓');

    // Return services for external access
    return {};
}

/**
 * Initialize all buttons with EventBus integration
 * Buttons with data-action attribute will publish INTENT_BUTTON_CLICKED
 */
function initButtons(eventBus) {
    const buttons = document.querySelectorAll('button[data-action], .button[data-action]');

    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            const action = button.dataset.action;
            const buttonId = button.id || button.dataset.id || 'anonymous';

            // Publish button click intent
            eventBus.publish('INTENT_BUTTON_CLICKED', {
                action,
                buttonId,
                timestamp: Date.now()
            });
        });
    });

    console.log(`[CSMA UI] Initialized ${buttons.length} buttons`);
}

/**
 * Initialize theme toggle functionality
 * Uses data-theme attribute on <html> element
 */
function initThemeToggle(eventBus) {
    const toggleButtons = document.querySelectorAll('[data-theme-toggle]');

    // Load saved theme or detect system preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = savedTheme || systemTheme;

    // Apply theme
    document.documentElement.dataset.theme = currentTheme;

    // Setup toggle buttons
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const html = document.documentElement;
            const currentTheme = html.dataset.theme || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            // Update theme
            html.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);

            // Publish theme change event
            eventBus.publish('THEME_CHANGED', {
                theme: newTheme,
                timestamp: Date.now()
            });
        });
    });

    console.log(`[CSMA UI] Theme: ${currentTheme}, Toggle buttons: ${toggleButtons.length}`);
}

/**
 * Helper: Set button loading state
 * @param {HTMLElement} button - Button element
 * @param {boolean} loading - Loading state
 */
export function setButtonLoading(button, loading) {
    if (loading) {
        button.dataset.loading = 'true';
        button.disabled = true;
    } else {
        delete button.dataset.loading;
        button.disabled = false;
    }
}

/**
 * Helper: Set element state via data-state attribute (C-DAD pattern)
 * @param {HTMLElement} element - Element to update
 * @param {string} state - State name (loading, error, success, etc.)
 */
export function setState(element, state) {
    if (state) {
        element.dataset.state = state;
    } else {
        delete element.dataset.state;
    }
}

function initFileUploadSystem() {
    const roots = document.querySelectorAll('[data-component="file-upload"]');
    if (!roots.length) {
        return () => {};
    }

    const cleanups = Array.from(roots).map((root) => initFileUpload(root));
    return () => {
        cleanups.forEach((cleanup) => cleanup?.());
    };
}
