/**
 * Config Panel Archetype — CSMA Token-Driven Settings UI
 *
 * Factory: createConfigPanel(container, emit, options) → { update, destroy, getValues, setValues }
 *
 * Features:
 * - Collapsible sections of labeled controls
 * - Control types: toggle, color, slider, select, text
 * - Live onChange callback per control
 * - CSMA design tokens for all visual values
 * - Keyboard-friendly (collapsible sections)
 */

import { clearChildren, createIcon, createSvgElement } from '../../../utils/dom.js';

function createSectionArrowIcon() {
    return createIcon('0 0 12 12', [
        createSvgElement('path', { d: 'M6 3L10 8H2L6 3Z', fill: 'currentColor' })
    ], { class: 'csma-config__section-arrow' });
}

export function createConfigPanel(container, emit, options = {}) {
    const {
        sections = [],
        onChange = null,
    } = options;

    let values = {};

    // Init values from defaults
    sections.forEach((section) => {
        (section.controls || []).forEach((ctrl) => {
            values[ctrl.id] = ctrl.value;
        });
    });

    // ─── DOM ───────────────────────────────────────────

    const root = document.createElement('div');
    root.className = 'csma-config';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Configuration panel');

    // ─── Builders ──────────────────────────────────────

    function buildToggle(ctrl) {
        const row = document.createElement('label');
        row.className = 'csma-config__control csma-config__toggle';

        const labelCol = document.createElement('div');
        labelCol.className = 'csma-config__control-label';
        labelCol.textContent = ctrl.label;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!values[ctrl.id];

        const track = document.createElement('span');
        track.className = 'csma-config__toggle-track';

        const inputWrap = document.createElement('span');
        inputWrap.className = 'csma-config__control-input';
        inputWrap.appendChild(input);
        inputWrap.appendChild(track);

        input.addEventListener('change', () => {
            values[ctrl.id] = input.checked;
            if (onChange) onChange(ctrl.id, input.checked);
            if (emit) emit('config:changed', { id: ctrl.id, value: input.checked });
        });

        row.appendChild(labelCol);
        row.appendChild(inputWrap);
        return row;
    }

    function buildColor(ctrl) {
        const row = document.createElement('div');
        row.className = 'csma-config__control';

        const labelCol = document.createElement('div');
        labelCol.className = 'csma-config__control-label';
        labelCol.textContent = ctrl.label;

        const colorWrap = document.createElement('span');
        colorWrap.className = 'csma-config__color';
        // position handled by CSS

        const swatch = document.createElement('span');
        swatch.className = 'csma-config__color-swatch';
        swatch.style.backgroundColor = values[ctrl.id] || '#000000';

        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'csma-config__color-input';
        input.value = values[ctrl.id] || '#000000';
        input.setAttribute('aria-label', ctrl.label);

        const hex = document.createElement('span');
        hex.className = 'csma-config__color-hex';
        hex.textContent = values[ctrl.id] || '#000000';

        input.addEventListener('input', () => {
            values[ctrl.id] = input.value;
            swatch.style.backgroundColor = input.value;
            hex.textContent = input.value;
            if (onChange) onChange(ctrl.id, input.value);
            if (emit) emit('config:changed', { id: ctrl.id, value: input.value });
        });

        colorWrap.appendChild(input);
        colorWrap.appendChild(swatch);
        colorWrap.appendChild(hex);

        const inputWrap = document.createElement('span');
        inputWrap.className = 'csma-config__control-input';
        inputWrap.appendChild(colorWrap);

        row.appendChild(labelCol);
        row.appendChild(inputWrap);
        return row;
    }

    function buildSlider(ctrl) {
        const row = document.createElement('div');
        row.className = 'csma-config__control';

        const labelCol = document.createElement('div');
        labelCol.className = 'csma-config__control-label';
        labelCol.textContent = ctrl.label;

        const sliderWrap = document.createElement('span');
        sliderWrap.className = 'csma-config__slider';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = ctrl.min != null ? ctrl.min : 0;
        input.max = ctrl.max != null ? ctrl.max : 100;
        input.step = ctrl.step || 1;
        input.value = values[ctrl.id] != null ? values[ctrl.id] : ctrl.min || 0;
        input.setAttribute('aria-label', ctrl.label);

        const valDisplay = document.createElement('span');
        valDisplay.className = 'csma-config__slider-value';
        valDisplay.textContent = input.value;

        input.addEventListener('input', () => {
            values[ctrl.id] = input.value;
            valDisplay.textContent = input.value;
            if (onChange) onChange(ctrl.id, input.value);
            if (emit) emit('config:changed', { id: ctrl.id, value: input.value });
        });

        sliderWrap.appendChild(input);
        sliderWrap.appendChild(valDisplay);

        const inputWrap = document.createElement('span');
        inputWrap.className = 'csma-config__control-input';
        inputWrap.appendChild(sliderWrap);

        row.appendChild(labelCol);
        row.appendChild(inputWrap);
        return row;
    }

    function buildSelect(ctrl) {
        const row = document.createElement('div');
        row.className = 'csma-config__control';

        const labelCol = document.createElement('div');
        labelCol.className = 'csma-config__control-label';
        labelCol.textContent = ctrl.label;

        const select = document.createElement('select');
        select.className = 'csma-config__select';
        select.setAttribute('aria-label', ctrl.label);

        (ctrl.options || []).forEach((opt) => {
            const option = document.createElement('option');
            option.value = typeof opt === 'string' ? opt : opt.value;
            option.textContent = typeof opt === 'string' ? opt : opt.label;
            if (option.value === (values[ctrl.id] || '')) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            values[ctrl.id] = select.value;
            if (onChange) onChange(ctrl.id, select.value);
            if (emit) emit('config:changed', { id: ctrl.id, value: select.value });
        });

        const inputWrap = document.createElement('span');
        inputWrap.className = 'csma-config__control-input';
        inputWrap.appendChild(select);

        row.appendChild(labelCol);
        row.appendChild(inputWrap);
        return row;
    }

    function buildText(ctrl) {
        const row = document.createElement('div');
        row.className = 'csma-config__control';

        const labelCol = document.createElement('div');
        labelCol.className = 'csma-config__control-label';
        labelCol.textContent = ctrl.label;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'csma-config__select';
        input.value = values[ctrl.id] || '';
        input.placeholder = ctrl.placeholder || '';

        input.addEventListener('input', () => {
            values[ctrl.id] = input.value;
            if (onChange) onChange(ctrl.id, input.value);
            if (emit) emit('config:changed', { id: ctrl.id, value: input.value });
        });

        const inputWrap = document.createElement('span');
        inputWrap.className = 'csma-config__control-input';
        inputWrap.appendChild(input);

        row.appendChild(labelCol);
        row.appendChild(inputWrap);
        return row;
    }

    function buildSection(section) {
        const sec = document.createElement('div');
        sec.className = 'csma-config__section';
        sec.setAttribute('aria-expanded', section.collapsed ? 'false' : 'true');

        const header = document.createElement('div');
        header.className = 'csma-config__section-header';
        header.setAttribute('tabindex', '0');
        header.setAttribute('role', 'button');
        const headerText = document.createElement('span');
        headerText.textContent = section.label;
        header.appendChild(headerText);
        header.appendChild(createSectionArrowIcon());

        header.addEventListener('click', () => {
            const expanded = sec.getAttribute('aria-expanded') === 'true';
            sec.setAttribute('aria-expanded', String(!expanded));
        });
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                header.click();
            }
        });

        const body = document.createElement('div');
        body.className = 'csma-config__section-body';

        (section.controls || []).forEach((ctrl) => {
            let row;
            switch (ctrl.type) {
                case 'toggle':  row = buildToggle(ctrl); break;
                case 'color':   row = buildColor(ctrl); break;
                case 'slider':  row = buildSlider(ctrl); break;
                case 'select':  row = buildSelect(ctrl); break;
                case 'text':    row = buildText(ctrl); break;
                default:        row = buildToggle(ctrl); break;
            }
            body.appendChild(row);
        });

        sec.appendChild(header);
        sec.appendChild(body);
        return sec;
    }

    // ─── Render ────────────────────────────────────────

    function renderAll() {
        clearChildren(root);
        sections.forEach((section) => {
            root.appendChild(buildSection(section));
        });
    }

    // ─── Initial Render ────────────────────────────────

    container.appendChild(root);
    renderAll();

    // ─── Public API ────────────────────────────────────

    return {
        /** Get current values for all controls. */
        getValues() {
            return { ...values };
        },

        /** Set values for controls (merges). Updates DOM. */
        setValues(newValues) {
            values = { ...values, ...newValues };
            renderAll();
        },

        /** Destroy the panel. */
        destroy() {
            root.remove();
        },
    };
}
