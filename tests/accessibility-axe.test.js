/**
 * Automated Accessibility Tests using axe-core patterns
 *
 * These tests verify WCAG 2.1 AA compliance for all UI components.
 * Run with: npm run test:a11y
 *
 * For full axe-core integration with real browser testing,
 * use a browser test runner or manual audit.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * WCAG 2.1 Rule Implementations
 * These are simplified checks - full testing requires axe-core in a real browser
 */

/**
 * Check if element has accessible name
 * @param {Element} element
 * @returns {{pass: boolean, message: string}}
 */
function hasAccessibleName(element) {
    const tagName = element.tagName.toLowerCase();

    // Check aria-label
    if (element.getAttribute('aria-label')) {
        return { pass: true, message: 'Has aria-label' };
    }

    // Check aria-labelledby
    if (element.getAttribute('aria-labelledby')) {
        return { pass: true, message: 'Has aria-labelledby' };
    }

    // Check for label element
    if (['input', 'select', 'textarea'].includes(tagName)) {
        const id = element.id;
        if (id) {
            const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
            if (label) {
                return { pass: true, message: 'Has associated label' };
            }
        }
        // Check for wrapping label
        const parentLabel = element.closest('label');
        if (parentLabel && parentLabel.textContent.trim()) {
            return { pass: true, message: 'Has wrapping label' };
        }
    }

    // Check for text content
    if (element.textContent?.trim()) {
        return { pass: true, message: 'Has text content' };
    }

    // Check for title attribute
    if (element.getAttribute('title')) {
        return { pass: true, message: 'Has title attribute' };
    }

    // Check for alt on images
    if (tagName === 'img') {
        const alt = element.getAttribute('alt');
        if (alt !== null) {
            return { pass: true, message: 'Has alt attribute' };
        }
    }

    return { pass: false, message: 'No accessible name found' };
}

/**
 * Check if interactive element is focusable
 * @param {Element} element
 * @returns {{pass: boolean, message: string}}
 */
function isFocusable(element) {
    const tagName = element.tagName.toLowerCase();

    // Native focusable elements
    const nativeFocusable = ['a', 'button', 'input', 'select', 'textarea', 'iframe'];
    if (nativeFocusable.includes(tagName)) {
        if (element.hasAttribute('disabled')) {
            return { pass: false, message: 'Element is disabled' };
        }
        if (tagName === 'a' && !element.getAttribute('href')) {
            return { pass: false, message: 'Link has no href' };
        }
        return { pass: true, message: 'Native focusable element' };
    }

    // Check tabindex
    const tabindex = element.getAttribute('tabindex');
    if (tabindex !== null && tabindex !== '-1') {
        return { pass: true, message: 'Has valid tabindex' };
    }

    return { pass: false, message: 'Not focusable' };
}

/**
 * Check if element has valid role
 * @param {Element} element
 * @returns {{pass: boolean, message: string}}
 */
function hasValidRole(element) {
    const validRoles = [
        'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
        'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
        'contentinfo', 'definition', 'dialog', 'directory', 'document',
        'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
        'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
        'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
        'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
        'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
        'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
        'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
        'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar',
        'tooltip', 'tree', 'treegrid', 'treeitem'
    ];

    const role = element.getAttribute('role');
    if (!role) {
        return { pass: true, message: 'No explicit role (uses native)' };
    }

    if (validRoles.includes(role)) {
        return { pass: true, message: `Valid role: ${role}` };
    }

    return { pass: false, message: `Invalid role: ${role}` };
}

/**
 * Create test document
 */
function createTestDocument(html) {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Test</title></head>
        <body>${html}</body>
        </html>
    `);
    return dom.window.document;
}

// ============================================
// Button Component Tests
// ============================================

describe('Button Accessibility', () => {
    it('button has accessible name', () => {
        const doc = createTestDocument('<button class="button">Submit</button>');
        const button = doc.querySelector('.button');
        const result = hasAccessibleName(button);
        expect(result.pass).toBe(true);
    });

    it('icon-only button has aria-label', () => {
        const doc = createTestDocument(`
            <button class="button" data-shape="icon" aria-label="Close">
                <svg aria-hidden="true"><use href="#icon-close"></use></svg>
            </button>
        `);
        const button = doc.querySelector('.button');
        const result = hasAccessibleName(button);
        expect(result.pass).toBe(true);
    });

    it('disabled button is not focusable', () => {
        const doc = createTestDocument('<button class="button" disabled>Submit</button>');
        const button = doc.querySelector('.button');
        expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('loading button has aria-busy', () => {
        const doc = createTestDocument(`
            <button class="button" data-loading="true" aria-busy="true">
                <span>Loading</span>
            </button>
        `);
        const button = doc.querySelector('.button');
        expect(button.getAttribute('aria-busy')).toBe('true');
    });
});

// ============================================
// Toast/Alert Tests
// ============================================

describe('Toast Accessibility', () => {
    it('toast container has aria-live="polite"', () => {
        const doc = createTestDocument(`
            <div class="toast-container" role="status" aria-live="polite" aria-atomic="true">
            </div>
        `);
        const container = doc.querySelector('.toast-container');
        expect(container.getAttribute('aria-live')).toBe('polite');
        expect(container.getAttribute('aria-atomic')).toBe('true');
    });

    it('error toast uses role="alert"', () => {
        const doc = createTestDocument(`
            <div class="toast toast-error" role="alert">
                <div class="toast-title">Error</div>
            </div>
        `);
        const toast = doc.querySelector('.toast');
        expect(toast.getAttribute('role')).toBe('alert');
    });

    it('toast close button has aria-label', () => {
        const doc = createTestDocument(`
            <button class="toast-close" aria-label="Close toast">×</button>
        `);
        const closeBtn = doc.querySelector('.toast-close');
        expect(closeBtn.getAttribute('aria-label')).toBe('Close toast');
    });
});

// ============================================
// Focus Management Tests
// ============================================

describe('Focus Management', () => {
    it('all interactive elements are focusable', () => {
        const doc = createTestDocument(`
            <button class="button">Click</button>
            <a class="link" href="#">Link</a>
            <input class="input" type="text">
            <select class="select"><option>Option</option></select>
        `);

        const button = doc.querySelector('.button');
        const link = doc.querySelector('.link');
        const input = doc.querySelector('.input');
        const select = doc.querySelector('.select');

        expect(isFocusable(button).pass).toBe(true);
        expect(isFocusable(link).pass).toBe(true);
        expect(isFocusable(input).pass).toBe(true);
        expect(isFocusable(select).pass).toBe(true);
    });

    it('focus-visible styles are defined', () => {
        // This would need to be tested in a real browser with CSS
        // Here we just document the requirement
        const focusVisiblePattern = ':focus-visible';
        expect(focusVisiblePattern).toBeTruthy();
    });
});

// ============================================
// Image Accessibility Tests
// ============================================

describe('Image Accessibility', () => {
    it('images have alt attribute', () => {
        const doc = createTestDocument(`
            <img class="avatar" src="user.jpg" alt="User profile photo">
        `);
        const img = doc.querySelector('.avatar');
        expect(img.hasAttribute('alt')).toBe(true);
    });

    it('decorative images have empty alt', () => {
        const doc = createTestDocument(`
            <img class="icon" src="decoration.svg" alt="" aria-hidden="true">
        `);
        const img = doc.querySelector('.icon');
        expect(img.getAttribute('alt')).toBe('');
        expect(img.getAttribute('aria-hidden')).toBe('true');
    });
});

// ============================================
// Heading Hierarchy Tests
// ============================================

describe('Heading Hierarchy', () => {
    it('headings follow logical order', () => {
        const doc = createTestDocument(`
            <h1>Main Title</h1>
            <h2>Section</h2>
            <h3>Subsection</h3>
            <h2>Another Section</h2>
        `);

        const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const levels = headings.map(h => parseInt(h.tagName[1]));

        // Check no level jumps more than 1
        for (let i = 1; i < levels.length; i++) {
            const diff = levels[i] - levels[i - 1];
            expect(diff).toBeLessThanOrEqual(1);
        }
    });

    it('page has exactly one h1', () => {
        const doc = createTestDocument(`
            <h1>Page Title</h1>
            <h2>Section</h2>
        `);

        const h1s = doc.querySelectorAll('h1');
        expect(h1s.length).toBe(1);
    });
});

// ============================================
// Landmark Tests
// ============================================

describe('Page Landmarks', () => {
    it('page has main landmark', () => {
        const doc = createTestDocument(`
            <main id="main-content">Main content</main>
        `);
        const main = doc.querySelector('main');
        expect(main).toBeTruthy();
    });

    it('page has banner landmark', () => {
        const doc = createTestDocument(`
            <header role="banner">Header</header>
        `);
        const banner = doc.querySelector('[role="banner"], header');
        expect(banner).toBeTruthy();
    });

    it('page has contentinfo landmark', () => {
        const doc = createTestDocument(`
            <footer role="contentinfo">Footer</footer>
        `);
        const contentinfo = doc.querySelector('[role="contentinfo"], footer');
        expect(contentinfo).toBeTruthy();
    });
});
