/**
 * InlineTextEditor — double-click or F2 to edit text directly in place.
 *
 * Activates contentEditable on the target element, shows a floating
 * Save/Cancel toolbar, and publishes INTENT_ELEMENT_EDITED on save.
 *
 * Reuses the element-targeting pattern from CommentsPicker and the
 * contentEditable pattern from TextPropertyEditor, but with zero
 * visual-editor schema/transaction dependency — only raw textContent.
 *
 * Usage:
 *   const editor = createInlineTextEditor({ container, eventBus });
 *   // User double-clicks a heading → edits in place → clicks Save →
 *   // INTENT_ELEMENT_EDITED { elementId, value, previousValue, tagName }
 *   editor.destroy(); // cleanup
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { uid } from '../../../utils/id.js';

const INLINE_TAGS = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'P', 'SPAN', 'A', 'BUTTON', 'LABEL', 'LI',
    'TD', 'TH', 'DT', 'DD', 'FIGCAPTION', 'BLOCKQUOTE',
    'LEGEND', 'CAPTION', 'SUMMARY', 'CITE', 'Q',
    'TIME', 'MARK', 'ABBR', 'CODE', 'KBD', 'SAMP', 'VAR',
    'EM', 'STRONG', 'SMALL', 'SUB', 'SUP', 'I', 'B', 'U',
    'DEL', 'INS'
]);

const NON_EDITABLE_TAGS = new Set([
    'BR', 'HR', 'IMG', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO',
    'IFRAME', 'INPUT', 'TEXTAREA', 'SELECT', 'OBJECT', 'EMBED'
]);

const SINGLE_LINE_TAGS = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'SPAN', 'A', 'BUTTON', 'LABEL',
    'TH', 'TD', 'DT', 'DD', 'LEGEND', 'CAPTION'
]);

/**
 * Lightweight undo/redo stack for inline edits.
 * Each entry stores two closures: apply (redo) and revert (undo).
 */
class EditHistory {
    constructor(maxSize = 100) {
        this._undoStack = [];
        this._redoStack = [];
        this._maxSize = maxSize;
    }
    push(apply, revert) {
        this._undoStack.push({ apply, revert });
        this._redoStack = []; // new edit clears redo
        if (this._undoStack.length > this._maxSize) this._undoStack.shift();
    }
    undo() {
        const entry = this._undoStack.pop();
        if (!entry) return false;
        entry.revert();
        this._redoStack.push(entry);
        return true;
    }
    redo() {
        const entry = this._redoStack.pop();
        if (!entry) return false;
        entry.apply();
        this._undoStack.push(entry);
        return true;
    }
    get canUndo() { return this._undoStack.length > 0; }
    get canRedo() { return this._redoStack.length > 0; }
    clear() {
        this._undoStack = [];
        this._redoStack = [];
    }
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.container   — only elements inside this are editable
 * @param {object}       opts.eventBus   — CSMA EventBus
 * @param {(el: HTMLElement) => boolean} [opts.filter] — optional filter (default: any text element)
 * @param {Document}     [opts.documentRef]
 * @returns {{ destroy(): void }}
 */
export function createInlineTextEditor({
    container,
    eventBus,
    filter = null,
    documentRef = null
}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!container || !eventBus || !doc) {
        return { destroy() {} };
    }

    let activeEl = null;
    let originalText = '';
    let toolbarEl = null;
    let isActive = false;
    const history = new EditHistory();
    let eventSubs = [];

    // ── event listeners ───────────────────────────────────────────────

    container.addEventListener('dblclick', onDblClick);
    container.addEventListener('keydown', onKeyDown);
    // Global keyboard shortcuts (only when not actively editing)
    doc.addEventListener('keydown', onGlobalKeyDown);
    // Subscribe to undo/redo intents (from dock buttons or other UI)
    eventSubs = wireIntents();

    function onGlobalKeyDown(e) {
        // Don't intercept while contentEditable is active (let browser handle it)
        if (isActive) return;
        // Don't intercept inside inputs/textareas/selects
        const tag = doc.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (doc.activeElement?.isContentEditable) return;

        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.shiftKey) {
                publish('INTENT_REDO', { timestamp: Date.now() });
            } else {
                publish('INTENT_UNDO', { timestamp: Date.now() });
            }
        }
        // Ctrl+Y = redo (Windows convention)
        if (e.key === 'y' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            publish('INTENT_REDO', { timestamp: Date.now() });
        }
    }

    function onDblClick(e) {
        if (isActive) return;
        const target = e.target;
        if (!container.contains(target)) return;
        if (!isEditable(target)) return;
        e.preventDefault();
        e.stopPropagation();
        activate(target);
    }

    function onKeyDown(e) {
        if (e.key === 'F2' && !isActive) {
            const target = doc.activeElement;
            if (!target || !container.contains(target)) return;
            if (!isEditable(target)) return;
            e.preventDefault();
            e.stopPropagation();
            activate(target);
        }
        if (isActive && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancel();
        }
        // Enter in single-line tags = save
        if (isActive && e.key === 'Enter' && !e.shiftKey && activeEl) {
            if (SINGLE_LINE_TAGS.has(activeEl.tagName)) {
                e.preventDefault();
                e.stopPropagation();
                save();
            }
        }
    }

    function onToolbarClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'save') save();
        else if (btn.dataset.action === 'cancel') cancel();
    }

    function onBlur() {
        // small delay so toolbar clicks register before deactivation
        setTimeout(() => {
            if (isActive && activeEl && doc.activeElement !== activeEl) {
                // check if focus moved to toolbar
                if (!toolbarEl || !toolbarEl.contains(doc.activeElement)) {
                    save();
                }
            }
        }, 150);
    }

    // ── activation ────────────────────────────────────────────────────

    function isEditable(el) {
        if (!el || el.nodeType !== 1) return false;
        // Don't edit chrome / UI
        if (el.closest('.noir-dock, .slide-rail, .slide-grid, .presenter-overlay, .csma-overlay-backdrop') !== null) return false;
        // Don't edit already-editable elements
        if (el.isContentEditable || el.contentEditable === 'true') return false;
        // Don't edit non-text tags
        if (NON_EDITABLE_TAGS.has(el.tagName)) return false;
        // Only edit inline text elements (avoid editing entire sections)
        if (!INLINE_TAGS.has(el.tagName)) return false;
        // Must have text content
        const text = el.textContent?.trim();
        if (!text) return false;
        // Apply user filter if provided
        if (typeof filter === 'function' && !filter(el)) return false;
        return true;
    }

    function activate(el) {
        if (isActive) return;
        isActive = true;
        activeEl = el;
        originalText = el.textContent || '';

        // Ensure stable ID for the intent payload
        if (!el.id) el.id = uid('el');

        el.contentEditable = 'true';
        el.classList.add('csma-inline-edit-active');
        el.addEventListener('blur', onBlur);
        el.focus();

        // Select all text for quick replacement
        const range = doc.createRange();
        range.selectNodeContents(el);
        const sel = doc.defaultView?.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        // Create floating toolbar
        toolbarEl = buildToolbar();
        doc.body.appendChild(toolbarEl);
        positionToolbar();
        toolbarEl.addEventListener('click', onToolbarClick);
    }

    function deactivate() {
        if (!isActive) return;
        isActive = false;

        if (activeEl) {
            activeEl.contentEditable = 'false';
            activeEl.classList.remove('csma-inline-edit-active');
            activeEl.removeEventListener('blur', onBlur);
        }

        if (toolbarEl) {
            toolbarEl.removeEventListener('click', onToolbarClick);
            toolbarEl.remove();
            toolbarEl = null;
        }

        activeEl = null;
        originalText = '';
    }

    // ── save / cancel ─────────────────────────────────────────────────

    function save() {
        if (!activeEl) { deactivate(); return; }
        const newText = activeEl.textContent?.trim();
        // Revert to original if empty (don't save empty text)
        if (!newText) {
            activeEl.textContent = originalText;
            deactivate();
            return;
        }
        // Nothing changed — skip intent
        if (newText === originalText) {
            deactivate();
            return;
        }
        // Capture values before deactivate nulls activeEl
        const elId = activeEl.id;
        const tag = activeEl.tagName.toLowerCase();
        const prev = originalText;
        deactivate();

        // Push to undo stack: apply sets new text, revert restores old
        history.push(
            () => {
                const el = doc.getElementById(elId);
                if (el) {
                    el.textContent = newText;
                    publish('INTENT_ELEMENT_EDITED', {
                        elementId: elId, tagName: tag,
                        value: newText, previousValue: prev,
                        timestamp: Date.now()
                    });
                }
            },
            () => {
                const el = doc.getElementById(elId);
                if (el) {
                    el.textContent = prev;
                    publish('INTENT_ELEMENT_EDITED', {
                        elementId: elId, tagName: tag,
                        value: prev, previousValue: newText,
                        timestamp: Date.now()
                    });
                }
            }
        );

        publish('INTENT_ELEMENT_EDITED', {
            elementId: elId,
            tagName: tag,
            value: newText,
            previousValue: prev,
            timestamp: Date.now()
        });
    }

    function cancel() {
        if (activeEl) {
            activeEl.textContent = originalText;
        }
        deactivate();
    }

    // ── toolbar ───────────────────────────────────────────────────────

    function buildToolbar() {
        const el = doc.createElement('div');
        el.className = 'csma-inline-edit-toolbar';
        el.setAttribute('role', 'toolbar');
        el.setAttribute('aria-label', 'Text editing controls');

        const { root } = getComposer().mountTree(spec('div', {
            className: 'csma-inline-edit-toolbar-inner',
            children: [
                spec('button', {
                    className: 'csma-inline-edit-btn csma-inline-edit-btn--save',
                    text: '✓',
                    dataset: { action: 'save' },
                    attrs: { type: 'button', title: 'Save (Ctrl+Enter)', 'aria-label': 'Save changes' }
                }),
                spec('button', {
                    className: 'csma-inline-edit-btn csma-inline-edit-btn--cancel',
                    text: '✕',
                    dataset: { action: 'cancel' },
                    attrs: { type: 'button', title: 'Cancel (Escape)', 'aria-label': 'Cancel editing' }
                })
            ]
        }), el, { documentRef: doc });

        return el;
    }

    function positionToolbar() {
        if (!toolbarEl || !activeEl) return;
        const rect = activeEl.getBoundingClientRect();
        toolbarEl.style.position = 'fixed';
        toolbarEl.style.top = Math.max(rect.top - 44, 8) + 'px';
        toolbarEl.style.left = Math.max(rect.left, 8) + 'px';
        // Don't overflow right edge
        const tw = toolbarEl.offsetWidth || 80;
        if (rect.left + tw > doc.defaultView.innerWidth - 8) {
            toolbarEl.style.left = (doc.defaultView.innerWidth - tw - 8) + 'px';
        }
    }

    // ── undo / redo (public API + EventBus) ──────────────────────────

    function performUndo() {
        if (!history.canUndo) return false;
        history.undo();
        return true;
    }

    function performRedo() {
        if (!history.canRedo) return false;
        history.redo();
        return true;
    }

    function wireIntents() {
        const subs = [];
        if (typeof eventBus.subscribe === 'function') {
            subs.push(eventBus.subscribe('INTENT_UNDO', () => performUndo()));
            subs.push(eventBus.subscribe('INTENT_REDO', () => performRedo()));
        }
        return subs;
    }

    // ── helpers ───────────────────────────────────────────────────────

    function publish(name, payload) {
        if (typeof eventBus.publishSync === 'function') {
            eventBus.publishSync(name, payload);
        } else {
            eventBus.publish(name, payload);
        }
    }

    function destroy() {
        deactivate();
        container.removeEventListener('dblclick', onDblClick);
        container.removeEventListener('keydown', onKeyDown);
        doc.removeEventListener('keydown', onGlobalKeyDown);
        eventSubs.forEach((u) => { try { u(); } catch { /* best-effort */ } });
        eventSubs = [];
        history.clear();
    }

    return {
        destroy,
        undo: performUndo,
        redo: performRedo,
        get canUndo() { return history.canUndo; },
        get canRedo() { return history.canRedo; }
    };
}
