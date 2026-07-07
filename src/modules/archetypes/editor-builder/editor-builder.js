/**
 * Editor Builder Archetype — CSMA Token-Driven Form Editor
 *
 * Factory: createEditor(container, emit, options) → { update, destroy, getValues, setValues, reset }
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

    // Restore draft if available
    if (draftKey) {
        try {
            const draft = JSON.parse(localStorage.getItem(DRAFT_PREFIX + draftKey));
            if (draft) values = { ...values, ...draft };
        } catch {}
    }

    // ─── DOM ───────────────────────────────────────────

    const root = document.createElement('div');
    root.className = 'csma-editor';
    root.setAttribute('role', 'form');
    root.setAttribute('aria-label', 'Editor');

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'csma-editor__fields';

    const actionsEl = document.createElement('div');
    actionsEl.className = 'csma-editor__actions';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'csma-editor__submit';
    submitBtn.type = 'button';
    submitBtn.textContent = submitLabel;
    submitBtn.addEventListener('click', () => handleSubmit());

    const resetBtn = document.createElement('button');
    resetBtn.className = 'csma-editor__reset';
    resetBtn.type = 'button';
    resetBtn.textContent = resetLabel;
    resetBtn.addEventListener('click', () => reset());

    const saveStatus = document.createElement('span');
    saveStatus.className = 'csma-editor__save-status';

    actionsEl.appendChild(saveStatus);
    actionsEl.appendChild(resetBtn);
    actionsEl.appendChild(submitBtn);

    root.appendChild(fieldsContainer);
    root.appendChild(actionsEl);

    // ─── Field Builders ────────────────────────────────

    function buildTextInput(field) {
        const wrap = document.createElement('div');
        wrap.className = 'csma-editor__field';

        const label = document.createElement('label');
        label.className = 'csma-editor__label' + (field.required ? ' csma-editor__label-required' : '');
        label.textContent = field.label;
        label.htmlFor = `field-${field.id}`;

        const input = document.createElement('input');
        input.className = 'csma-editor__input';
        input.id = `field-${field.id}`;
        input.type = field.type === 'email' ? 'email' :
                     field.type === 'number' ? 'number' :
                     field.type === 'password' ? 'password' : 'text';
        input.value = values[field.id] || '';
        input.placeholder = field.placeholder || '';
        if (field.required) input.required = true;
        if (field.minLength) input.minLength = field.minLength;
        if (field.maxLength) input.maxLength = field.maxLength;
        input.addEventListener('input', () => {
            values[field.id] = input.value;
            clearFieldError(field.id);
            persistDraft();
        });

        wrap.appendChild(label);
        wrap.appendChild(input);
        appendFieldMeta(wrap, field);
        return { wrap, input };
    }

    function buildTextarea(field) {
        const wrap = document.createElement('div');
        wrap.className = 'csma-editor__field';

        const label = document.createElement('label');
        label.className = 'csma-editor__label' + (field.required ? ' csma-editor__label-required' : '');
        label.textContent = field.label;
        label.htmlFor = `field-${field.id}`;

        const textarea = document.createElement('textarea');
        textarea.className = 'csma-editor__textarea';
        textarea.id = `field-${field.id}`;
        textarea.value = values[field.id] || '';
        textarea.placeholder = field.placeholder || '';
        textarea.rows = field.rows || 4;
        if (field.required) textarea.required = true;
        textarea.addEventListener('input', () => {
            values[field.id] = textarea.value;
            clearFieldError(field.id);
            persistDraft();
        });

        wrap.appendChild(label);
        wrap.appendChild(textarea);
        appendFieldMeta(wrap, field);
        return { wrap, input: textarea };
    }

    function buildSelect(field) {
        const wrap = document.createElement('div');
        wrap.className = 'csma-editor__field';

        const label = document.createElement('label');
        label.className = 'csma-editor__label' + (field.required ? ' csma-editor__label-required' : '');
        label.textContent = field.label;
        label.htmlFor = `field-${field.id}`;

        const select = document.createElement('select');
        select.className = 'csma-editor__select';
        select.id = `field-${field.id}`;
        (field.options || []).forEach((opt) => {
            const option = document.createElement('option');
            option.value = typeof opt === 'string' ? opt : opt.value;
            option.textContent = typeof opt === 'string' ? opt : opt.label;
            if (option.value === (values[field.id] || '')) option.selected = true;
            select.appendChild(option);
        });
        select.addEventListener('change', () => {
            values[field.id] = select.value;
            clearFieldError(field.id);
            persistDraft();
        });

        wrap.appendChild(label);
        wrap.appendChild(select);
        appendFieldMeta(wrap, field);
        return { wrap, input: select };
    }

    function buildToggle(field) {
        const wrap = document.createElement('div');
        wrap.className = 'csma-editor__field';

        const togg = document.createElement('label');
        togg.className = 'csma-editor__toggle';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!values[field.id];
        checkbox.addEventListener('change', () => {
            values[field.id] = checkbox.checked;
            persistDraft();
        });

        const track = document.createElement('span');
        track.className = 'csma-editor__toggle-track';

        const labelText = document.createElement('span');
        labelText.textContent = field.label;

        togg.appendChild(checkbox);
        togg.appendChild(track);
        togg.appendChild(labelText);
        wrap.appendChild(togg);
        appendFieldMeta(wrap, field);
        return { wrap, input: checkbox };
    }

    function appendFieldMeta(wrap, field) {
        const errEl = document.createElement('span');
        errEl.className = 'csma-editor__error';
        errEl.dataset.field = field.id;
        // visibility controlled by CSS
        wrap.appendChild(errEl);

        if (field.help) {
            const help = document.createElement('span');
            help.className = 'csma-editor__help';
            help.textContent = field.help;
            wrap.appendChild(help);
        }
    }

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

    const fieldRefs = {};

    function renderFields() {
        fieldsContainer.innerHTML = '';
        fieldRefs.length = 0;

        fields.forEach((field) => {
            let result;
            switch (field.type) {
                case 'textarea': case 'richtext':
                    result = buildTextarea(field); break;
                case 'select':
                    result = buildSelect(field); break;
                case 'toggle': case 'checkbox':
                    result = buildToggle(field); break;
                case 'text': case 'email': case 'number': case 'password': default:
                    result = buildTextInput(field); break;
            }
            fieldsContainer.appendChild(result.wrap);
            fieldRefs[field.id] = result.input;

            // Show existing errors
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

    container.appendChild(root);
    renderFields();

    // Keyboard submit
    root.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    });

    // ─── Public API ────────────────────────────────────

    return {
        /** Get current form values. */
        getValues() {
            return { ...values };
        },

        /** Set form values (merges with current). */
        setValues(newValues) {
            values = { ...values, ...newValues };
            renderFields();
        },

        /** Reset form to initial values. */
        reset,

        /** Programmatically submit. */
        submit() {
            handleSubmit();
        },

        /** Validate without submitting. Returns true if valid. */
        validate() {
            return validate();
        },

        /** Destroy the editor. */
        destroy() {
            root.remove();
        },
    };
}
