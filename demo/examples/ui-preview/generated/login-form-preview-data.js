window.CSMA_ARCHETYPE_PREVIEW = {
  "generatedAt": "2026-04-10T10:30:24.492Z",
  "layout": {
    "id": "auth-shell",
    "kind": "layout-archetype",
    "version": "1.0.0",
    "description": "Centered authentication layout with a primary auth panel and optional supporting aside content.",
    "uses": [
      "card",
      "badge",
      "button"
    ],
    "contentSchema": {
      "eyebrow": "string",
      "headline": "string",
      "supportingText": "string"
    },
    "defaults": {
      "eyebrow": "Secure access",
      "headline": "Welcome back",
      "supportingText": "Sign in to continue into your workspace."
    },
    "regions": {
      "main": {
        "required": true,
        "description": "Primary authentication content."
      },
      "aside": {
        "required": false,
        "description": "Optional supporting content or trust indicators."
      }
    },
    "layoutRules": {
      "maxWidth": "layout-container",
      "contentWidth": "layout-container-narrow",
      "alignment": "center",
      "density": "comfortable"
    },
    "structure": {
      "type": "shell",
      "wrapperClass": "stack",
      "regions": [
        {
          "id": "hero",
          "role": "intro"
        },
        {
          "id": "main",
          "role": "primary"
        },
        {
          "id": "aside",
          "role": "secondary"
        }
      ]
    }
  },
  "layouts": {
    "auth-shell": {
      "id": "auth-shell",
      "kind": "layout-archetype",
      "version": "1.0.0",
      "description": "Centered authentication layout with a primary auth panel and optional supporting aside content.",
      "uses": [
        "card",
        "badge",
        "button"
      ],
      "contentSchema": {
        "eyebrow": "string",
        "headline": "string",
        "supportingText": "string"
      },
      "defaults": {
        "eyebrow": "Secure access",
        "headline": "Welcome back",
        "supportingText": "Sign in to continue into your workspace."
      },
      "regions": {
        "main": {
          "required": true,
          "description": "Primary authentication content."
        },
        "aside": {
          "required": false,
          "description": "Optional supporting content or trust indicators."
        }
      },
      "layoutRules": {
        "maxWidth": "layout-container",
        "contentWidth": "layout-container-narrow",
        "alignment": "center",
        "density": "comfortable"
      },
      "structure": {
        "type": "shell",
        "wrapperClass": "stack",
        "regions": [
          {
            "id": "hero",
            "role": "intro"
          },
          {
            "id": "main",
            "role": "primary"
          },
          {
            "id": "aside",
            "role": "secondary"
          }
        ]
      }
    }
  },
  "contentArchetypes": {
    "contact-form": {
      "id": "contact-form",
      "kind": "content-archetype",
      "version": "1.0.0",
      "description": "Simple contact form content using the shared auth-style shell and core form primitives.",
      "layout": "auth-shell",
      "targetRegion": "main",
      "uses": [
        "card",
        "field",
        "input",
        "button"
      ],
      "contentSchema": {
        "title": "string",
        "description": "string",
        "nameLabel": "string",
        "nameHelper": "string",
        "namePlaceholder": "string",
        "emailLabel": "string",
        "emailHelper": "string",
        "emailPlaceholder": "string",
        "companyLabel": "string",
        "companyHelper": "string",
        "companyPlaceholder": "string",
        "submitLabel": "string"
      },
      "defaults": {
        "title": "Talk to the team",
        "description": "Share your details and the right person will follow up.",
        "nameLabel": "Full name",
        "nameHelper": "Use the name your team knows you by.",
        "namePlaceholder": "Avery Lee",
        "emailLabel": "Work email",
        "emailHelper": "We will use this address for the reply.",
        "emailPlaceholder": "avery@company.com",
        "companyLabel": "Company",
        "companyHelper": "Optional, but helpful for routing your request.",
        "companyPlaceholder": "Acme Labs",
        "submitLabel": "Request contact"
      },
      "regions": {
        "main": [
          {
            "component": "card",
            "props": {
              "title": "{{title}}",
              "description": "{{description}}",
              "tone": "subtle"
            },
            "slots": {
              "body": [
                {
                  "component": "field",
                  "props": {
                    "label": "{{nameLabel}}",
                    "helper": "{{nameHelper}}",
                    "for": "contact-name",
                    "required": "true"
                  },
                  "slots": {
                    "control": [
                      {
                        "component": "input",
                        "props": {
                          "id": "contact-name",
                          "type": "text",
                          "name": "name",
                          "autocomplete": "name",
                          "placeholder": "{{namePlaceholder}}"
                        }
                      }
                    ]
                  }
                },
                {
                  "component": "field",
                  "props": {
                    "label": "{{emailLabel}}",
                    "helper": "{{emailHelper}}",
                    "for": "contact-email",
                    "required": "true"
                  },
                  "slots": {
                    "control": [
                      {
                        "component": "input",
                        "props": {
                          "id": "contact-email",
                          "type": "email",
                          "name": "email",
                          "autocomplete": "email",
                          "placeholder": "{{emailPlaceholder}}"
                        }
                      }
                    ]
                  }
                },
                {
                  "component": "field",
                  "props": {
                    "label": "{{companyLabel}}",
                    "helper": "{{companyHelper}}",
                    "for": "contact-company",
                    "required": "false"
                  },
                  "slots": {
                    "control": [
                      {
                        "component": "input",
                        "props": {
                          "id": "contact-company",
                          "type": "text",
                          "name": "company",
                          "autocomplete": "organization",
                          "placeholder": "{{companyPlaceholder}}"
                        }
                      }
                    ]
                  }
                }
              ],
              "footer": [
                {
                  "component": "button",
                  "props": {
                    "variant": "primary",
                    "text": "{{submitLabel}}"
                  }
                }
              ]
            }
          }
        ]
      }
    },
    "login-form": {
      "id": "login-form",
      "kind": "content-archetype",
      "version": "1.1.0",
      "description": "Authentication form content built on card, field, input, and button primitives.",
      "layout": "auth-shell",
      "targetRegion": "main",
      "uses": [
        "card",
        "field",
        "input",
        "button"
      ],
      "contentSchema": {
        "title": "string",
        "description": "string",
        "emailLabel": "string",
        "emailHelper": "string",
        "emailPlaceholder": "string",
        "passwordLabel": "string",
        "passwordHelper": "string",
        "passwordPlaceholder": "string",
        "submitLabel": "string"
      },
      "defaults": {
        "title": "Sign in",
        "description": "Use your work email and password to access your workspace.",
        "emailLabel": "Work email",
        "emailHelper": "Use the email tied to your organization.",
        "emailPlaceholder": "name@company.com",
        "passwordLabel": "Password",
        "passwordHelper": "Passwords are case sensitive.",
        "passwordPlaceholder": "Enter your password",
        "submitLabel": "Sign in"
      },
      "regions": {
        "main": [
          {
            "component": "card",
            "props": {
              "title": "{{title}}",
              "description": "{{description}}",
              "tone": "subtle"
            },
            "slots": {
              "body": [
                {
                  "component": "field",
                  "props": {
                    "label": "{{emailLabel}}",
                    "helper": "{{emailHelper}}",
                    "for": "login-email",
                    "required": "true"
                  },
                  "slots": {
                    "control": [
                      {
                        "component": "input",
                        "props": {
                          "id": "login-email",
                          "type": "email",
                          "name": "email",
                          "autocomplete": "email",
                          "placeholder": "{{emailPlaceholder}}"
                        }
                      }
                    ]
                  }
                },
                {
                  "component": "field",
                  "props": {
                    "label": "{{passwordLabel}}",
                    "helper": "{{passwordHelper}}",
                    "for": "login-password",
                    "required": "true"
                  },
                  "slots": {
                    "control": [
                      {
                        "component": "input",
                        "props": {
                          "id": "login-password",
                          "type": "password",
                          "name": "password",
                          "autocomplete": "current-password",
                          "placeholder": "{{passwordPlaceholder}}"
                        }
                      }
                    ]
                  }
                }
              ],
              "footer": [
                {
                  "component": "button",
                  "props": {
                    "variant": "primary",
                    "text": "{{submitLabel}}"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  }
};
