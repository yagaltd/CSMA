/**
 * Overlay Manager Archetype — CSMA Token-Driven Modal/Drawer/Popover/Lightbox
 *
 * Factory: createOverlayManager(container) → { openModal, openDrawer, openPopover, openLightbox, closeAll, destroy }
 *
 * Features:
 * - Modal dialog with header, body, footer slots
 * - Drawer panel sliding from the right
 * - Popover positioned relative to an anchor element
 * - Lightbox for full-screen image/media viewing
 * - Backdrop click to dismiss (configurable)
 * - Escape key to dismiss
 * - Focus trap within modal/drawer
 * - Stacking: opening a new overlay over previous
 * - CSMA design tokens for all visual values
 */

import { appendTextOrNode } from '../../../utils/dom.js';

const CLOSE_ICON = '×';

export function createOverlayManager(container, emit, options = {}) {
    const stack = [];
    let backdropEl = null;

    // ─── Backdrop ──────────────────────────────────────

    function ensureBackdrop() {
        if (backdropEl) return;
        backdropEl = document.createElement('div');
        backdropEl.className = 'csma-overlay-backdrop';
        backdropEl.addEventListener('click', (e) => {
            if (e.target === backdropEl) closeTop();
        });
        document.body.appendChild(backdropEl);
    }

    function removeBackdrop() {
        if (!backdropEl) return;
        backdropEl.remove();
        backdropEl = null;
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top.closable !== false) closeTop();
        }
        if (e.key === 'Tab' && stack.length > 0) {
            trapFocus(e);
        }
    }

    // ─── Focus Trap ────────────────────────────────────

    function trapFocus(e) {
        const top = stack[stack.length - 1];
        if (!top.el) return;
        const focusable = top.el.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // ─── Stack Management ──────────────────────────────

    function pushOverlay(config) {
        ensureBackdrop();
        stack.push(config);
        document.addEventListener('keydown', onKeyDown);
        if (emit) emit('overlay:opened', { type: config.type, id: config.id });
    }

    function closeTop() {
        const top = stack.pop();
        if (!top) return;
        if (top.onClose) top.onClose();
        if (top.el) top.el.remove();
        if (emit) emit('overlay:closed', { type: top.type, id: top.id });

        if (stack.length === 0) {
            document.removeEventListener('keydown', onKeyDown);
            removeBackdrop();
        }
    }

    // ─── Modal ─────────────────────────────────────────

    function openModal(content, opts = {}) {
        const {
            title = '',
            footer = null,
            closable = true,
            onClose = null,
            width = null,
        } = opts;

        const el = document.createElement('div');
        el.className = 'csma-overlay-modal';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', title || 'Dialog');
        if (width) el.style.maxWidth = typeof width === 'number' ? width + 'px' : width;

        // Header
        if (title || closable) {
            const header = document.createElement('div');
            header.className = 'csma-overlay-header';

            const titleEl = document.createElement('span');
            titleEl.textContent = title;
            header.appendChild(titleEl);

            if (closable) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'csma-overlay-close';
                closeBtn.setAttribute('aria-label', 'Close');
                closeBtn.textContent = CLOSE_ICON;
                closeBtn.addEventListener('click', closeTop);
                header.appendChild(closeBtn);
            }

            el.appendChild(header);
        }

        // Body
        const body = document.createElement('div');
        body.className = 'csma-overlay-body';
        appendTextOrNode(body, content);
        el.appendChild(body);

        // Footer
        if (footer) {
            const footerEl = document.createElement('div');
            footerEl.className = 'csma-overlay-footer';
            appendTextOrNode(footerEl, footer);
            el.appendChild(footerEl);
        }

        ensureBackdrop();
        backdropEl.appendChild(el);
        pushOverlay({ type: 'modal', el, closable, onClose });

        // Focus first focusable element
        requestAnimationFrame(() => {
            const first = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (first) first.focus();
        });

        return { close: closeTop, el };
    }

    // ─── Drawer ────────────────────────────────────────

    function openDrawer(content, opts = {}) {
        const {
            title = '',
            closable = true,
            onClose = null,
            side = 'right',
        } = opts;

        const el = document.createElement('div');
        el.className = 'csma-overlay-drawer';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', title || 'Drawer');
        if (side === 'left') el.style.left = '0';

        if (title || closable) {
            const header = document.createElement('div');
            header.className = 'csma-overlay-header';

            const titleEl = document.createElement('span');
            titleEl.textContent = title;
            header.appendChild(titleEl);

            if (closable) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'csma-overlay-close';
                closeBtn.setAttribute('aria-label', 'Close');
                closeBtn.textContent = CLOSE_ICON;
                closeBtn.addEventListener('click', closeTop);
                header.appendChild(closeBtn);
            }

            el.appendChild(header);
        }

        const body = document.createElement('div');
        body.className = 'csma-overlay-body';
        appendTextOrNode(body, content);
        el.appendChild(body);

        ensureBackdrop();
        backdropEl.appendChild(el);
        pushOverlay({ type: 'drawer', el, closable, onClose });

        requestAnimationFrame(() => {
            const first = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (first) first.focus();
        });

        return { close: closeTop, el };
    }

    // ─── Popover ───────────────────────────────────────

    function openPopover(content, anchor, opts = {}) {
        const {
            closable = true,
            onClose = null,
        } = opts;

        // Close any existing popover
        const existing = stack.find((s) => s.type === 'popover');
        if (existing) {
            const idx = stack.indexOf(existing);
            stack.splice(idx, 1);
            if (existing.el) existing.el.remove();
        }

        const el = document.createElement('div');
        el.className = 'csma-overlay-popover';
        el.setAttribute('role', 'dialog');

        appendTextOrNode(el, content);

        // Position relative to anchor
        document.body.appendChild(el);
        const anchorRect = anchor.getBoundingClientRect();
        const popoverRect = el.getBoundingClientRect();

        let top = anchorRect.bottom + 4;
        let left = anchorRect.left;

        // Flip if overflows viewport
        if (top + popoverRect.height > window.innerHeight) {
            top = anchorRect.top - popoverRect.height - 4;
        }
        if (left + popoverRect.width > window.innerWidth) {
            left = window.innerWidth - popoverRect.width - 8;
        }
        if (left < 8) left = 8;

        el.style.position = 'fixed';
        el.style.top = top + 'px';
        el.style.left = left + 'px';

        // Click outside to close
        const outsideHandler = (e) => {
            if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
                closeTop();
                document.removeEventListener('click', outsideHandler, true);
            }
        };
        setTimeout(() => document.addEventListener('click', outsideHandler, true), 0);

        pushOverlay({ type: 'popover', el, closable, onClose });

        return { close: closeTop, el };
    }

    // ─── Lightbox ──────────────────────────────────────

    function openLightbox(src, opts = {}) {
        const { alt = '', onClose = null } = opts;

        const el = document.createElement('div');
        el.className = 'csma-overlay-lightbox';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', alt || 'Image preview');

        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        el.appendChild(img);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'csma-overlay-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = CLOSE_ICON;
        closeBtn.addEventListener('click', closeTop);
        el.appendChild(closeBtn);

        document.body.appendChild(el);
        pushOverlay({ type: 'lightbox', el, closable: true, onClose });

        el.addEventListener('click', (e) => {
            if (e.target === el) closeTop();
        });

        return { close: closeTop, el };
    }

    // ─── Public API ────────────────────────────────────

    return {
        openModal,
        openDrawer,
        openPopover,
        openLightbox,
        closeAll() {
            while (stack.length > 0) closeTop();
        },
        destroy() {
            this.closeAll();
        },
    };
}
