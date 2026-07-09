/**
 * Text Property Editor — contenteditable text input with selection sync
 * and inline mark rendering.
 *
 * This is the ONLY component that uses contenteditable. All other editing
 * UI is standard DOM.
 *
 * Part of Phase 2: Rendering Components.
 */

import { createCursor, createTextSelection, getSelectionRange } from '../engine/SelectionModel.js';
import { adjustRangesForDeletion, adjustRangesForInsertion } from '../engine/TextOperations.js';

/**
 * Initialize a text property editor on a container element.
 *
 * @param {Element} container — parent element to append the editor into
 * @param {import('../services/EditorSessionService.js').EditorSessionService} session
 * @param {Array<string|number>} path — path to the text property
 * @param {object} [options]
 * @param {boolean} [options.editable=true]
 * @returns {Function} cleanup function
 */
export function initTextPropertyEditor(container, session, path, options = {}) {
    const editable = options.editable !== false;
    const el = document.createElement('div');

    el.className = 've-text-property';
    el.setAttribute('data-property-path', path.join(','));
    el.setAttribute('contenteditable', String(editable));
    el.setAttribute('data-state', 'editing');

    container.appendChild(el);

    let is_composing = false;
    let ignore_next_selection = false;

    // Render the text content with marks using DOM node creation (no innerHTML)
    function render() {
        if (is_composing) return;

        try {
            const value = session.get(path);
            if (!value) return;

            const content = value.content || '';
            const marks = value.marks || [];

            // Build sorted list of mark boundaries
            const events = [];
            for (const mark of marks) {
                events.push({ pos: mark.start_offset, type: 'open', node_id: mark.node_id });
                events.push({ pos: mark.end_offset, type: 'close', node_id: mark.node_id });
            }
            events.sort((a, b) => a.pos - b.pos || (a.type === 'close' ? -1 : 1));

            // Build DOM fragment with text nodes and mark spans
            const fragment = document.createDocumentFragment();
            let last_pos = 0;
            /** @type {Array<{ node_id: string, el: Element }>} */
            const open_marks = [];

            for (const event of events) {
                // Append text content before this boundary
                if (event.pos > last_pos) {
                    const text = content.slice(last_pos, event.pos);
                    const target = open_marks.length > 0
                        ? open_marks[open_marks.length - 1].el
                        : fragment;
                    target.appendChild(document.createTextNode(text));
                    last_pos = event.pos;
                }

                if (event.type === 'open') {
                    const mark_node = session.get(event.node_id);
                    const mark_type = mark_node ? mark_node.type : 'unknown';
                    const span = document.createElement('span');
                    span.setAttribute('data-mark', mark_type);
                    span.setAttribute('data-mark-id', event.node_id);
                    open_marks.push({ node_id: event.node_id, el: span });
                } else {
                    // Close: find the matching open mark and append its span to parent
                    const idx = open_marks.findIndex(m => m.node_id === event.node_id);
                    if (idx !== -1) {
                        // Close all marks from innermost to this one
                        for (let i = open_marks.length - 1; i >= idx; i--) {
                            const mark = open_marks[i];
                            const parent = i > 0 ? open_marks[i - 1].el : fragment;
                            parent.appendChild(mark.el);
                        }
                        open_marks.splice(idx);
                    }
                }
            }

            // Remaining content
            if (last_pos < content.length) {
                const text = content.slice(last_pos);
                const target = open_marks.length > 0
                    ? open_marks[open_marks.length - 1].el
                    : fragment;
                target.appendChild(document.createTextNode(text));
            }

            // Close any remaining open marks
            for (let i = open_marks.length - 1; i >= 0; i--) {
                const mark = open_marks[i];
                const parent = i > 0 ? open_marks[i - 1].el : fragment;
                parent.appendChild(mark.el);
            }

            // Clear and replace content
            while (el.firstChild) {
                el.removeChild(el.firstChild);
            }

            if (!fragment.hasChildNodes()) {
                el.appendChild(document.createTextNode('\u200B'));
            } else {
                el.appendChild(fragment);
            }
        } catch {
            // Render error — show plain text
            try {
                while (el.firstChild) el.removeChild(el.firstChild);
                const value = session.get(path);
                el.appendChild(document.createTextNode(value?.content || ''));
            } catch {
                while (el.firstChild) el.removeChild(el.firstChild);
                el.appendChild(document.createTextNode(''));
            }
        }
    }

    // Handle text input
    // Handle text input — preserve marks/annotations by diffing text positions
    function handleInput() {
        if (is_composing) return;

        try {
            const text = el.textContent || '';
            const current_value = session.get(path);
            const old_content = current_value?.content || '';

            // Compute position of first difference
            let diff_start = 0;
            while (diff_start < old_content.length && diff_start < text.length &&
                   old_content[diff_start] === text[diff_start]) {
                diff_start++;
            }

            // Compute how much was deleted/inserted
            const old_tail = old_content.slice(diff_start);
            const new_tail = text.slice(diff_start);

            const deleted_len = old_tail.length;
            const inserted_len = new_tail.length;

            const tr = session.tr;

            if (deleted_len === 0 && inserted_len === 0) return; // No change

            // Preserve existing marks and annotations, adjusting ranges
            const old_marks = current_value?.marks || [];
            const old_annotations = current_value?.annotations || [];

            let new_marks, new_annotations;

            if (deleted_len > 0) {
                // Delete + possibly insert
                new_marks = adjustRangesForDeletion(old_marks, diff_start, deleted_len);
                new_annotations = adjustRangesForDeletion(old_annotations, diff_start, deleted_len);
            } else {
                new_marks = old_marks;
                new_annotations = old_annotations;
            }

            if (inserted_len > 0) {
                new_marks = adjustRangesForInsertion(new_marks, diff_start, inserted_len);
                new_annotations = adjustRangesForInsertion(new_annotations, diff_start, inserted_len);
            }

            tr.set(path, {
                content: text,
                marks: new_marks,
                annotations: new_annotations
            });
            session.apply(tr, { batch: true });
        } catch (error) {
            console.warn('[TextPropertyEditor] Input error:', error);
        }
    }

    // Handle selection changes
    function handleSelectionChange() {
        if (is_composing) return;
        if (ignore_next_selection) {
            ignore_next_selection = false;
            return;
        }

        try {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            // Check if selection is inside our editor
            if (!el.contains(sel.anchorNode) && !el.contains(sel.focusNode)) return;

            const anchor_offset = getTextOffset(el, sel.anchorNode, sel.anchorOffset);
            const focus_offset = getTextOffset(el, sel.focusNode, sel.focusOffset);

            if (anchor_offset >= 0 && focus_offset >= 0) {
                session.selection = createTextSelection(path, anchor_offset, focus_offset);
            }
        } catch (error) {
            console.warn('[TextPropertyEditor] Selection error:', error);
        }
    }

    // Restore DOM selection from internal selection
    function restoreSelection() {
        const sel = session.selection;
        if (!sel || sel.type !== 'text') return;
        if (sel.path.join(',') !== path.join(',')) return;

        const range = getSelectionRange(sel);
        ignore_next_selection = true;

        try {
            const dom_sel = window.getSelection();
            const dom_range = document.createRange();

            const { node, offset } = findDomPosition(el, range.start_offset);
            dom_range.setStart(node, offset);

            if (range.start_offset === range.end_offset) {
                dom_range.collapse(true);
            } else {
                const end = findDomPosition(el, range.end_offset);
                dom_range.setEnd(end.node, end.offset);
            }

            dom_sel.removeAllRanges();
            dom_sel.addRange(dom_range);
        } catch {
            // Selection restore failed — acceptable
        }
    }

    // Event listeners
    el.addEventListener('input', handleInput);
    document.addEventListener('selectionchange', handleSelectionChange);
    const handleCompositionStart = () => { is_composing = true; };
    const handleCompositionEnd = () => {
        is_composing = false;
        handleInput();
    };
    el.addEventListener('compositionstart', handleCompositionStart);
    el.addEventListener('compositionend', handleCompositionEnd);

    // Initial render
    render();

    // Cleanup function
    return () => {
        el.removeEventListener('input', handleInput);
        document.removeEventListener('selectionchange', handleSelectionChange);
        el.removeEventListener('compositionstart', handleCompositionStart);
        el.removeEventListener('compositionend', handleCompositionEnd);
        el.removeAttribute('contenteditable');
    };

    return cleanup_listener;
}

/**
 * Get the text offset of a DOM node within the editor.
 * Walks text nodes counting characters, respecting mark spans.
 *
 * @param {Element} root — the editor element
 * @param {Node} target_node
 * @param {number} target_offset
 * @returns {number} character offset, or -1 if not found
 */
function getTextOffset(root, target_node, target_offset) {
    let offset = 0;

    function walk(node) {
        if (node === target_node) {
            offset += target_offset;
            return true; // found
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            // Skip zero-width space
            if (text === '\u200B') return false;
            offset += text.length;
            return false;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            for (const child of node.childNodes) {
                if (walk(child)) return true;
            }
        }

        return false;
    }

    if (walk(root)) return offset;
    return -1;
}

/**
 * Find the DOM node and offset for a given character position.
 *
 * @param {Element} root
 * @param {number} target_offset
 * @returns {{ node: Node, offset: number }}
 */
function findDomPosition(root, target_offset) {
    let current_offset = 0;

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text === '\u200B') return null; // skip ZWS

            const next = current_offset + text.length;
            if (target_offset <= next) {
                return { node, offset: target_offset - current_offset };
            }
            current_offset = next;
            return null;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            for (const child of node.childNodes) {
                const result = walk(child);
                if (result) return result;
            }
        }

        return null;
    }

    return walk(root) || { node: root, offset: 0 };
}
