// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../../src/modules/archetypes/editor-builder/editor-builder.js';

// Canonical serializer (deterministic — attributes sorted by name).
function serialize(node) {
  if (node.nodeType === 3) return { '#text': node.data };
  if (node.nodeType !== 1) return null;
  const attrs = {};
  for (const a of node.attributes) attrs[a.name] = a.value;
  const sorted = {};
  for (const k of Object.keys(attrs).sort()) sorted[k] = attrs[k];
  const kids = [];
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { if (c.data.trim() || kids.length === 0) kids.push({ '#text': c.data }); }
    else if (c.nodeType === 1) kids.push(serialize(c));
  }
  return { t: node.tagName.toLowerCase(), a: sorted, c: kids.length ? kids : undefined };
}

const FIELDS = [
  { id: 'name', type: 'text', label: 'Name', required: true, placeholder: 'Enter name', minLength: 2, maxLength: 50, help: '2–50 chars' },
  { id: 'bio', type: 'textarea', label: 'Bio', rows: 3, placeholder: 'Tell us about you' },
  { id: 'role', type: 'select', label: 'Role', options: [{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }] },
    { id: 'notify', type: 'toggle', label: 'Email notifications' },
  { id: 'email', type: 'email', label: 'Email', required: true }
];

function mountEditor(overrides = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = createEditor(container, vi.fn(), {
    fields: FIELDS,
    submitLabel: 'Save',
    resetLabel: 'Reset',
    initialValues: { role: 'admin', notify: true, name: 'Alice' },
    ...overrides
  });
  return { container, editor };
}

describe('editor-builder — golden DOM (pre-Phase-3.1-C conversion)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    try { localStorage.clear(); } catch {}
  });

  it('root structure with actions bar', () => {
    const { container } = mountEditor();
    const root = container.querySelector('.csma-editor');
    expect(root.getAttribute('role')).toBe('form');
    expect(root.getAttribute('aria-label')).toBe('Editor');
    // Actions bar: save-status span, reset + submit buttons
    const actions = root.querySelector('.csma-editor__actions');
    expect(actions.querySelector('.csma-editor__save-status')).toBeTruthy();
    const resetBtn = actions.querySelector('.csma-editor__reset');
    expect(resetBtn.textContent).toBe('Reset');
    expect(resetBtn.type).toBe('button');
    const submitBtn = actions.querySelector('.csma-editor__submit');
    expect(submitBtn.textContent).toBe('Save');
    expect(submitBtn.type).toBe('button');
  });

  it('text input field with required, minlength, maxlength, help', () => {
    const { container } = mountEditor();
    const root = container.querySelector('.csma-editor');
    const nameField = root.querySelector('#field-name');
    expect(nameField.tagName).toBe('INPUT');
    expect(nameField.type).toBe('text');
    expect(nameField.required).toBe(true);
    expect(nameField.minLength).toBe(2);
    expect(nameField.maxLength).toBe(50);
    expect(nameField.value).toBe('Alice');
    expect(nameField.placeholder).toBe('Enter name');
    const label = root.querySelector('label[for="field-name"]');
    expect(label.textContent).toBe('Name');
    expect(label.className).toContain('csma-editor__label-required');
    const help = root.querySelector('.csma-editor__help');
    expect(help.textContent).toBe('2–50 chars');
    // Error slot exists (visibility by CSS)
    const error = root.querySelector('.csma-editor__error[data-field="name"]');
    expect(error).toBeTruthy();
  });

  it('textarea field with rows', () => {
    const { container } = mountEditor();
    const bio = container.querySelector('#field-bio');
    expect(bio.tagName).toBe('TEXTAREA');
    expect(bio.rows).toBe(3);
  });

  it('select field renders options with selected value', () => {
    const { container } = mountEditor();
    const select = container.querySelector('#field-role');
    expect(select.tagName).toBe('SELECT');
    const opts = select.querySelectorAll('option');
    expect(opts).toHaveLength(2);
    expect(opts[0].value).toBe('admin');
    expect(opts[0].textContent).toBe('Admin');
    expect(opts[0].selected).toBe(true);
    expect(opts[1].value).toBe('user');
    expect(opts[1].selected).toBe(false);
  });

  it('toggle field renders checkbox checked when initial value is true', () => {
    const { container } = mountEditor();
    const toggle = container.querySelector('.csma-editor__toggle');
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
    const track = toggle.querySelector('.csma-editor__toggle-track');
    expect(track).toBeTruthy();
    const label = toggle.querySelector('span:last-child');
    expect(label.textContent).toBe('Email notifications');
  });

  it('email input maps to type=email', () => {
    const { container } = mountEditor();
    const email = container.querySelector('#field-email');
    expect(email.type).toBe('email');
    expect(email.required).toBe(true);
  });

  it('canonical DOM is byte-identical before/after Phase 3.1-C conversion', () => {
    const { container } = mountEditor();
    const serialized = serialize(container.querySelector('.csma-editor'));
    // Inline snapshot auto-populated from pre-conversion DOM.
    // After conversion, this snapshot MUST still match (no updates allowed).
    expect(serialized).toMatchInlineSnapshot(`
      {
        "a": {
          "aria-label": "Editor",
          "class": "csma-editor",
          "role": "form",
        },
        "c": [
          {
            "a": {
              "class": "csma-editor__fields",
            },
            "c": [
              {
                "a": {
                  "class": "csma-editor__field",
                },
                "c": [
                  {
                    "a": {
                      "class": "csma-editor__label csma-editor__label-required",
                      "for": "field-name",
                    },
                    "c": [
                      {
                        "#text": "Name",
                      },
                    ],
                    "t": "label",
                  },
                  {
                    "a": {
                      "class": "csma-editor__input",
                      "id": "field-name",
                      "maxlength": "50",
                      "minlength": "2",
                      "placeholder": "Enter name",
                      "required": "",
                      "type": "text",
                    },
                    "c": undefined,
                    "t": "input",
                  },
                  {
                    "a": {
                      "class": "csma-editor__error",
                      "data-field": "name",
                    },
                    "c": undefined,
                    "t": "span",
                  },
                  {
                    "a": {
                      "class": "csma-editor__help",
                    },
                    "c": [
                      {
                        "#text": "2–50 chars",
                      },
                    ],
                    "t": "span",
                  },
                ],
                "t": "div",
              },
              {
                "a": {
                  "class": "csma-editor__field",
                },
                "c": [
                  {
                    "a": {
                      "class": "csma-editor__label",
                      "for": "field-bio",
                    },
                    "c": [
                      {
                        "#text": "Bio",
                      },
                    ],
                    "t": "label",
                  },
                  {
                    "a": {
                      "class": "csma-editor__textarea",
                      "id": "field-bio",
                      "placeholder": "Tell us about you",
                      "rows": "3",
                    },
                    "c": undefined,
                    "t": "textarea",
                  },
                  {
                    "a": {
                      "class": "csma-editor__error",
                      "data-field": "bio",
                    },
                    "c": undefined,
                    "t": "span",
                  },
                ],
                "t": "div",
              },
              {
                "a": {
                  "class": "csma-editor__field",
                },
                "c": [
                  {
                    "a": {
                      "class": "csma-editor__label",
                      "for": "field-role",
                    },
                    "c": [
                      {
                        "#text": "Role",
                      },
                    ],
                    "t": "label",
                  },
                  {
                    "a": {
                      "class": "csma-editor__select",
                      "id": "field-role",
                    },
                    "c": [
                      {
                        "a": {
                          "value": "admin",
                        },
                        "c": [
                          {
                            "#text": "Admin",
                          },
                        ],
                        "t": "option",
                      },
                      {
                        "a": {
                          "value": "user",
                        },
                        "c": [
                          {
                            "#text": "User",
                          },
                        ],
                        "t": "option",
                      },
                    ],
                    "t": "select",
                  },
                  {
                    "a": {
                      "class": "csma-editor__error",
                      "data-field": "role",
                    },
                    "c": undefined,
                    "t": "span",
                  },
                ],
                "t": "div",
              },
              {
                "a": {
                  "class": "csma-editor__field",
                },
                "c": [
                  {
                    "a": {
                      "class": "csma-editor__toggle",
                    },
                    "c": [
                      {
                        "a": {
                          "type": "checkbox",
                        },
                        "c": undefined,
                        "t": "input",
                      },
                      {
                        "a": {
                          "class": "csma-editor__toggle-track",
                        },
                        "c": undefined,
                        "t": "span",
                      },
                      {
                        "a": {},
                        "c": [
                          {
                            "#text": "Email notifications",
                          },
                        ],
                        "t": "span",
                      },
                    ],
                    "t": "label",
                  },
                  {
                    "a": {
                      "class": "csma-editor__error",
                      "data-field": "notify",
                    },
                    "c": undefined,
                    "t": "span",
                  },
                ],
                "t": "div",
              },
              {
                "a": {
                  "class": "csma-editor__field",
                },
                "c": [
                  {
                    "a": {
                      "class": "csma-editor__label csma-editor__label-required",
                      "for": "field-email",
                    },
                    "c": [
                      {
                        "#text": "Email",
                      },
                    ],
                    "t": "label",
                  },
                  {
                    "a": {
                      "class": "csma-editor__input",
                      "id": "field-email",
                      "placeholder": "",
                      "required": "",
                      "type": "email",
                    },
                    "c": undefined,
                    "t": "input",
                  },
                  {
                    "a": {
                      "class": "csma-editor__error",
                      "data-field": "email",
                    },
                    "c": undefined,
                    "t": "span",
                  },
                ],
                "t": "div",
              },
            ],
            "t": "div",
          },
          {
            "a": {
              "class": "csma-editor__actions",
            },
            "c": [
              {
                "a": {
                  "class": "csma-editor__save-status",
                },
                "c": undefined,
                "t": "span",
              },
              {
                "a": {
                  "class": "csma-editor__reset",
                  "type": "button",
                },
                "c": [
                  {
                    "#text": "Reset",
                  },
                ],
                "t": "button",
              },
              {
                "a": {
                  "class": "csma-editor__submit",
                  "type": "button",
                },
                "c": [
                  {
                    "#text": "Save",
                  },
                ],
                "t": "button",
              },
            ],
            "t": "div",
          },
        ],
        "t": "div",
      }
    `);
  });

  it('field error visibility toggles via data-visible + aria-invalid', () => {
    const { container, editor } = mountEditor();
    const root = container.querySelector('.csma-editor');
    // Submit empty form (name is required) → triggers validation
    editor.submit();
    const errEl = root.querySelector('.csma-editor__error[data-field="name"]');
    // Name was pre-filled with 'Alice' so it passes; email is required and empty
    const emailErr = root.querySelector('.csma-editor__error[data-field="email"]');
    expect(emailErr.dataset.visible).toBe('true');
    expect(emailErr.textContent).toContain('required');
    const emailInput = root.querySelector('#field-email');
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('editor-builder — lifecycle', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    try { localStorage.clear(); } catch {}
  });

  it('getValues returns current form state', () => {
    const { editor } = mountEditor();
    const v = editor.getValues();
    expect(v.name).toBe('Alice');
    expect(v.role).toBe('admin');
    expect(v.notify).toBe(true);
  });

  it('setValues merges + re-renders', () => {
    const { editor, container } = mountEditor();
    editor.setValues({ name: 'Bob', bio: 'Developer' });
    expect(editor.getValues().name).toBe('Bob');
    expect(editor.getValues().bio).toBe('Developer');
    const nameInput = container.querySelector('#field-name');
    expect(nameInput.value).toBe('Bob');
  });

  it('reset clears back to initial values', () => {
    const { editor, container } = mountEditor();
    editor.setValues({ name: 'Changed' });
    editor.reset();
    expect(editor.getValues().name).toBe('Alice');
    expect(container.querySelector('#field-name').value).toBe('Alice');
  });

  it('destroy removes the root element', () => {
    const { container, editor } = mountEditor();
    expect(container.querySelector('.csma-editor')).toBeTruthy();
    editor.destroy();
    expect(container.querySelector('.csma-editor')).toBeNull();
  });
});
