/**
 * Selection Overlay — visual feedback for caret, text selection, and node selection.
 *
 * Renders a blinking caret for collapsed text selections and highlight
 * rectangles for expanded text selections. Uses CSS custom properties
 * for theming.
 */

import { clearChildren } from '../../../utils/dom.js';

/**
 * Initialize the selection overlay.
 *
 * @param {import('../services/EditorSessionService.js').EditorSessionService} session
 * @param {object} eventBus
 * @param {string} editorId
 * @returns {Function} cleanup function
 */
export function initSelectionOverlay(session, eventBus, editorId) {
    const overlay = document.createElement('div');
    overlay.className = 've-selection-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    let caret_blink_timer = null;

    function showCaret(x, y, height) {
        clearChildren(overlay);
        overlay.style.display = 'block';

        const caret = document.createElement('div');
        caret.className = 've-caret';
        caret.style.position = 'fixed';
        caret.style.left = `${x}px`;
        caret.style.top = `${y}px`;
        caret.style.height = `${height}px`;
        caret.style.width = '2px';

        overlay.appendChild(caret);

        clearTimeout(caret_blink_timer);
        caret_blink_timer = setTimeout(() => {
            overlay.style.display = 'none';
        }, 5000);
    }

    function showTextSelection(rects) {
        clearChildren(overlay);
        overlay.style.display = 'block';

        for (const rect of rects) {
            if (rect.width === 0 && rect.height === 0) continue;

            const highlight = document.createElement('div');
            highlight.className = 've-text-selection';
            highlight.style.position = 'fixed';
            highlight.style.left = `${rect.left}px`;
            highlight.style.top = `${rect.top}px`;
            highlight.style.width = `${rect.width}px`;
            highlight.style.height = `${rect.height}px`;
            highlight.style.pointerEvents = 'none';

            overlay.appendChild(highlight);
        }
    }

    function hideOverlay() {
        overlay.style.display = 'none';
        clearChildren(overlay);
    }

    function updateOverlay() {
        const sel = session.selection;
        if (!sel) {
            hideOverlay();
            return;
        }

        try {
            const dom_sel = window.getSelection();

            if (sel.type === 'text') {
                if (dom_sel && dom_sel.rangeCount > 0 && !dom_sel.isCollapsed) {
                    const range = dom_sel.getRangeAt(0);
                    const rects = Array.from(range.getClientRects());
                    showTextSelection(rects);
                } else if (dom_sel && dom_sel.rangeCount > 0) {
                    const range = dom_sel.getRangeAt(0);
                    const rect = range.getClientRects()[0];
                    if (rect) {
                        showCaret(rect.left, rect.top, rect.height);
                    }
                } else {
                    hideOverlay();
                }
            } else if (sel.type === 'node') {
                hideOverlay();
            } else {
                hideOverlay();
            }
        } catch {
            hideOverlay();
        }
    }

    const unsubscribe = eventBus.subscribe('EDITOR_SELECTION_CHANGED', (payload) => {
        if (payload.editorId === editorId) {
            requestAnimationFrame(updateOverlay);
        }
    });

    requestAnimationFrame(updateOverlay);

    return () => {
        if (unsubscribe) try { unsubscribe(); } catch { /* ignore */ }
        clearTimeout(caret_blink_timer);
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    };
}
