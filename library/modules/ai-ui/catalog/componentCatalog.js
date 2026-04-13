export const componentCatalog = {
  "badge": {
    "props": [
      "align",
      "alt",
      "body",
      "description",
      "helper",
      "href",
      "label",
      "name",
      "placeholder",
      "size",
      "src",
      "text",
      "theme",
      "title",
      "tone",
      "value",
      "variant"
    ],
    "slots": {
      "default": []
    },
    "slotDefinitions": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "requiredSlots": [],
    "componentType": "I",
    "runtimeDependencies": [],
    "render": {
      "kind": "inline",
      "template": "<span class=\"badge\" data-variant=\"soft-primary\">Primary</span>\n<span class=\"badge\" data-variant=\"soft-success\">Success</span>\n<span class=\"badge\" data-variant=\"soft-warning\">Warning</span>\n<span class=\"badge\" data-variant=\"soft-danger\">Danger</span>\n<span class=\"badge\" data-variant=\"soft-info\">Info</span>"
    },
    "activation": {},
    "textTargets": {
      "title": [
        ".card-title",
        ".navbar-title",
        ".accordion-header span",
        "h1",
        "h2",
        "h3",
        "label"
      ],
      "description": [
        ".card-description",
        ".card-text",
        ".input-helper",
        ".select-helper",
        "p"
      ],
      "label": [
        "button",
        ".button",
        ".badge",
        ".accordion-trigger span",
        ".tabs-trigger",
        ".navbar-link"
      ]
    },
    "defaultSlot": "default"
  },
  "button": {
    "props": [
      "align",
      "alt",
      "body",
      "description",
      "helper",
      "href",
      "label",
      "name",
      "placeholder",
      "shape",
      "size",
      "src",
      "text",
      "theme",
      "title",
      "tone",
      "value",
      "variant"
    ],
    "slots": {
      "default": []
    },
    "slotDefinitions": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "requiredSlots": [],
    "componentType": "I",
    "runtimeDependencies": [],
    "render": {
      "kind": "button",
      "template": "<button class=\"button\">Default</button>\n<button class=\"button\" data-variant=\"primary\">Primary</button>\n<button class=\"button\" data-variant=\"secondary\">Secondary</button>\n<button class=\"button\" data-variant=\"ghost\">Ghost</button>\n<button class=\"button\" data-variant=\"destructive\">Destructive</button>"
    },
    "activation": {},
    "textTargets": {
      "title": [
        ".card-title",
        ".navbar-title",
        ".accordion-header span",
        "h1",
        "h2",
        "h3",
        "label"
      ],
      "description": [
        ".card-description",
        ".card-text",
        ".input-helper",
        ".select-helper",
        "p"
      ],
      "label": [
        "button",
        ".button",
        ".badge",
        ".accordion-trigger span",
        ".tabs-trigger",
        ".navbar-link"
      ]
    },
    "defaultSlot": "default"
  },
  "card": {
    "props": [
      "title",
      "description",
      "tone"
    ],
    "slots": {
      "body": [
        "badge",
        "button",
        "field",
        "input"
      ],
      "footer": [
        "button",
        "badge"
      ]
    },
    "slotDefinitions": {
      "body": {
        "selector": ".card__body",
        "allowedChildren": [
          "badge",
          "button",
          "field",
          "input"
        ]
      },
      "footer": {
        "selector": ".card__footer",
        "allowedChildren": [
          "button",
          "badge"
        ]
      }
    },
    "requiredSlots": [
      "body"
    ],
    "componentType": "I",
    "runtimeDependencies": [],
    "render": {
      "kind": "element",
      "template": "<article class=\"card\"><header class=\"card__header\"><h2 class=\"card__title\">Title</h2><p class=\"card__description\">Description</p></header><div class=\"card__body\"></div><footer class=\"card__footer\"></footer></article>"
    },
    "activation": {},
    "textTargets": {
      "title": [
        ".card__title"
      ],
      "description": [
        ".card__description"
      ],
      "label": []
    },
    "defaultSlot": "body"
  },
  "field": {
    "props": [
      "label",
      "helper",
      "error",
      "for",
      "required"
    ],
    "slots": {
      "control": [
        "input"
      ]
    },
    "slotDefinitions": {
      "control": {
        "selector": ".field__control",
        "allowedChildren": [
          "input"
        ]
      }
    },
    "requiredSlots": [
      "control"
    ],
    "componentType": "I",
    "runtimeDependencies": [],
    "render": {
      "kind": "element",
      "template": "<div class=\"field\"><label class=\"field__label\" for=\"email\">Email</label><div class=\"field__control\"></div><p class=\"field__helper\">Helper text</p></div>"
    },
    "activation": {},
    "textTargets": {
      "title": [],
      "description": [
        ".field__helper",
        ".field__error"
      ],
      "label": [
        ".field__label"
      ]
    },
    "defaultSlot": "control"
  },
  "input": {
    "props": [
      "id",
      "type",
      "name",
      "value",
      "placeholder",
      "autocomplete",
      "state"
    ],
    "slots": {
      "default": []
    },
    "slotDefinitions": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "requiredSlots": [],
    "componentType": "I",
    "runtimeDependencies": [],
    "render": {
      "kind": "element",
      "template": "<input class=\"input\" type=\"email\" name=\"email\" placeholder=\"name@company.com\" autocomplete=\"email\" />"
    },
    "activation": {},
    "textTargets": {
      "title": [],
      "description": [],
      "label": [
        ".input"
      ]
    },
    "defaultSlot": "default"
  },
  "theme-toggle": {
    "props": [
      "label",
      "theme",
      "variant"
    ],
    "slots": {
      "default": []
    },
    "slotDefinitions": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "requiredSlots": [],
    "componentType": "I",
    "runtimeDependencies": [],
    "render": {
      "kind": "button",
      "template": "<button class=\"theme-toggle\" type=\"button\" data-theme-toggle data-theme-active=\"light\"><span class=\"theme-toggle__icons\" aria-hidden=\"true\"><span class=\"theme-icon theme-icon--sun\">☀</span><span class=\"theme-icon theme-icon--moon\">◐</span><span class=\"theme-icon theme-icon--contrast\">◫</span></span><span class=\"theme-toggle__label\">Theme</span></button>"
    },
    "activation": {},
    "textTargets": {
      "label": [
        ".theme-toggle__label"
      ]
    },
    "defaultSlot": "default"
  },
  "toast": {
    "props": [
      "align",
      "alt",
      "body",
      "description",
      "helper",
      "href",
      "label",
      "name",
      "placeholder",
      "size",
      "src",
      "text",
      "theme",
      "title",
      "tone",
      "value",
      "variant"
    ],
    "slots": {
      "default": []
    },
    "slotDefinitions": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "requiredSlots": [],
    "componentType": "II",
    "runtimeDependencies": [
      "EventBus"
    ],
    "render": {
      "kind": "template",
      "template": "<!-- Toasts are created dynamically via EventBus -->\neventBus.publish('INTENT_TOAST_SHOW', {\n    type: 'success',\n    title: 'Deployment succeeded',\n    description: 'The runtime bootstrap completed without contract violations.',\n    duration: 2800,\n    timestamp: Date.now()\n});"
    },
    "activation": {
      "strategy": "client-only-fallback",
      "placeholderTag": "div",
      "placeholderClass": "toast-boundary",
      "placeholderText": "Notifications activate after the page runtime starts."
    },
    "textTargets": {
      "title": [
        ".card-title",
        ".navbar-title",
        ".accordion-header span",
        "h1",
        "h2",
        "h3",
        "label"
      ],
      "description": [
        ".card-description",
        ".card-text",
        ".input-helper",
        ".select-helper",
        "p"
      ],
      "label": [
        "button",
        ".button",
        ".badge",
        ".accordion-trigger span",
        ".tabs-trigger",
        ".navbar-link"
      ]
    },
    "defaultSlot": "default"
  }
};
