/**
 * Generated AI UI component catalog.
 *
 * Source: src/ui/components/[component]/manifest.json
 * Do not edit manually. Run `npm run generate-ai-ui-catalog`.
 */

export const componentCatalog = {
  "badge": {
    "id": "badge",
    "owner": "core",
    "alias": "badge",
    "title": "Badge",
    "category": "CSS-Only",
    "type": "I",
    "path": "src/ui/components/badge",
    "manifestPath": "src/ui/components/badge/manifest.json",
    "preferred": true,
    "summary": "Inline labels for status, categories, and counts",
    "propsSchema": {
      "align": "string",
      "alt": "string",
      "body": "string",
      "description": "string",
      "helper": "string",
      "href": "string",
      "label": "string",
      "name": "string",
      "placeholder": "string",
      "size": "string",
      "src": "string",
      "text": "string",
      "theme": "string",
      "title": "string",
      "tone": "string",
      "value": "string",
      "variant": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "allowedChildren": [],
    "behavior": {
      "role": "node",
      "events": [
        "click"
      ],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ":root"
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": true,
      "supportsSize": true,
      "supportsTone": true
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
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<span class=\"badge\" data-variant=\"soft-primary\">Primary</span>\n<span class=\"badge\" data-variant=\"soft-success\">Success</span>\n<span class=\"badge\" data-variant=\"soft-warning\">Warning</span>\n<span class=\"badge\" data-variant=\"soft-danger\">Danger</span>\n<span class=\"badge\" data-variant=\"soft-info\">Info</span>",
    "render": {
      "kind": "element",
      "tag": "span",
      "className": "badge",
      "textProp": "label",
      "attributes": {
        "data-variant": {
          "prop": "variant"
        },
        "data-tone": {
          "prop": "tone"
        },
        "data-size": {
          "prop": "size"
        }
      },
      "template": "<span class=\"badge\" data-variant=\"soft-primary\">Primary</span>\n<span class=\"badge\" data-variant=\"soft-success\">Success</span>\n<span class=\"badge\" data-variant=\"soft-warning\">Warning</span>\n<span class=\"badge\" data-variant=\"soft-danger\">Danger</span>\n<span class=\"badge\" data-variant=\"soft-info\">Info</span>"
    }
  },
  "button": {
    "id": "button",
    "owner": "core",
    "alias": "button",
    "title": "Button",
    "category": "Interactive",
    "type": "I",
    "path": "src/ui/components/button",
    "manifestPath": "src/ui/components/button/manifest.json",
    "preferred": true,
    "summary": "Interactive button elements with variants",
    "propsSchema": {
      "align": "string",
      "alt": "string",
      "body": "string",
      "description": "string",
      "helper": "string",
      "href": "string",
      "label": "string",
      "name": "string",
      "placeholder": "string",
      "shape": "string",
      "size": "string",
      "src": "string",
      "text": "string",
      "theme": "string",
      "title": "string",
      "tone": "string",
      "value": "string",
      "variant": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "allowedChildren": [],
    "behavior": {
      "role": "node",
      "events": [
        "click"
      ],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": "button, a, :root"
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": true,
      "supportsSize": true,
      "supportsTone": true
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
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<button class=\"button\">Default</button>\n<button class=\"button\" data-variant=\"primary\">Primary</button>\n<button class=\"button\" data-variant=\"secondary\">Secondary</button>\n<button class=\"button\" data-variant=\"ghost\">Ghost</button>\n<button class=\"button\" data-variant=\"destructive\">Destructive</button>",
    "render": {
      "kind": "button",
      "tag": "button",
      "className": "button",
      "textProp": "label",
      "attributes": {
        "type": "button",
        "data-variant": {
          "prop": "variant"
        },
        "data-tone": {
          "prop": "tone"
        },
        "data-size": {
          "prop": "size"
        },
        "data-shape": {
          "prop": "shape"
        }
      },
      "template": "<button class=\"button\">Default</button>\n<button class=\"button\" data-variant=\"primary\">Primary</button>\n<button class=\"button\" data-variant=\"secondary\">Secondary</button>\n<button class=\"button\" data-variant=\"ghost\">Ghost</button>\n<button class=\"button\" data-variant=\"destructive\">Destructive</button>"
    }
  },
  "card": {
    "id": "card",
    "owner": "core",
    "alias": "card",
    "title": "Card",
    "category": "Layout",
    "type": "I",
    "path": "src/ui/components/card",
    "manifestPath": "src/ui/components/card/manifest.json",
    "preferred": true,
    "summary": "Structured surface container for grouped content and actions",
    "propsSchema": {
      "title": "string",
      "description": "string",
      "tone": "string"
    },
    "defaultSlot": "body",
    "slots": {
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
    "allowedChildren": [
      "badge",
      "button",
      "field",
      "input"
    ],
    "behavior": {
      "role": "container",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".card"
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": true
    },
    "textTargets": {
      "title": [
        ".card__title"
      ],
      "description": [
        ".card__description"
      ],
      "label": []
    },
    "dependencies": {
      "runtime": [],
      "components": [
        "button",
        "badge",
        "field",
        "input"
      ]
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<article class=\"card\"><header class=\"card__header\"><h2 class=\"card__title\">Title</h2><p class=\"card__description\">Description</p></header><div class=\"card__body\"></div><footer class=\"card__footer\"></footer></article>",
    "render": {
      "kind": "element",
      "tag": "article",
      "className": "card",
      "attributes": {
        "data-tone": {
          "prop": "tone"
        }
      },
      "children": [
        {
          "tag": "header",
          "className": "card__header",
          "children": [
            {
              "tag": "h2",
              "className": "card__title",
              "textProp": "title"
            },
            {
              "tag": "p",
              "className": "card__description",
              "textProp": "description"
            }
          ]
        },
        {
          "tag": "div",
          "className": "card__body",
          "slot": "body"
        },
        {
          "tag": "footer",
          "className": "card__footer",
          "slot": "footer"
        }
      ],
      "template": "<article class=\"card\"><header class=\"card__header\"><h2 class=\"card__title\">Title</h2><p class=\"card__description\">Description</p></header><div class=\"card__body\"></div><footer class=\"card__footer\"></footer></article>"
    }
  },
  "field": {
    "id": "field",
    "owner": "core",
    "alias": "field",
    "title": "Field",
    "category": "Forms",
    "type": "I",
    "path": "src/ui/components/field",
    "manifestPath": "src/ui/components/field/manifest.json",
    "preferred": true,
    "summary": "Accessible label and helper wrapper for a single form control",
    "propsSchema": {
      "label": "string",
      "helper": "string",
      "error": "string",
      "for": "string",
      "required": "string",
      "state": "string",
      "tone": "string"
    },
    "defaultSlot": "control",
    "slots": {
      "control": {
        "selector": ".field__control",
        "allowedChildren": [
          "input"
        ]
      }
    },
    "allowedChildren": [
      "input"
    ],
    "behavior": {
      "role": "container",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".field"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": true
    },
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
    "dependencies": {
      "runtime": [],
      "components": [
        "input"
      ]
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<div class=\"field\"><label class=\"field__label\" for=\"email\">Email</label><div class=\"field__control\"></div><p class=\"field__helper\">Helper text</p></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "field",
      "attributes": {
        "data-tone": {
          "prop": "tone"
        },
        "data-state": {
          "prop": "state"
        }
      },
      "children": [
        {
          "tag": "label",
          "className": "field__label",
          "textProp": "label",
          "attributes": {
            "for": {
              "prop": "for"
            }
          }
        },
        {
          "tag": "div",
          "className": "field__control",
          "slot": "control"
        },
        {
          "tag": "p",
          "className": "field__helper",
          "textProp": "helper"
        },
        {
          "tag": "p",
          "className": "field__error",
          "textProp": "error"
        }
      ],
      "template": "<div class=\"field\"><label class=\"field__label\" for=\"email\">Email</label><div class=\"field__control\"></div><p class=\"field__helper\">Helper text</p></div>"
    }
  },
  "input": {
    "id": "input",
    "owner": "core",
    "alias": "input",
    "title": "Input",
    "category": "Forms",
    "type": "I",
    "path": "src/ui/components/input",
    "manifestPath": "src/ui/components/input/manifest.json",
    "preferred": true,
    "summary": "Single-line text input for email, password, and similar fields",
    "propsSchema": {
      "id": "string",
      "type": "string",
      "name": "string",
      "value": "string",
      "placeholder": "string",
      "autocomplete": "string",
      "state": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "allowedChildren": [],
    "behavior": {
      "role": "field",
      "events": [
        "focus",
        "blur",
        "input",
        "change"
      ],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".input"
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": true
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": [
        ".input"
      ]
    },
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<input class=\"input\" type=\"email\" name=\"email\" placeholder=\"name@company.com\" autocomplete=\"email\" />",
    "render": {
      "kind": "element",
      "tag": "input",
      "className": "input",
      "attributes": {
        "id": {
          "prop": "id"
        },
        "type": {
          "prop": "type",
          "fallback": "text",
          "allowedValues": [
            "text",
            "email",
            "password",
            "search",
            "tel",
            "url",
            "number"
          ]
        },
        "name": {
          "prop": "name"
        },
        "value": {
          "prop": "value"
        },
        "placeholder": {
          "prop": "placeholder"
        },
        "autocomplete": {
          "prop": "autocomplete"
        },
        "data-state": {
          "prop": "state"
        }
      },
      "template": "<input class=\"input\" type=\"email\" name=\"email\" placeholder=\"name@company.com\" autocomplete=\"email\" />"
    }
  },
  "theme-toggle": {
    "id": "theme-toggle",
    "owner": "core",
    "alias": "theme-toggle",
    "title": "Theme Toggle",
    "category": "CSS-Only",
    "type": "I",
    "path": "src/ui/components/theme-toggle",
    "manifestPath": "src/ui/components/theme-toggle/manifest.json",
    "preferred": false,
    "summary": "Theme switcher trigger styled as a compact surface-aware button",
    "propsSchema": {
      "label": "string",
      "theme": "string",
      "variant": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "allowedChildren": [],
    "behavior": {
      "role": "trigger",
      "events": [
        "click"
      ],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": "[data-theme-toggle], .theme-toggle"
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "label": [
        ".theme-toggle__label"
      ]
    },
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<button class=\"theme-toggle\" type=\"button\" data-theme-toggle data-theme-active=\"light\"><span class=\"theme-toggle__icons\" aria-hidden=\"true\"><span class=\"theme-icon theme-icon--sun\">☀</span><span class=\"theme-icon theme-icon--moon\">◐</span><span class=\"theme-icon theme-icon--contrast\">◫</span></span><span class=\"theme-toggle__label\">Theme</span></button>",
    "render": {
      "kind": "button",
      "tag": "button",
      "className": "theme-toggle",
      "textProp": "label",
      "attributes": {
        "type": "button",
        "data-theme-toggle": "",
        "data-theme-active": {
          "prop": "theme",
          "fallback": "light"
        },
        "data-variant": {
          "prop": "variant"
        }
      },
      "template": "<button class=\"theme-toggle\" type=\"button\" data-theme-toggle data-theme-active=\"light\"><span class=\"theme-toggle__icons\" aria-hidden=\"true\"><span class=\"theme-icon theme-icon--sun\">☀</span><span class=\"theme-icon theme-icon--moon\">◐</span><span class=\"theme-icon theme-icon--contrast\">◫</span></span><span class=\"theme-toggle__label\">Theme</span></button>"
    }
  },
  "toast": {
    "id": "toast",
    "owner": "core",
    "alias": "toast",
    "title": "Toast",
    "category": "Interactive",
    "type": "II",
    "path": "src/ui/components/toast",
    "manifestPath": "src/ui/components/toast/manifest.json",
    "preferred": false,
    "summary": "Notification messages that auto-dismiss",
    "propsSchema": {
      "align": "string",
      "alt": "string",
      "body": "string",
      "description": "string",
      "helper": "string",
      "href": "string",
      "label": "string",
      "name": "string",
      "placeholder": "string",
      "size": "string",
      "src": "string",
      "text": "string",
      "theme": "string",
      "title": "string",
      "tone": "string",
      "value": "string",
      "variant": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": []
      }
    },
    "allowedChildren": [],
    "behavior": {
      "role": "node",
      "events": [
        "click"
      ],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ":root"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": true,
      "supportsSize": true,
      "supportsTone": true
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
    "dependencies": {
      "runtime": [
        "EventBus"
      ],
      "components": []
    },
    "contracts": {
      "published": [
        "TOAST_SHOWN"
      ],
      "subscribed": [
        "INTENT_TOAST_SHOW"
      ]
    },
    "template": "<!-- Toasts are created dynamically via EventBus -->\neventBus.publish('INTENT_TOAST_SHOW', {\n    type: 'success',\n    title: 'Deployment succeeded',\n    description: 'The runtime bootstrap completed without contract violations.',\n    duration: 2800,\n    timestamp: Date.now()\n});",
    "render": {
      "kind": "template",
      "template": "<!-- Toasts are created dynamically via EventBus -->\neventBus.publish('INTENT_TOAST_SHOW', {\n    type: 'success',\n    title: 'Deployment succeeded',\n    description: 'The runtime bootstrap completed without contract violations.',\n    duration: 2800,\n    timestamp: Date.now()\n});"
    }
  }
};

export function listComponents() {
  return Object.keys(componentCatalog);
}

export function listTypeIIComponents() {
  return Object.entries(componentCatalog)
    .filter(([, def]) => def.type === 'II')
    .map(([id]) => id);
}

export function componentsRequiring(dependency) {
  return Object.entries(componentCatalog)
    .filter(([, def]) => (def.dependencies?.runtime || []).includes(dependency))
    .map(([id]) => id);
}
