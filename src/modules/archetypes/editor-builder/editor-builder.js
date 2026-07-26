/**
 * Editor Builder Archetype — CSMA Token-Driven Form Editor
 *
 * Factory: createEditor(container, emit, options) → { update, destroy, getValues, setValues, reset }
 *
 * Phase 3.1-C: all DOM construction routes through `getComposer().mountTree()`.
 * No raw document.createElement. Events are wired post-mount on the real DOM
 * elements the composer returns.
 *
 * Features:
 * - Form fields rendered from declarative definitions
 * - Field types: text, email, number, password, textarea, select, checkbox, toggle
 * - Validation (required, minLength, maxLength, pattern) with per-field errors
 * - Draft persistence via localStorage key
 * - Loading/saving state with save status indicator
 * - CSMA design tokens for all visual values
 * - Keyboard-friendly (Enter to submit)
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { clearChildren } from '../../../utils/dom.js';

const DRAFT_PREFIX = 'csma.editor.draft.';

export function createEditor(container, emit, options = {}) {
    const {
        fields = [],
        onSave = null,
        draftKey = null,
        initialValues = {},
        submitLabel = 'Save',
        resetLabel = 'Reset',
    } = options;

    let isSaving = false;
    let values = { ...initialValues };
    let fieldErrors = {};
    let fieldCleanups = [];

    // Restore draft if available
    if (draftKey) {
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_PREFIX + draftKey));
            if (draft) values = { ...values, ...draft };
        } catch {}
    }

    // ─── Initial mount via mountTree ───────────────────

    const composer = getComposer();
    const { root, cleanup: rootCleanup } = composer.mountTree(spec('div', {
        className: 'csma-editor',
        attrs: { role: 'form', 'aria-label': 'Editor' },
        children: [
            spec('div', { className: 'csma-editor__fields' }),
            spec('div', { className: 'csma-editor__actions', children: [
                spec('span', { className: 'csma-editor__save-status' }),
                spec('button', {
                    className: 'csma-editor__reset',
                    attrs: { type: 'button' },
                    text: resetLabel
                }),
                spec('button', {
                    className: 'csma-editor__submit',
                    attrs: { type: 'button' },
                    text: submitLabel
                })
            ]})
        ]
    }), container);

    const fieldsContainer = root.querySelector('.csma-editor__fields');
    const submitBtn = root.querySelector('.csma-editor__submit');
    const resetBtn = root.querySelector('.csma-editor__reset');
    const saveStatus = root.querySelector('.csma-editor__save-status');

    // ─── Event wiring (on mounted DOM) ─────────────────

    submitBtn.addEventListener('click', () => handleSubmit());
    resetBtn.addEventListener('click', () => reset());
    root.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    });

    // ─── Field Spec Builders ───────────────────────────

    function buildTextInputSpec(field) {
        const inputType = field.type === 'email' ? 'email' :
                         field.type === 'number' ? 'number' :
                         field.type === 'password' ? 'password' : 'text';
        const inputAttrs = {
            type: inputType,
            id: `field-${field.id}`,
            placeholder: field.placeholder || ''
        };
        // NOTE: 'value' is set as a DOM PROPERTY post-mount (not as an
        // attribute) to match the original implementation's semantics.
        if (field.required) inputAttrs.required = '';
        if (field.minLength != null) inputAttrs.minlength = String(field.minLength);
        if (field.maxLength != null) inputAttrs.maxlength = String(field.maxLength);

        return spec('div', {
            className: 'csma-editor__field',
            children: [
                spec('label', {
                    className: 'csma-editor__label' + (field.required ? ' csma-editor__label-required' : ''),
                    attrs: { for: `field-${field.id}` },
                    text: field.label
                }),
                spec('input', { className: 'csma-editor__input', attrs: inputAttrs }),
                spec('span', { className: 'csma-editor__error', dataset: { field: field.id } }),
                field.help ? spec('span', { className: 'csma-editor__help', text: field.help }) : null
            ]
        });
    }

    function buildTextareaSpec(field) {
        const attrs = {
            id: `field-${field.id}`,
            placeholder: field.placeholder || '',
            rows: String(field.rows || 4)
        };
        if (field.required) attrs.required = '';

        return spec('div', {
            className: 'csma-editor__field',
            children: [
                spec('label', {
                    className: 'csma-editor__label' + (field.required ? ' csma-editor__label-required' : ''),
                    attrs: { for: `field-${field.id}` },
                    text: field.label
                }),
                spec('textarea', {
                    className: 'csma-editor__textarea',
                    attrs,
                    text: values[field.id] || ''
                }),
                spec('span', { className: 'csma-editor__error', dataset: { field: field.id } }),
                field.help ? spec('span', { className: 'csma-editor__help', text: field.help }) : null
            ]
        });
    }

    function buildSelectSpec(field) {
        const optionSpecs = (field.options || []).map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            const optAttrs = { value: val };
            // NOTE: 'selected' is set as a DOM PROPERTY post-mount.
            return spec('option', { attrs: optAttrs, text: label });
        });

        return spec('div', {
            className: 'csma-editor__field',
            children: [
                spec('label', {
                    className: 'csma-editor__label' + (field.required ? ' csma-editor__label-required' : ''),
                    attrs: { for: `field-${field.id}` },
                    text: field.label
                }),
                spec('select', {
                    className: 'csma-editor__select',
                    attrs: { id: `field-${field.id}` },
                    children: optionSpecs
                }),
                spec('span', { className: 'csma-editor__error', dataset: { field: field.id } }),
                field.help ? spec('span', { className: 'csma-editor__help', text: field.help }) : null
            ]
        });
    }

    function buildToggleSpec(field) {
        const checkboxAttrs = { type: 'checkbox' };
        // NOTE: 'checked' is set as a DOM PROPERTY post-mount.

        return spec('div', {
            className: 'csma-editor__field',
            children: [
                spec('label', {
                    className: 'csma-editor__toggle',
                    children: [
                        spec('input', { attrs: checkboxAttrs }),
                        spec('span', { className: 'csma-editor__toggle-track' }),
                        spec('span', { text: field.label })
                    ]
                }),
                spec('span', { className: 'csma-editor__error', dataset: { field: field.id } }),
                field.help ? spec('span', { className: 'csma-editor__help', text: field.help }) : null
            ]
        });
    }

    function buildFieldSpec(field) {
        switch (field.type) {
            case 'textarea': case 'richtext':
                return buildTextareaSpec(field);
            case 'select':
                return buildSelectSpec(field);
            case 'toggle': case 'checkbox':
                return buildToggleSpec(field);
            case 'text': case 'email': case 'number': case 'password': default:
                return buildTextInputSpec(field);
        }
    }

    function wireFieldEvents(fieldEl, field) {
        const input = fieldEl.querySelector(`#field-${field.id}`) || fieldEl.querySelector('input[type="checkbox"]');
        if (!input) return;

        // Set DOM properties that differ from attributes (value/selected/checked)
        if (field.type === 'toggle' || field.type === 'checkbox') {
            input.checked = !!values[field.id];
        } else if (field.type === 'select') {
            input.value = String(values[field.id] || '');
        } else if (values[field.id] != null) {
            input.value = String(values[field.id]);
        }

        const eventName = field.type === 'select' ? 'change' :
                         (field.type === 'toggle' || field.type === 'checkbox') ? 'change' : 'input';

        input.addEventListener(eventName, () => {
            if (field.type === 'toggle' || field.type === 'checkbox') {
                values[field.id] = input.checked;
            } else {
                values[field.id] = input.value;
                clearFieldError(field.id);
            }
            if (field.type === 'select') clearFieldError(field.id);
            persistDraft();
        });
    }

    // ─── Error display ─────────────────────────────────

    function showFieldError(fieldId, message) {
        const errEl = root.querySelector(`.csma-editor__error[data-field="${fieldId}"]`);
        if (errEl) { errEl.textContent = message; errEl.dataset.visible = 'true'; }
        const input = root.querySelector(`#field-${fieldId}`);
        if (input) input.setAttribute('aria-invalid', 'true');
        fieldErrors[fieldId] = message;
    }

    function clearFieldError(fieldId) {
        const errEl = root.querySelector(`.csma-editor__error[data-field="${fieldId}"]`);
        if (errEl) { errEl.textContent = ''; delete errEl.dataset.visible; }
        const input = root.querySelector(`#field-${fieldId}`);
        if (input) input.removeAttribute('aria-invalid');
        delete fieldErrors[fieldId];
    }

    // ─── Render All Fields ─────────────────────────────

    function renderFields() {
        fieldCleanups.forEach((fn) => { try { fn(); } catch {} });
        fieldCleanups = [];
        clearChildren(fieldsContainer);

        fields.forEach((field) => {
            const fieldSpec = buildFieldSpec(field);
            const { root: fieldRoot, cleanup } = composer.mountTree(fieldSpec, fieldsContainer);
            fieldCleanups.push(cleanup);
            wireFieldEvents(fieldRoot, field);

            if (fieldErrors[field.id]) {
                showFieldError(field.id, fieldErrors[field.id]);
            }
        });
    }

    // ─── Validation ────────────────────────────────────

    function validate() {
        let valid = true;
        fields.forEach((field) => {
            const val = values[field.id];
            if (field.required && (!val || (typeof val === 'string' && val.trim() === ''))) {
                showFieldError(field.id, `${field.label} is required`);
                valid = false;
            } else if (field.minLength && typeof val === 'string' && val.length < field.minLength) {
                showFieldError(field.id, `Minimum ${field.minLength} characters`);
                valid = false;
            } else if (field.maxLength && typeof val === 'string' && val.length > field.maxLength) {
                showFieldError(field.id, `Maximum ${field.maxLength} characters`);
                valid = false;
            } else if (field.pattern && typeof val === 'string' && !new RegExp(field.pattern).test(val)) {
                showFieldError(field.id, field.patternMessage || 'Invalid format');
                valid = false;
            } else {
                clearFieldError(field.id);
            }
        });
        return valid;
    }

    // ─── Submit ────────────────────────────────────────

    async function handleSubmit() {
        if (isSaving) return;
        if (!validate()) return;

        isSaving = true;
        root.dataset.state = 'saving';
        submitBtn.disabled = true;
        saveStatus.dataset.status = '';
        saveStatus.textContent = 'Saving…';

        try {
            if (onSave) {
                await onSave({ ...values });
            }
            saveStatus.dataset.status = 'saved';
            saveStatus.textContent = 'Saved';
            clearDraft();
            if (emit) emit('editor:saved', { values: { ...values } });
        } catch (err) {
            saveStatus.dataset.status = 'error';
            saveStatus.textContent = err.message || 'Save failed';
            if (emit) emit('editor:error', { error: err.message || String(err) });
        } finally {
            isSaving = false;
            delete root.dataset.state;
            submitBtn.disabled = false;
            setTimeout(() => {
                if (saveStatus.dataset.status !== 'error') {
                    saveStatus.textContent = '';
                    saveStatus.dataset.status = '';
                }
            }, 3000);
        }
    }

    // ─── Draft Persistence ─────────────────────────────

    function persistDraft() {
        if (!draftKey) return;
        try {
            localStorage.setItem(DRAFT_PREFIX + draftKey, JSON.stringify(values));
        } catch {}
    }

    function clearDraft() {
        if (!draftKey) return;
        try {
            localStorage.removeItem(DRAFT_PREFIX + draftKey);
        } catch {}
    }

    // ─── Reset ─────────────────────────────────────────

    function reset() {
        values = { ...initialValues };
        fieldErrors = {};
        clearDraft();
        renderFields();
    }

    // ─── Initial Render ────────────────────────────────

    renderFields();

    // ─── Public API ────────────────────────────────────

    return {
        getValues() {
            return { ...values };
        },

        setValues(newValues) {
            values = { ...values, ...newValues };
            renderFields();
        },

        reset,

        submit() {
            handleSubmit();
        },

        validate() {
            return validate();
        },

        destroy() {
            fieldCleanups.forEach((fn) => { try { fn(); } catch {} });
            fieldCleanups = [];
            rootCleanup();
            root.remove();
        },
    };
}
