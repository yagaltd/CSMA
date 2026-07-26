/**
 * Config Panel Archetype — CSMA Token-Driven Settings UI
 *
 * Factory: createConfigPanel(container, emit, options) → { update, destroy, getValues, setValues }
 *
 * Phase 3.1 — aiui-native (Option a: factory-wrapping). All DOM construction
 * routes through `getComposer().mountTree(spec, target)`; no raw
 * `document.createElement` in archetype internals. Events are wired on the
 * mounted DOM (see the Layer 2 archetype pattern in docs/architecture/SKILL.md).
 *
 * Features:
 * - Collapsible sections of labeled controls
 * - Control types: toggle, color, slider, select, text
 * - Live onChange callback per control
 * - CSMA design tokens for all visual values
 * - Keyboard-friendly (collapsible sections)
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { clearChildren } from '../../../utils/dom.js';

// ─── SVG icon (composed through mountTree like all other DOM) ────────

function sectionArrowSpec() {
    return spec('svg', {
        attrs: {
            viewBox: '0 0 12 12',
            fill: 'none',
            'aria-hidden': 'true',
            focusable: 'false',
            class: 'csma-config__section-arrow'
        },
        children: [spec('path', { attrs: { d: 'M6 3L10 8H2L6 3Z', fill: 'currentColor' } })]
    });
}

// ─── Spec builders (pure; return spec nodes) ─────────────────────────

function buildToggleSpec(ctrl, value) {
    return spec('label', {
        className: 'csma-config__control csma-config__toggle',
        children: [
            spec('div', { className: 'csma-config__control-label', text: ctrl.label }),
            spec('span', {
                className: 'csma-config__control-input',
                children: [
                    // `checked` is a property, not an attribute — set post-mount
                    // in wireControl to match pre-conversion behavior.
                    spec('input', { attrs: { type: 'checkbox' } }),
                    spec('span', { className: 'csma-config__toggle-track' })
                ]
            })
        ]
    });
}

function buildColorSpec(ctrl, value) {
    const currentColor = value || '#000000';
    return spec('div', {
        className: 'csma-config__control',
        children: [
            spec('div', { className: 'csma-config__control-label', text: ctrl.label }),
            spec('span', {
                className: 'csma-config__control-input',
                children: [
                    spec('span', {
                        className: 'csma-config__color',
                        children: [
                            spec('input', {
                                className: 'csma-config__color-input',
                                attrs: { type: 'color', value: currentColor, 'aria-label': ctrl.label }
                            }),
                            spec('span', {
                                className: 'csma-config__color-swatch',
                                dataset: { color: currentColor }
                            }),
                            spec('span', {
                                className: 'csma-config__color-hex',
                                text: currentColor
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

function buildSliderSpec(ctrl, value) {
    const min = ctrl.min != null ? ctrl.min : 0;
    const max = ctrl.max != null ? ctrl.max : 100;
    const step = ctrl.step || 1;
    const current = value != null ? value : min;
    return spec('div', {
        className: 'csma-config__control',
        children: [
            spec('div', { className: 'csma-config__control-label', text: ctrl.label }),
            spec('span', {
                className: 'csma-config__control-input',
                children: [
                    spec('span', {
                        className: 'csma-config__slider',
                        children: [
                            spec('input', {
                                attrs: {
                                    type: 'range',
                                    min: String(min),
                                    max: String(max),
                                    step: String(step),
                                    value: String(current),
                                    'aria-label': ctrl.label
                                }
                            }),
                            spec('span', {
                                className: 'csma-config__slider-value',
                                text: String(current)
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

function buildSelectSpec(ctrl, value) {
    const options = (ctrl.options || []).map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        // NOTE: `selected` is set post-mount in wireControl (SAFE_ATTRIBUTES
        // doesn't include it; we don't extend the foundation for one attribute).
        return spec('option', { attrs: { value: optValue }, text: optLabel });
    });
    return spec('div', {
        className: 'csma-config__control',
        children: [
            spec('div', { className: 'csma-config__control-label', text: ctrl.label }),
            spec('span', {
                className: 'csma-config__control-input',
                children: [
                    spec('select', {
                        className: 'csma-config__select',
                        attrs: { 'aria-label': ctrl.label },
                        children: options
                    })
                ]
            })
        ]
    });
}

function buildTextSpec(ctrl, value) {
    const attrs = { type: 'text' };
    if (ctrl.placeholder) attrs.placeholder = ctrl.placeholder;
    if (value != null) attrs.value = String(value);
    return spec('div', {
        className: 'csma-config__control',
        children: [
            spec('div', { className: 'csma-config__control-label', text: ctrl.label }),
            spec('span', {
                className: 'csma-config__control-input',
                children: [spec('input', { className: 'csma-config__select', attrs })]
            })
        ]
    });
}

function buildControlSpec(ctrl, values) {
    const value = values[ctrl.id];
    switch (ctrl.type) {
        case 'toggle':  return buildToggleSpec(ctrl, value);
        case 'color':   return buildColorSpec(ctrl, value);
        case 'slider':  return buildSliderSpec(ctrl, value);
        case 'select':  return buildSelectSpec(ctrl, value);
        case 'text':    return buildTextSpec(ctrl, value);
        default:        return buildToggleSpec(ctrl, value);
    }
}

function buildSectionSpec(section, values) {
    const controls = (section.controls || []).map((ctrl) => buildControlSpec(ctrl, values));
    return spec('div', {
        className: 'csma-config__section',
        attrs: {
            'aria-expanded': section.collapsed ? 'false' : 'true'
        },
        children: [
            spec('div', {
                className: 'csma-config__section-header',
                attrs: { tabindex: '0', role: 'button' },
                children: [
                    spec('span', { text: section.label }),
                    sectionArrowSpec()
                ]
            }),
            spec('div', {
                className: 'csma-config__section-body',
                children: controls
            })
        ]
    });
}

export function createConfigPanel(container, emit, options = {}) {
    const {
        sections = [],
        onChange = null,
    } = options;

    const composer = getComposer();

    let values = {};
    sections.forEach((section) => {
        (section.controls || []).forEach((ctrl) => {
            values[ctrl.id] = ctrl.value;
        });
    });

    // ─── Wire events on a freshly-mounted section subtree ────────────

    function wireSection(secEl, section) {
        const header = secEl.querySelector('.csma-config__section-header');
        if (header) {
            header.addEventListener('click', () => {
                const expanded = secEl.getAttribute('aria-expanded') === 'true';
                secEl.setAttribute('aria-expanded', String(!expanded));
            });
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    header.click();
                }
            });
        }

        (section.controls || []).forEach((ctrl) => {
            wireControl(secEl, ctrl);
        });
    }

    function wireControl(secEl, ctrl) {
        // Find the control row by matching label text (deterministic)
        const rows = secEl.querySelectorAll('.csma-config__control');
        const row = Array.from(rows).find((r) => {
            const label = r.querySelector('.csma-config__control-label');
            return label && label.textContent === ctrl.label;
        });
        if (!row) return;

        switch (ctrl.type) {
            case 'toggle': {
                const input = row.querySelector('input[type="checkbox"]');
                if (input) {
                    // Sync checked state post-mount (spec only allowed dataset; not 'checked' attr for security)
                    input.checked = !!values[ctrl.id];
                    input.addEventListener('change', () => {
                        values[ctrl.id] = input.checked;
                        if (onChange) onChange(ctrl.id, input.checked);
                        if (emit) emit('config:changed', { id: ctrl.id, value: input.checked });
                    });
                }
                break;
            }
            case 'color': {
                const input = row.querySelector('input[type="color"]');
                const swatch = row.querySelector('.csma-config__color-swatch');
                const hex = row.querySelector('.csma-config__color-hex');
                if (input) {
                    input.addEventListener('input', () => {
                        values[ctrl.id] = input.value;
                        if (swatch) swatch.style.backgroundColor = input.value;
                        if (hex) hex.textContent = input.value;
                        if (onChange) onChange(ctrl.id, input.value);
                        if (emit) emit('config:changed', { id: ctrl.id, value: input.value });
                    });
                }
                // Sync initial swatch bg post-mount (inline style; allowed on mounted DOM)
                if (swatch) swatch.style.backgroundColor = values[ctrl.id] || '#000000';
                break;
            }
            case 'slider': {
                const input = row.querySelector('input[type="range"]');
                const display = row.querySelector('.csma-config__slider-value');
                if (input) {
                    input.addEventListener('input', () => {
                        values[ctrl.id] = input.value;
                        if (display) display.textContent = input.value;
                        if (onChange) onChange(ctrl.id, input.value);
                        if (emit) emit('config:changed', { id: ctrl.id, value: input.value });
                    });
                }
                break;
            }
            case 'select': {
                const select = row.querySelector('select');
                if (select) {
                    // Sync selected option post-mount (SAFE_ATTRIBUTES doesn't
                    // include `selected`; we don't extend the foundation).
                    const target = values[ctrl.id] || '';
                    for (const opt of select.options) {
                        opt.selected = opt.value === target;
                    }
                    select.addEventListener('change', () => {
                        values[ctrl.id] = select.value;
                        if (onChange) onChange(ctrl.id, select.value);
                        if (emit) emit('config:changed', { id: ctrl.id, value: select.value });
                    });
                }
                break;
            }
            case 'text':
            default: {
                const input = row.querySelector('input[type="text"]');
                if (input) {
                    input.addEventListener('input', () => {
                        values[ctrl.id] = input.value;
                        if (onChange) onChange(ctrl.id, input.value);
                        if (emit) emit('config:changed', { id: ctrl.id, value: input.value });
                    });
                }
                break;
            }
        }
    }

    // ─── Root mount (static shell; sections mount into a slot) ────────

    const { root, cleanup } = composer.mountTree(spec('div', {
        className: 'csma-config',
        attrs: { role: 'region', 'aria-label': 'Configuration panel' }
    }), container);

    function renderAll() {
        clearChildren(root);
        sections.forEach((section) => {
            const { root: secEl } = composer.mountTree(buildSectionSpec(section, values));
            wireSection(secEl, section);
            root.appendChild(secEl);
        });
    }

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
            cleanup();
        },
    };
}
