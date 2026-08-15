/**
 * Generated AI UI component catalog.
 *
 * Sources:
 *   - src/ui/components/[component]/manifest.json      (UI primitives)
 *   - src/modules/[module]/aiui/*.json                 (module surfaces)
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
    "moduleId": null,
    "surfaceId": "badge",
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
    "moduleId": null,
    "surfaceId": "button",
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
    "moduleId": null,
    "surfaceId": "card",
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
  "chart-display": {
    "id": "chart-display",
    "owner": "charts",
    "alias": "chart-display",
    "title": "Chart Display",
    "category": "Module Surface",
    "type": "II",
    "moduleId": "charts",
    "surfaceId": "chart-display",
    "path": "src/modules/charts/aiui",
    "manifestPath": "src/modules/charts/aiui/manifest.json",
    "preferred": false,
    "summary": "Mountable chart that delegates rendering to ChartsService.mountSurface",
    "propsSchema": {
      "adapterId": "string",
      "data": "object",
      "options": "object"
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
      "role": "module-surface",
      "events": [],
      "targetActions": [],
      "intentMap": {}
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {},
    "dependencies": {
      "runtime": [
        "charts"
      ],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "render": {
      "kind": "module",
      "tag": "div",
      "className": "aiui-surface aiui-surface--chart-display"
    }
  },
  "code-editor": {
    "id": "code-editor",
    "owner": "core",
    "alias": "code-editor",
    "title": "Code Editor",
    "category": "Forms",
    "type": "I",
    "moduleId": null,
    "surfaceId": "code-editor",
    "path": "src/ui/components/code-editor",
    "manifestPath": "src/ui/components/code-editor/manifest.json",
    "preferred": true,
    "summary": "Monospace textarea for editing configuration files like TOML or JSON",
    "propsSchema": {
      "value": "string",
      "placeholder": "string",
      "rows": "string",
      "name": "string"
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
      "role": "input",
      "events": [
        "input",
        "change"
      ],
      "targetActions": [],
      "intentMap": {
        "change": "settings:save-config"
      },
      "fieldValue": "value",
      "eventTargetSelector": ".code-editor"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": []
    },
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<textarea class=\"code-editor\" rows=\"20\" placeholder=\"[shell]\\ntheme = \\\"dark\\\"\\n\"></textarea>",
    "render": {
      "kind": "element",
      "tag": "textarea",
      "className": "code-editor",
      "attributes": {
        "rows": {
          "prop": "rows",
          "fallback": "20"
        },
        "placeholder": {
          "prop": "placeholder"
        },
        "name": {
          "prop": "name"
        }
      },
      "textProp": "value",
      "template": "<textarea class=\"code-editor\" rows=\"20\"></textarea>"
    }
  },
  "color-token-list": {
    "id": "color-token-list",
    "owner": "core",
    "alias": "color-token-list",
    "title": "Color Token List",
    "category": "Forms",
    "type": "I",
    "moduleId": null,
    "surfaceId": "color-token-list",
    "path": "src/ui/components/color-token-list",
    "manifestPath": "src/ui/components/color-token-list/manifest.json",
    "preferred": true,
    "summary": "Editable list of color tokens with name, swatch preview, and hex value",
    "propsSchema": {},
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": [
          "swatch"
        ]
      }
    },
    "allowedChildren": [
      "swatch"
    ],
    "behavior": {
      "role": "container",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".color-token-list"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": [
        ".color-token-list__name"
      ]
    },
    "dependencies": {
      "runtime": [],
      "components": [
        "swatch"
      ]
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<div class=\"color-token-list\"><div class=\"color-token-list__row\"><span class=\"color-token-list__name\">background</span><div class=\"color-token-list__swatch\"></div><span class=\"color-token-list__value\">#0e0e12</span></div></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "color-token-list",
      "attributes": {},
      "children": [],
      "template": "<div class=\"color-token-list\"></div>"
    }
  },
  "comments-thread": {
    "id": "comments-thread",
    "owner": "comments",
    "alias": "comments-thread",
    "title": "Comments Thread",
    "category": "Module Surface",
    "type": "II",
    "moduleId": "comments",
    "surfaceId": "comments-thread",
    "path": "src/modules/comments/aiui",
    "manifestPath": "src/modules/comments/aiui/manifest.json",
    "preferred": false,
    "summary": "Mountable comments thread that delegates rendering to CommentsService.mountSurface",
    "propsSchema": {
      "threadId": "string",
      "focusCommentId": "string"
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
      "role": "module-surface",
      "events": [],
      "targetActions": [],
      "intentMap": {}
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {},
    "dependencies": {
      "runtime": [
        "comments"
      ],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "render": {
      "kind": "module",
      "tag": "div",
      "className": "aiui-surface aiui-surface--comments-thread"
    }
  },
  "count-up": {
    "id": "count-up",
    "owner": "core",
    "alias": "count-up",
    "title": "Count Up",
    "category": "motion",
    "type": "II",
    "moduleId": null,
    "surfaceId": "count-up",
    "path": "src/ui/components/count-up",
    "manifestPath": "src/ui/components/count-up/manifest.json",
    "preferred": true,
    "summary": "Animated number counter that counts from 0 to a target value on viewport entry. Respects prefers-reduced-motion.",
    "propsSchema": {
      "figure": {
        "type": "object",
        "required": true
      },
      "durationMs": {
        "type": "number"
      },
      "startOnEnter": {
        "type": "boolean"
      }
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
      "role": "display",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".count-up-target"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": []
    },
    "dependencies": {
      "runtime": [
        "EventBus"
      ],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<span class=\"count-up-target\" data-count-up>0</span>",
    "render": {
      "kind": "element",
      "tag": "span",
      "className": "count-up-target",
      "attributes": {},
      "children": [],
      "template": "<span class=\"count-up-target\" data-count-up>0</span>"
    }
  },
  "field": {
    "id": "field",
    "owner": "core",
    "alias": "field",
    "title": "Field",
    "category": "Forms",
    "type": "I",
    "moduleId": null,
    "surfaceId": "field",
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
    "moduleId": null,
    "surfaceId": "input",
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
  "radio-group": {
    "id": "radio-group",
    "owner": "core",
    "alias": "radio-group",
    "title": "Radio Group",
    "category": "Forms",
    "type": "I",
    "moduleId": null,
    "surfaceId": "radio-group",
    "path": "src/ui/components/radio-group",
    "manifestPath": "src/ui/components/radio-group/manifest.json",
    "preferred": true,
    "summary": "Mutually exclusive option selector rendered as a grid of cards or radio inputs",
    "propsSchema": {
      "label": "string",
      "name": "string",
      "value": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": [
          "radio-option",
          "toggle-card"
        ]
      }
    },
    "allowedChildren": [
      "radio-option",
      "toggle-card"
    ],
    "behavior": {
      "role": "container",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".radio-group"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [
        ".radio-group__label"
      ],
      "description": [],
      "label": [
        ".radio-group__label"
      ]
    },
    "dependencies": {
      "runtime": [],
      "components": [
        "radio-option"
      ]
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<div class=\"radio-group\" role=\"radiogroup\"></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "radio-group",
      "attributes": {
        "role": "radiogroup",
        "data-group": {
          "prop": "name"
        }
      },
      "children": [
        {
          "tag": "span",
          "className": "radio-group__label",
          "textProp": "label"
        }
      ],
      "template": "<div class=\"radio-group\" role=\"radiogroup\"><span class=\"radio-group__label\">Options</span></div>"
    }
  },
  "radio-option": {
    "id": "radio-option",
    "owner": "core",
    "alias": "radio-option",
    "title": "Radio Option",
    "category": "Forms",
    "type": "I",
    "moduleId": null,
    "surfaceId": "radio-option",
    "path": "src/ui/components/radio-option",
    "manifestPath": "src/ui/components/radio-option/manifest.json",
    "preferred": true,
    "summary": "Single radio input paired with a label",
    "propsSchema": {
      "label": "string",
      "value": "string",
      "name": "string",
      "checked": "string",
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
      "role": "option",
      "events": [
        "click"
      ],
      "targetActions": [],
      "intentMap": {
        "click": "settings:select"
      },
      "fieldValue": null,
      "eventTargetSelector": ".radio-option"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": [
        ".radio-option__label"
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
    "template": "<label class=\"radio-option\"><input type=\"radio\" name=\"group\" value=\"opt1\" /><span class=\"radio-option__label\">Option 1</span></label>",
    "render": {
      "kind": "element",
      "tag": "label",
      "className": "radio-option",
      "attributes": {
        "data-state": {
          "prop": "state"
        }
      },
      "children": [
        {
          "tag": "input",
          "className": "radio-option__input",
          "attributes": {
            "type": "radio",
            "name": {
              "prop": "name"
            },
            "value": {
              "prop": "value"
            },
            "checked": {
              "prop": "checked"
            }
          }
        },
        {
          "tag": "span",
          "className": "radio-option__label",
          "textProp": "label"
        }
      ],
      "template": "<label class=\"radio-option\"><input type=\"radio\" name=\"group\" value=\"opt1\" /><span class=\"radio-option__label\">Option 1</span></label>"
    }
  },
  "section-header": {
    "id": "section-header",
    "owner": "core",
    "alias": "section-header",
    "title": "Section Header",
    "category": "Layout",
    "type": "I",
    "moduleId": null,
    "surfaceId": "section-header",
    "path": "src/ui/components/section-header",
    "manifestPath": "src/ui/components/section-header/manifest.json",
    "preferred": true,
    "summary": "Section title with a muted description line for settings panels",
    "propsSchema": {
      "title": "string",
      "description": "string"
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
      "role": "container",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".section-header"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [
        ".section-header__title"
      ],
      "description": [
        ".section-header__desc"
      ],
      "label": []
    },
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<header class=\"section-header\"><h2 class=\"section-header__title\">Theme</h2><p class=\"section-header__desc\">Appearance & color scheme</p></header>",
    "render": {
      "kind": "element",
      "tag": "header",
      "className": "section-header",
      "attributes": {},
      "children": [
        {
          "tag": "h2",
          "className": "section-header__title",
          "textProp": "title"
        },
        {
          "tag": "p",
          "className": "section-header__desc",
          "textProp": "description"
        }
      ],
      "template": "<header class=\"section-header\"><h2 class=\"section-header__title\">Theme</h2><p class=\"section-header__desc\">Appearance</p></header>"
    }
  },
  "shortcut-list": {
    "id": "shortcut-list",
    "owner": "core",
    "alias": "shortcut-list",
    "title": "Shortcut List",
    "category": "Layout",
    "type": "I",
    "moduleId": null,
    "surfaceId": "shortcut-list",
    "path": "src/ui/components/shortcut-list",
    "manifestPath": "src/ui/components/shortcut-list/manifest.json",
    "preferred": true,
    "summary": "Container for keyboard shortcut reference entries",
    "propsSchema": {},
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": [
          "shortcut-row"
        ]
      }
    },
    "allowedChildren": [
      "shortcut-row"
    ],
    "behavior": {
      "role": "container",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".shortcut-list"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": []
    },
    "dependencies": {
      "runtime": [],
      "components": [
        "shortcut-row"
      ]
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<div class=\"shortcut-list\"></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "shortcut-list",
      "attributes": {},
      "children": [],
      "template": "<div class=\"shortcut-list\"></div>"
    }
  },
  "shortcut-row": {
    "id": "shortcut-row",
    "owner": "core",
    "alias": "shortcut-row",
    "title": "Shortcut Row",
    "category": "Layout",
    "type": "I",
    "moduleId": null,
    "surfaceId": "shortcut-row",
    "path": "src/ui/components/shortcut-row",
    "manifestPath": "src/ui/components/shortcut-row/manifest.json",
    "preferred": true,
    "summary": "One keyboard shortcut entry with key binding and description",
    "propsSchema": {
      "key": "string",
      "description": "string"
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
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".shortcut-row"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [
        ".shortcut-row__key"
      ],
      "description": [
        ".shortcut-row__desc"
      ],
      "label": [
        ".shortcut-row__key"
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
    "template": "<div class=\"shortcut-row\"><span class=\"shortcut-row__key\">Shift+A</span><span class=\"shortcut-row__desc\">Swap theme</span></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "shortcut-row",
      "attributes": {},
      "children": [
        {
          "tag": "span",
          "className": "shortcut-row__key",
          "textProp": "key"
        },
        {
          "tag": "span",
          "className": "shortcut-row__desc",
          "textProp": "description"
        }
      ],
      "template": "<div class=\"shortcut-row\"><span class=\"shortcut-row__key\">Shift+A</span><span class=\"shortcut-row__desc\">Swap theme</span></div>"
    }
  },
  "slider": {
    "id": "slider",
    "owner": "core",
    "alias": "slider",
    "title": "Slider",
    "category": "Forms",
    "type": "I",
    "moduleId": null,
    "surfaceId": "slider",
    "path": "src/ui/components/slider",
    "manifestPath": "src/ui/components/slider/manifest.json",
    "preferred": true,
    "summary": "Range input paired with a label and numeric value readout",
    "propsSchema": {
      "label": "string",
      "value": "string",
      "min": "string",
      "max": "string",
      "step": "string",
      "name": "string"
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
      "role": "input",
      "events": [
        "input",
        "change"
      ],
      "targetActions": [],
      "intentMap": {
        "input": "settings:slider"
      },
      "fieldValue": "value",
      "eventTargetSelector": ".slider__input"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [
        ".slider__label"
      ],
      "description": [],
      "label": [
        ".slider__label"
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
    "template": "<div class=\"slider\"><label class=\"slider__label\">Gap</label><input type=\"range\" class=\"slider__input\" min=\"0\" max=\"12\" value=\"4\" /><span class=\"slider__value\">4px</span></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "slider",
      "attributes": {},
      "children": [
        {
          "tag": "label",
          "className": "slider__label",
          "textProp": "label"
        },
        {
          "tag": "input",
          "className": "slider__input",
          "attributes": {
            "type": "range",
            "min": {
              "prop": "min"
            },
            "max": {
              "prop": "max"
            },
            "step": {
              "prop": "step"
            },
            "value": {
              "prop": "value"
            },
            "name": {
              "prop": "name"
            }
          }
        },
        {
          "tag": "span",
          "className": "slider__value",
          "textProp": "value"
        }
      ],
      "template": "<div class=\"slider\"><label class=\"slider__label\">Gap</label><input type=\"range\" class=\"slider__input\" min=\"0\" max=\"12\" value=\"4\" /><span class=\"slider__value\">4px</span></div>"
    }
  },
  "swatch": {
    "id": "swatch",
    "owner": "core",
    "alias": "swatch",
    "title": "Swatch",
    "category": "Visual",
    "type": "I",
    "moduleId": null,
    "surfaceId": "swatch",
    "path": "src/ui/components/swatch",
    "manifestPath": "src/ui/components/swatch/manifest.json",
    "preferred": true,
    "summary": "Color preview block for theme and color palette display",
    "propsSchema": {
      "name": "string",
      "variant": "string",
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
      "role": "node",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".swatch"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": true,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": []
    },
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<div class=\"swatch\" data-variant=\"dark\"></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "swatch",
      "attributes": {
        "data-variant": {
          "prop": "variant"
        },
        "data-state": {
          "prop": "state"
        }
      },
      "children": [],
      "template": "<div class=\"swatch\" data-variant=\"dark\"></div>"
    }
  },
  "theme-toggle": {
    "id": "theme-toggle",
    "owner": "core",
    "alias": "theme-toggle",
    "title": "Theme Toggle",
    "category": "CSS-Only",
    "type": "I",
    "moduleId": null,
    "surfaceId": "theme-toggle",
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
  "tilt-card": {
    "id": "tilt-card",
    "owner": "core",
    "alias": "tilt-card",
    "title": "Tilt Card",
    "category": "motion",
    "type": "I",
    "moduleId": null,
    "surfaceId": "tilt-card",
    "path": "src/ui/components/tilt-card",
    "manifestPath": "src/ui/components/tilt-card/manifest.json",
    "preferred": true,
    "summary": "Perspective tilt on hover. JS sets CSS custom properties (--tilt-x, --tilt-y); CSS applies the transform.",
    "propsSchema": {
      "maxDegrees": {
        "type": "number",
        "default": 6
      }
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
      "role": "interactive",
      "events": [
        "pointerenter",
        "pointermove",
        "pointerleave"
      ],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".tilt-card"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [
        ".tilt-card__title"
      ],
      "description": [
        ".tilt-card__description"
      ],
      "label": []
    },
    "dependencies": {
      "runtime": [],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<div class=\"tilt-card\" data-tilt></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "tilt-card",
      "attributes": {},
      "children": [],
      "template": "<div class=\"tilt-card\"></div>"
    }
  },
  "toast": {
    "id": "toast",
    "owner": "core",
    "alias": "toast",
    "title": "Toast",
    "category": "Interactive",
    "type": "II",
    "moduleId": null,
    "surfaceId": "toast",
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
  },
  "toggle-card": {
    "id": "toggle-card",
    "owner": "core",
    "alias": "toggle-card",
    "title": "Toggle Card",
    "category": "Interactive",
    "type": "I",
    "moduleId": null,
    "surfaceId": "toggle-card",
    "path": "src/ui/components/toggle-card",
    "manifestPath": "src/ui/components/toggle-card/manifest.json",
    "preferred": true,
    "summary": "Card-style button that can be selected/deselected, with an optional preview slot",
    "propsSchema": {
      "label": "string",
      "group": "string",
      "value": "string",
      "state": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": [
          "swatch"
        ]
      }
    },
    "allowedChildren": [
      "swatch"
    ],
    "behavior": {
      "role": "trigger",
      "events": [
        "click"
      ],
      "targetActions": [],
      "intentMap": {
        "click": "settings:select"
      },
      "fieldValue": null,
      "eventTargetSelector": ".toggle-card"
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": [
        ".toggle-card__label"
      ]
    },
    "dependencies": {
      "runtime": [],
      "components": [
        "swatch"
      ]
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<button class=\"toggle-card\" data-state=\"inactive\"><span class=\"toggle-card__label\">Option</span></button>",
    "render": {
      "kind": "button",
      "tag": "button",
      "className": "toggle-card",
      "attributes": {
        "type": "button",
        "data-state": {
          "prop": "state",
          "fallback": "inactive"
        },
        "data-group": {
          "prop": "group"
        }
      },
      "children": [
        {
          "tag": "div",
          "className": "toggle-card__preview",
          "slot": "default"
        },
        {
          "tag": "span",
          "className": "toggle-card__label",
          "textProp": "label"
        }
      ],
      "template": "<button class=\"toggle-card\" data-state=\"inactive\"><div class=\"toggle-card__preview\"></div><span class=\"toggle-card__label\">Option</span></button>"
    }
  },
  "toggle-grid": {
    "id": "toggle-grid",
    "owner": "core",
    "alias": "toggle-grid",
    "title": "Toggle Grid",
    "category": "Layout",
    "type": "I",
    "moduleId": null,
    "surfaceId": "toggle-grid",
    "path": "src/ui/components/toggle-grid",
    "manifestPath": "src/ui/components/toggle-grid/manifest.json",
    "preferred": true,
    "summary": "Responsive grid container for card-style toggle options",
    "propsSchema": {
      "columns": "string"
    },
    "defaultSlot": "default",
    "slots": {
      "default": {
        "selector": ":root",
        "allowedChildren": [
          "toggle-card",
          "radio-option"
        ]
      }
    },
    "allowedChildren": [
      "toggle-card",
      "radio-option"
    ],
    "behavior": {
      "role": "container",
      "events": [],
      "targetActions": [],
      "intentMap": {},
      "fieldValue": null,
      "eventTargetSelector": ".toggle-grid"
    },
    "style": {
      "surfaceAware": false,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {
      "title": [],
      "description": [],
      "label": []
    },
    "dependencies": {
      "runtime": [],
      "components": [
        "toggle-card",
        "radio-option"
      ]
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "template": "<div class=\"toggle-grid\" style=\"grid-template-columns:repeat(2,1fr)\"></div>",
    "render": {
      "kind": "element",
      "tag": "div",
      "className": "toggle-grid",
      "attributes": {},
      "children": [],
      "template": "<div class=\"toggle-grid\"></div>"
    }
  },
  "video-player": {
    "id": "video-player",
    "owner": "video",
    "alias": "video-player",
    "title": "Video Player",
    "category": "Module Surface",
    "type": "II",
    "moduleId": "video",
    "surfaceId": "video-player",
    "path": "src/modules/video/aiui",
    "manifestPath": "src/modules/video/aiui/manifest.json",
    "preferred": false,
    "summary": "Mountable video player. Delegates to the video module's runtime service once the video module ships.",
    "propsSchema": {
      "src": "string",
      "poster": "string",
      "muted": "string",
      "autoplay": "string"
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
      "role": "module-surface",
      "events": [],
      "targetActions": [],
      "intentMap": {}
    },
    "style": {
      "surfaceAware": true,
      "supportsVariant": false,
      "supportsSize": false,
      "supportsTone": false
    },
    "textTargets": {},
    "dependencies": {
      "runtime": [
        "video"
      ],
      "components": []
    },
    "contracts": {
      "published": [],
      "subscribed": []
    },
    "render": {
      "kind": "module",
      "tag": "div",
      "className": "aiui-surface aiui-surface--video-player"
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
