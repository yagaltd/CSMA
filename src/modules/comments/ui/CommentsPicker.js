/**
 * CommentsPicker — Phase 4.4 element-targeting.
 *
 * Lets a user click any element inside a host container and start a comment
 * anchored to THAT element (CMS-style overlay editing). The drawer's general
 * composer only produces scope-level comments; this produces element-level
 * anchors so markers/popups can later pin the exact target.
 *
 * Flow:
 *   INTENT_COMMENTS_START_PICK {scope}  -> start()  (host binds this to a button)
 *   mousemove                          -> outline hovered element
 *   click                              -> capture element, open inline form
 *   form Add                           -> INTENT_COMMENT_ADD with element anchor
 *   ESC / form Cancel                  -> stop()
 *   COMMENTS_PICK_MODE {active}        -> emitted on toggle (host hint/cursor)
 *
 * Stable anchor: if the captured element has no id, one is generated and set
 * on the live element so the AnchorResolver can re-resolve it later.
 *
 * Archetype: aiui-native (spec + mountTree). No innerHTML. Listeners are
 * capture-phase + stopPropagation so a pick click never also triggers slide
 * navigation or other content handlers.
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';

export function createCommentsPicker({
    eventBus,
    container,
    getScope = null,
    overlayManager = null,
    documentRef = null
}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!eventBus || !container || !doc) {
        return { start() {}, stop() {}, isActive() { return false; }, destroy() {} };
    }

    let active = false;
    let pickScope = null;
    let outlined = null;
    let hintEl = null;
    let popoverHandle = null;
    const subs = [];

    const sub = (name, fn) => {
        const u = eventBus.subscribe?.(name, fn);
        if (typeof u === 'function') subs.push(u);
    };
    sub('INTENT_COMMENTS_START_PICK', (p) => start(p?.scope));

    function publish(name, payload) {
        if (typeof eventBus.publishSync === 'function') eventBus.publishSync(name, payload);
        else eventBus.publish(name, payload);
    }

    // ── pick mode ──────────────────────────────────────────────────────

    function start(scope) {
        if (active) return;
        active = true;
        pickScope = scope ?? (typeof getScope === 'function' ? getScope() : null);
        doc.addEventListener('mousemove', onMove, true);
        doc.addEventListener('click', onClick, true);
        doc.addEventListener('keydown', onKey, true);
        showHint();
        publish('COMMENTS_PICK_MODE', { active: 'true', timestamp: Date.now() });
    }

    function stop() {
        if (!active && !hintEl && !popoverHandle) {
            // ensure a stray COMMENTS_PICK_MODE false isn't double-emitted
        }
        const wasActive = active;
        active = false;
        doc.removeEventListener('mousemove', onMove, true);
        doc.removeEventListener('click', onClick, true);
        doc.removeEventListener('keydown', onKey, true);
        clearOutline();
        hideHint();
        if (popoverHandle) { try { popoverHandle.close(); } catch { /* best-effort */ } popoverHandle = null; }
        if (wasActive) publish('COMMENTS_PICK_MODE', { active: 'false', timestamp: Date.now() });
    }

    function isActive() { return active; }

    function destroy() {
        subs.forEach((u) => { try { u(); } catch { /* best-effort */ } });
        subs.length = 0;
        stop();
    }

    // ── listeners ──────────────────────────────────────────────────────

    /** Skip the drawer, popovers, and our own hint banner. */
    function isPickerUI(el) {
        return !!(el && el.closest && el.closest(
            '.csma-overlay-drawer, .csma-overlay-popover, .csma-overlay-backdrop, .csma-comments-picker-hint'
        ));
    }

    function onMove(e) {
        if (!active) return;
        const el = e.target;
        if (!el || el === doc || isPickerUI(el) || !container.contains(el)) {
            clearOutline();
            return;
        }
        if (outlined !== el) {
            clearOutline();
            outlined = el;
            el.classList.add('csma-comments-pick-target');
        }
    }

    function onClick(e) {
        if (!active) return;
        const el = outlined || e.target;
        if (!el || isPickerUI(el) || !container.contains(el)) return;
        // swallow the pick click so it doesn't also navigate/activate content
        e.preventDefault();
        e.stopPropagation();
        capture(el);
    }

    function onKey(e) {
        if (!active) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            stop();
        }
    }

    function clearOutline() {
        if (outlined) {
            outlined.classList.remove('csma-comments-pick-target');
            outlined = null;
        }
    }

    // ── capture + form ─────────────────────────────────────────────────

    function capture(el) {
        // exit pick mode first so the click listener doesn't grab the form
        active = false;
        doc.removeEventListener('mousemove', onMove, true);
        doc.removeEventListener('click', onClick, true);
        doc.removeEventListener('keydown', onKey, true);
        clearOutline();
        hideHint();
        publish('COMMENTS_PICK_MODE', { active: 'false', timestamp: Date.now() });

        // ensure a stable, re-resolvable anchor
        if (!el.id) el.id = 'cmt-el-' + Math.random().toString(36).slice(2, 10);
        const anchor = { anchor_type: 'element', anchor: { id: el.id } };

        if (!overlayManager) {
            // no overlay -> just publish with an empty body is wrong; bail.
            return;
        }
        const form = buildForm();
        popoverHandle = overlayManager.openPopover(form, el, {
            onClose: () => { popoverHandle = null; }
        });
        wireForm(form, anchor, el);
        // focus the textarea for fast typing
        const ta = form.querySelector('.csma-comments-picker-input');
        if (ta) setTimeout(() => { try { ta.focus(); } catch { /* best-effort */ } }, 0);
    }

    function buildForm() {
        const { root } = getComposer().mountTree(spec('div', {
            className: 'csma-comments-picker-form',
            attrs: { role: 'group', 'aria-label': 'Comment on this element' },
            children: [
                spec('textarea', {
                    className: 'csma-comments-picker-input',
                    attrs: {
                        placeholder: 'Comment on this element…',
                        'aria-label': 'Comment body',
                        rows: '3',
                        maxlength: '20000'
                    }
                }),
                spec('div', {
                    className: 'csma-comment-form-actions',
                    children: [
                        spec('button', {
                            className: 'csma-comments-add-btn',
                            text: 'Add',
                            dataset: { action: 'pick-add' },
                            attrs: { type: 'button' }
                        }),
                        spec('button', {
                            className: 'csma-comment-btn ghost',
                            text: 'Cancel',
                            dataset: { action: 'pick-cancel' },
                            attrs: { type: 'button' }
                        })
                    ]
                })
            ]
        }), null, { documentRef: doc });
        return root;
    }

    function wireForm(form, anchor, el) {
        const ta = form.querySelector('.csma-comments-picker-input');
        const submit = () => {
            const body = ta?.value?.trim();
            if (!body) return;
            publish('INTENT_COMMENT_ADD', {
                scope: pickScope,
                anchor,
                body,
                timestamp: Date.now()
            });
            if (popoverHandle) { try { popoverHandle.close(); } catch { /* best-effort */ } popoverHandle = null; }
        };
        form.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'pick-add') submit();
            else if (btn.dataset.action === 'pick-cancel') {
                if (popoverHandle) { try { popoverHandle.close(); } catch { /* best-effort */ } popoverHandle = null; }
            }
        });
        ta?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
        });
    }

    // ── hint banner ────────────────────────────────────────────────────

    function showHint() {
        if (hintEl) return;
        const { root } = getComposer().mountTree(spec('div', {
            className: 'csma-comments-picker-hint',
            attrs: { role: 'status', 'aria-live': 'polite' },
            text: 'Click an element to comment on it. Press Esc to cancel.'
        }), null, { documentRef: doc });
        hintEl = root;
        doc.body.appendChild(hintEl);
    }

    function hideHint() {
        if (hintEl) { hintEl.remove(); hintEl = null; }
    }

    return { start, stop, isActive, destroy };
}
