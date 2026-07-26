/**
 * Overlay Manager Archetype — CSMA Token-Driven Modal/Drawer/Popover/Lightbox
 *
 * Factory: createOverlayManager(container) → { openModal, openDrawer, openPopover, openLightbox, closeAll, destroy }
 *
 * Phase 3.0 — aiui-native (Option a: factory-wrapping). All DOM construction
 * routes through `getComposer().mountTree(spec, target)`; no raw
 * `document.createElement` in archetype internals. The shells (modal/drawer/
 * lightbox/backdrop) are spec-mounted; the per-overlay imperative content,
 * inline positioning styles, and event wiring are applied on the mounted DOM
 * (see the Layer 2 archetype pattern in docs/architecture/SKILL.md).
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

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { appendTextOrNode } from '../../../utils/dom.js';

const CLOSE_ICON = '×';

export function createOverlayManager(container, emit, options = {}) {
    const composer = getComposer();
    const stack = [];
    let backdropEl = null;

    // ─── Backdrop ──────────────────────────────────────

    function ensureBackdrop() {
        if (backdropEl) return;
        const { root } = composer.mountTree(
            spec('div', { className: 'csma-overlay-backdrop' })
        );
        backdropEl = root;
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

    // ─── Shared shell builder ──────────────────────────

    function overlayHeaderSpec(title, closable) {
        if (!title && !closable) return null;
        const children = [spec('span', { text: title })];
        if (closable) {
            children.push(spec('button', {
                className: 'csma-overlay-close',
                attrs: { 'aria-label': 'Close' },
                text: CLOSE_ICON
            }));
        }
        return spec('div', { className: 'csma-overlay-header', children });
    }

    // ─── Stack Management ─────────────────────────────

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

        const children = [
            overlayHeaderSpec(title, closable),
            spec('div', { className: 'csma-overlay-body' }),
            footer ? spec('div', { className: 'csma-overlay-footer' }) : null
        ];
        const { root: el } = composer.mountTree(spec('div', {
            className: 'csma-overlay-modal',
            attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
            children
        }));

        // Post-mount: content, footer, width, close button
        appendTextOrNode(el.querySelector('.csma-overlay-body'), content);
        if (footer) {
            appendTextOrNode(el.querySelector('.csma-overlay-footer'), footer);
        }
        if (width) el.style.maxWidth = typeof width === 'number' ? width + 'px' : width;
        const closeBtn = el.querySelector('.csma-overlay-close');
        if (closeBtn) closeBtn.addEventListener('click', closeTop);

        ensureBackdrop();
        backdropEl.appendChild(el);
        pushOverlay({ type: 'modal', el, closable, onClose });

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

        const children = [
            overlayHeaderSpec(title, closable),
            spec('div', { className: 'csma-overlay-body' })
        ];
        const { root: el } = composer.mountTree(spec('div', {
            className: 'csma-overlay-drawer',
            attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Drawer' },
            children
        }));

        appendTextOrNode(el.querySelector('.csma-overlay-body'), content);
        if (side === 'left') el.style.left = '0';
        const closeBtn = el.querySelector('.csma-overlay-close');
        if (closeBtn) closeBtn.addEventListener('click', closeTop);

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

        const { root: el } = composer.mountTree(
            spec('div', { className: 'csma-overlay-popover', attrs: { role: 'dialog' } })
        );

        // Post-mount: content + positioning (popover placement is runtime-computed)
        appendTextOrNode(el, content);
        document.body.appendChild(el);

        const anchorRect = anchor.getBoundingClientRect();
        const popoverRect = el.getBoundingClientRect();

        let top = anchorRect.bottom + 4;
        let left = anchorRect.left;

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

        const { root: el } = composer.mountTree(spec('div', {
            className: 'csma-overlay-lightbox',
            attrs: { role: 'dialog', 'aria-label': alt || 'Image preview' },
            children: [
                spec('img', { attrs: { src, alt } }),
                spec('button', {
                    className: 'csma-overlay-close',
                    attrs: { 'aria-label': 'Close' },
                    text: CLOSE_ICON
                })
            ]
        }));

        el.querySelector('.csma-overlay-close').addEventListener('click', closeTop);
        el.addEventListener('click', (e) => {
            if (e.target === el) closeTop();
        });

        document.body.appendChild(el);
        pushOverlay({ type: 'lightbox', el, closable: true, onClose });

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
