window.CSMA_ARCHETYPE_PREVIEW = {
  "generatedAt": "2026-04-11T06:29:09.106Z",
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
  },
  "renderContracts": {
    "contact-form": {
      "id": "contact-form",
      "kind": "render-contract",
      "version": "1.0.0",
      "page": {
        "id": "contact-form",
        "viewId": "ai-ui.contact-form",
        "contentArchetypeId": "contact-form",
        "layoutArchetypeId": "auth-shell",
        "targetRegion": "main",
        "routePath": "/contact-form",
        "title": "Talk to the team"
      },
      "layout": {
        "id": "auth-shell",
        "regions": [
          "main",
          "aside"
        ],
        "rules": {
          "maxWidth": "layout-container",
          "contentWidth": "layout-container-narrow",
          "alignment": "center",
          "density": "comfortable"
        },
        "intro": {
          "eyebrow": "Secure access",
          "headline": "Welcome back",
          "supportingText": "Sign in to continue into your workspace."
        }
      },
      "head": {
        "title": "Talk to the team",
        "tags": [
          {
            "tag": "meta",
            "key": "meta:key:description",
            "props": {
              "name": "description",
              "content": "Share your details and the right person will follow up."
            }
          },
          {
            "tag": "link",
            "key": "link:canonical",
            "props": {
              "rel": "canonical",
              "href": "/contact-form"
            }
          }
        ],
        "htmlAttrs": {
          "attrs": {
            "lang": "en"
          },
          "classes": [
            "layout-auth-shell",
            "page-contact-form"
          ],
          "style": {}
        },
        "bodyAttrs": {
          "attrs": {
            "data-view-id": "ai-ui.contact-form",
            "data-layout-id": "auth-shell",
            "data-content-id": "contact-form"
          },
          "classes": [],
          "style": {}
        }
      },
      "regions": {
        "hero": [],
        "main": [
          {
            "component": "card",
            "props": {
              "title": "Talk to the team",
              "description": "Share your details and the right person will follow up.",
              "tone": "subtle"
            },
            "slots": {
              "body": [
                {
                  "component": "field",
                  "props": {
                    "label": "Full name",
                    "helper": "Use the name your team knows you by.",
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
                          "placeholder": "Avery Lee"
                        }
                      }
                    ]
                  }
                },
                {
                  "component": "field",
                  "props": {
                    "label": "Work email",
                    "helper": "We will use this address for the reply.",
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
                          "placeholder": "avery@company.com"
                        }
                      }
                    ]
                  }
                },
                {
                  "component": "field",
                  "props": {
                    "label": "Company",
                    "helper": "Optional, but helpful for routing your request.",
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
                          "placeholder": "Acme Labs"
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
                    "text": "Request contact"
                  }
                }
              ]
            }
          }
        ],
        "aside": []
      },
      "activation": {
        "bootstrap": "full-runtime",
        "clientViews": [
          {
            "viewId": "ai-ui.contact-form",
            "mode": "replace",
            "target": "#auth-shell-preview",
            "state": {}
          }
        ],
        "typeIComponents": [
          "button",
          "card",
          "field",
          "input"
        ],
        "typeIIComponents": []
      },
      "componentsUsed": [
        "button",
        "card",
        "field",
        "input"
      ]
    },
    "login-form": {
      "id": "login-form",
      "kind": "render-contract",
      "version": "1.0.0",
      "page": {
        "id": "login-form",
        "viewId": "ai-ui.login-form",
        "contentArchetypeId": "login-form",
        "layoutArchetypeId": "auth-shell",
        "targetRegion": "main",
        "routePath": "/login-form",
        "title": "Sign in"
      },
      "layout": {
        "id": "auth-shell",
        "regions": [
          "main",
          "aside"
        ],
        "rules": {
          "maxWidth": "layout-container",
          "contentWidth": "layout-container-narrow",
          "alignment": "center",
          "density": "comfortable"
        },
        "intro": {
          "eyebrow": "Secure access",
          "headline": "Welcome back",
          "supportingText": "Sign in to continue into your workspace."
        }
      },
      "head": {
        "title": "Sign in",
        "tags": [
          {
            "tag": "meta",
            "key": "meta:key:description",
            "props": {
              "name": "description",
              "content": "Use your work email and password to access your workspace."
            }
          },
          {
            "tag": "link",
            "key": "link:canonical",
            "props": {
              "rel": "canonical",
              "href": "/login-form"
            }
          }
        ],
        "htmlAttrs": {
          "attrs": {
            "lang": "en"
          },
          "classes": [
            "layout-auth-shell",
            "page-login-form"
          ],
          "style": {}
        },
        "bodyAttrs": {
          "attrs": {
            "data-view-id": "ai-ui.login-form",
            "data-layout-id": "auth-shell",
            "data-content-id": "login-form"
          },
          "classes": [],
          "style": {}
        }
      },
      "regions": {
        "hero": [],
        "main": [
          {
            "component": "card",
            "props": {
              "title": "Sign in",
              "description": "Use your work email and password to access your workspace.",
              "tone": "subtle"
            },
            "slots": {
              "body": [
                {
                  "component": "field",
                  "props": {
                    "label": "Work email",
                    "helper": "Use the email tied to your organization.",
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
                          "placeholder": "name@company.com"
                        }
                      }
                    ]
                  }
                },
                {
                  "component": "field",
                  "props": {
                    "label": "Password",
                    "helper": "Passwords are case sensitive.",
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
                          "placeholder": "Enter your password"
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
                    "text": "Sign in"
                  }
                }
              ]
            }
          }
        ],
        "aside": []
      },
      "activation": {
        "bootstrap": "full-runtime",
        "clientViews": [
          {
            "viewId": "ai-ui.login-form",
            "mode": "replace",
            "target": "#auth-shell-preview",
            "state": {}
          }
        ],
        "typeIComponents": [
          "button",
          "card",
          "field",
          "input"
        ],
        "typeIIComponents": []
      },
      "componentsUsed": [
        "button",
        "card",
        "field",
        "input"
      ]
    }
  },
  "legacyViews": {
    "contact-form": {
      "ok": true,
      "layoutId": "auth-shell",
      "archetypeId": "contact-form",
      "contentArchetypeId": "contact-form",
      "viewId": "ai-ui.contact-form",
      "target": "#auth-shell-preview",
      "mode": "replace",
      "state": {},
      "layout": {
        "id": "auth-shell",
        "regions": [
          "main",
          "aside"
        ],
        "rules": {
          "maxWidth": "layout-container",
          "contentWidth": "layout-container-narrow",
          "alignment": "center",
          "density": "comfortable"
        }
      },
      "shell": {
        "id": "auth-shell",
        "intro": {
          "eyebrow": "Secure access",
          "headline": "Welcome back",
          "supportingText": "Sign in to continue into your workspace."
        },
        "regions": {
          "hero": [],
          "main": [
            {
              "component": "card",
              "props": {
                "title": "Talk to the team",
                "description": "Share your details and the right person will follow up.",
                "tone": "subtle"
              },
              "slots": {
                "body": [
                  {
                    "component": "field",
                    "props": {
                      "label": "Full name",
                      "helper": "Use the name your team knows you by.",
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
                            "placeholder": "Avery Lee"
                          }
                        }
                      ]
                    }
                  },
                  {
                    "component": "field",
                    "props": {
                      "label": "Work email",
                      "helper": "We will use this address for the reply.",
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
                            "placeholder": "avery@company.com"
                          }
                        }
                      ]
                    }
                  },
                  {
                    "component": "field",
                    "props": {
                      "label": "Company",
                      "helper": "Optional, but helpful for routing your request.",
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
                            "placeholder": "Acme Labs"
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
                      "text": "Request contact"
                    }
                  }
                ]
              }
            }
          ],
          "aside": []
        }
      },
      "view": {
        "component": "card",
        "props": {
          "title": "Talk to the team",
          "description": "Share your details and the right person will follow up.",
          "tone": "subtle"
        },
        "slots": {
          "body": [
            {
              "component": "field",
              "props": {
                "label": "Full name",
                "helper": "Use the name your team knows you by.",
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
                      "placeholder": "Avery Lee"
                    }
                  }
                ]
              }
            },
            {
              "component": "field",
              "props": {
                "label": "Work email",
                "helper": "We will use this address for the reply.",
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
                      "placeholder": "avery@company.com"
                    }
                  }
                ]
              }
            },
            {
              "component": "field",
              "props": {
                "label": "Company",
                "helper": "Optional, but helpful for routing your request.",
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
                      "placeholder": "Acme Labs"
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
                "text": "Request contact"
              }
            }
          ]
        }
      },
      "componentsUsed": [
        "button",
        "card",
        "field",
        "input"
      ]
    },
    "login-form": {
      "ok": true,
      "layoutId": "auth-shell",
      "archetypeId": "login-form",
      "contentArchetypeId": "login-form",
      "viewId": "ai-ui.login-form",
      "target": "#auth-shell-preview",
      "mode": "replace",
      "state": {},
      "layout": {
        "id": "auth-shell",
        "regions": [
          "main",
          "aside"
        ],
        "rules": {
          "maxWidth": "layout-container",
          "contentWidth": "layout-container-narrow",
          "alignment": "center",
          "density": "comfortable"
        }
      },
      "shell": {
        "id": "auth-shell",
        "intro": {
          "eyebrow": "Secure access",
          "headline": "Welcome back",
          "supportingText": "Sign in to continue into your workspace."
        },
        "regions": {
          "hero": [],
          "main": [
            {
              "component": "card",
              "props": {
                "title": "Sign in",
                "description": "Use your work email and password to access your workspace.",
                "tone": "subtle"
              },
              "slots": {
                "body": [
                  {
                    "component": "field",
                    "props": {
                      "label": "Work email",
                      "helper": "Use the email tied to your organization.",
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
                            "placeholder": "name@company.com"
                          }
                        }
                      ]
                    }
                  },
                  {
                    "component": "field",
                    "props": {
                      "label": "Password",
                      "helper": "Passwords are case sensitive.",
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
                            "placeholder": "Enter your password"
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
                      "text": "Sign in"
                    }
                  }
                ]
              }
            }
          ],
          "aside": []
        }
      },
      "view": {
        "component": "card",
        "props": {
          "title": "Sign in",
          "description": "Use your work email and password to access your workspace.",
          "tone": "subtle"
        },
        "slots": {
          "body": [
            {
              "component": "field",
              "props": {
                "label": "Work email",
                "helper": "Use the email tied to your organization.",
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
                      "placeholder": "name@company.com"
                    }
                  }
                ]
              }
            },
            {
              "component": "field",
              "props": {
                "label": "Password",
                "helper": "Passwords are case sensitive.",
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
                      "placeholder": "Enter your password"
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
                "text": "Sign in"
              }
            }
          ]
        }
      },
      "componentsUsed": [
        "button",
        "card",
        "field",
        "input"
      ]
    }
  }
};
