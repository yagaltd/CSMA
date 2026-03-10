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
import { initTooltipSystem } from './components/tooltip/tooltip.js';
import { initAlertDialogSystem } from './components/alert-dialog/alert-dialog.js';
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
import { initCollapsibleSystem } from './components/collapsible/collapsible.js';
import { initHoverCardSystem } from './components/hover-card/hover-card.js';
import { initDrawerSystem } from './components/drawer/drawer.js';
import { initContextMenuSystem } from './components/context-menu/context-menu.js';
import { initMultiSelectSystem } from './components/multi-select/multi-select.js';
import { initCalendarSystem } from './components/calendar/calendar.js';
import { initCommandUI } from './components/command/command.js';
import { initCarouselSystem } from './components/carousel/carousel.js';
import { createCommandService } from '../services/CommandService.js';
import { initTableUI } from './components/table/table.js';
import { createTableService } from '../services/TableService.js';
import { initToggleGroupSystem } from './components/toggle-group/toggle-group.js';
import { initComboboxSystem } from './components/combobox/combobox.js';
import { initMenubarSystem } from './components/menubar/menubar.js';
import { initNavigationMenuSystem } from './components/navigation-menu/navigation-menu.js';
import { initResizableSystem } from './components/resizable/resizable.js';
import { initDateRangePickerSystem } from './components/date-range-picker/date-range-picker.js';
import { initSliderRangeSystem } from './components/slider-range/slider-range.js';
import { initOTPUI } from './components/otp/otp.js';
import { initNumberFieldUI } from './components/number-field/number-field.js';
import { initPinInputUI } from './components/pin-input/pin-input.js';
import { initFormUI } from './components/form/form.js';
import { initSelectUI } from './components/select/select.js';
import { initPaginationSystem } from './components/pagination/pagination.js';

/**
 * Initialize all UI components
 * @param {EventBus} eventBus - The CSMA EventBus instance
 */
export function initUI(eventBus) {
    const runtime = window.csma = window.csma || {};
    const lifecycle = runtime.uiLifecycle = runtime.uiLifecycle || {
        bootCount: 0,
        cleanupCount: 0,
        isActive: false
    };
    const previousCleanup = runtime.activeUICleanup;
    if (typeof previousCleanup === 'function') {
        previousCleanup();
    }

    const initStartedAt = performance.now();
    console.log('[CSMA UI] Initializing UI components...');
    const cleanups = [];
    const addCleanup = (cleanup) => {
        if (typeof cleanup === 'function') {
            cleanups.push(cleanup);
        }
        return cleanup;
    };
    const getOrCreateService = (name, factory) => {
        if (window.serviceManager) {
            const existing = window.serviceManager.get(name);
            if (existing) {
                return { service: existing, ownedByInit: false };
            }

            const service = factory();
            window.serviceManager.register(name, service);
            return { service, ownedByInit: false };
        }

        return { service: factory(), ownedByInit: true };
    };

    // Initialize buttons with data-action attribute
    addCleanup(initButtons(eventBus));

    // Initialize theme toggle
    addCleanup(initThemeToggle(eventBus));

    // Initialize Toast system
    addCleanup(initToastSystem(eventBus));

    // Initialize Dialog system
    addCleanup(initDialogSystem(eventBus));
    addCleanup(initAlertDialogSystem(eventBus));

    // Initialize Popover system
    // Popovers, Tooltips and Dropdowns share similar floating UI logic
    addCleanup(initPopovers(eventBus));

    // Initialize Dropdown system
    addCleanup(initDropdownSystem(eventBus));

    // Initialize Tooltip system
    addCleanup(initTooltipSystem(eventBus));

    // Initialize Tabs system
    addCleanup(initTabsSystem(eventBus));

    // Initialize form components
    addCleanup(initInputSystem(eventBus));
    addCleanup(initTextareaSystem(eventBus));
    addCleanup(initCheckboxSystem(eventBus));
    addCleanup(initRadioSystem(eventBus));
    addCleanup(initSwitchSystem(eventBus));

    // Initialize Accordion system
    addCleanup(initAccordionSystem(eventBus));

    // Initialize Progress system
    addCleanup(initProgressSystem(eventBus));

    // Initialize Slider system
    // Component Service: Logic for Slider UI
    const { service: sliderService, ownedByInit: ownsSliderService } = getOrCreateService('slider', () => createSliderService(eventBus));
    if (ownsSliderService && typeof sliderService?.cleanup === 'function') {
        addCleanup(() => sliderService.cleanup());
    }
    addCleanup(initSliderUI(eventBus));

    // Initialize Navbar system
    addCleanup(initNavbarSystem(eventBus));

    // Initialize File Upload system
    addCleanup(initFileUploadSystem());

    // Initialize Datepicker system
    addCleanup(initDatepickerUI(eventBus));
    addCleanup(initAnalyticsConsentControls());

    // Initialize Collapsible system
    addCleanup(initCollapsibleSystem(eventBus));

    // Initialize Hover Card system
    addCleanup(initHoverCardSystem(eventBus));

    // Initialize Drawer system
    addCleanup(initDrawerSystem(eventBus));

    // Initialize Context Menu system
    addCleanup(initContextMenuSystem(eventBus));

    // Initialize Multi-Select system
    addCleanup(initMultiSelectSystem(eventBus));

    // Initialize Calendar system
    addCleanup(initCalendarSystem(eventBus));
    addCleanup(initCarouselSystem(eventBus));
    addCleanup(initPaginationSystem(eventBus));

    // Initialize Command system (Type III - Service-backed)
    const { service: commandService, ownedByInit: ownsCommandService } = getOrCreateService('command', () => createCommandService(eventBus));
    if (ownsCommandService && typeof commandService?.cleanup === 'function') {
        addCleanup(() => commandService.cleanup());
    }
    addCleanup(initCommandUI(eventBus));

    // Initialize Table system (Type III - Service-backed)
    const { service: tableService, ownedByInit: ownsTableService } = getOrCreateService('table', () => createTableService(eventBus));
    if (ownsTableService && typeof tableService?.cleanup === 'function') {
        addCleanup(() => tableService.cleanup());
    }
    addCleanup(initTableUI(eventBus));

    // Initialize Toggle Group system
    addCleanup(initToggleGroupSystem(eventBus));

    // Initialize Combobox system
    addCleanup(initComboboxSystem(eventBus));

    // Initialize Menubar system
    addCleanup(initMenubarSystem(eventBus));

    // Initialize Navigation Menu system
    addCleanup(initNavigationMenuSystem(eventBus));

    // Initialize Resizable system
    addCleanup(initResizableSystem(eventBus));

    // Initialize Date Range Picker system
    addCleanup(initDateRangePickerSystem(eventBus));

    // Initialize Slider Range system
    addCleanup(initSliderRangeSystem(eventBus));

    // Initialize OTP component
    addCleanup(initOTPUI(eventBus));

    // Initialize Number Field component
    addCleanup(initNumberFieldUI(eventBus));

    // Initialize Pin Input component
    addCleanup(initPinInputUI(eventBus));

    // Initialize Form validation
    addCleanup(initFormUI(eventBus));

    // Initialize Select enhancement
    addCleanup(initSelectUI(eventBus));

    const cleanup = () => {
        if (cleanup.called) return;
        cleanup.called = true;
        const cleanupStartedAt = performance.now();
        cleanups.splice(0).reverse().forEach((fn) => {
            try {
                fn();
            } catch (error) {
                console.error('[CSMA UI] Cleanup failed:', error);
            }
        });

        lifecycle.cleanupCount += 1;
        lifecycle.lastCleanupDurationMs = Number((performance.now() - cleanupStartedAt).toFixed(2));
        lifecycle.isActive = false;
        lifecycle.lastCleanupAt = Date.now();

        if (runtime.activeUICleanup === cleanup) {
            runtime.activeUICleanup = null;
        }
    };
    cleanup.called = false;

    lifecycle.bootCount += 1;
    lifecycle.lastInitDurationMs = Number((performance.now() - initStartedAt).toFixed(2));
    lifecycle.lastInitAt = Date.now();
    lifecycle.isActive = true;
    runtime.activeUICleanup = cleanup;
    runtime.componentCleanup = cleanup;

    console.log('[CSMA UI] All components initialized ✓');

    return cleanup;
}

/**
 * Initialize all buttons with EventBus integration
 * Buttons with data-action attribute will publish INTENT_BUTTON_CLICKED
 */
function initButtons(eventBus) {
    const buttons = document.querySelectorAll('button[data-action], .button[data-action]');
    const cleanups = [];

    buttons.forEach(button => {
        const handleClick = () => {
            const action = button.dataset.action;
            const buttonId = button.id || button.dataset.id || 'anonymous';

            // Publish button click intent
            eventBus.publish('INTENT_BUTTON_CLICKED', {
                action,
                buttonId,
                timestamp: Date.now()
            });
        };

        button.addEventListener('click', handleClick);
        cleanups.push(() => button.removeEventListener('click', handleClick));
    });

    console.log(`[CSMA UI] Initialized ${buttons.length} buttons`);
    return () => {
        cleanups.forEach((cleanup) => cleanup());
    };
}

/**
 * Initialize theme toggle functionality
 * Uses data-theme attribute on <html> element
 */
function initThemeToggle(eventBus) {
    const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
    const cleanups = [];

    // Load saved theme or detect system preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = savedTheme || systemTheme;

    // Apply theme
    document.documentElement.dataset.theme = currentTheme;

    // Setup toggle buttons
    toggleButtons.forEach(button => {
        const handleClick = () => {
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
        };

        button.addEventListener('click', handleClick);
        cleanups.push(() => button.removeEventListener('click', handleClick));
    });

    console.log(`[CSMA UI] Theme: ${currentTheme}, Toggle buttons: ${toggleButtons.length}`);
    return () => {
        cleanups.forEach((cleanup) => cleanup());
    };
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
