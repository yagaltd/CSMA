# Page: Terms of Service

## Purpose

| Field | Decision |
|:--|:--|
| Generated from manifest | `<yes/no>` |
| Surfaces covered | `<site/app/mobile/companion web>` |
| Commercial model | `<free/subscription/one-time/enterprise>` |
| Review owner | `<legal/product/ops>` |

## Required Inputs

| Input | Source |
|:--|:--|
| Product identity | `project-manifest.json` |
| Public presence | `project-manifest.json`, `SITE.md`, `APP.md` |
| Payments or plans | `APP.md`, `flows/checkout.md` |
| AI, content, or account features | `project-manifest.json`, `flows/*.md` |

## Required Sections

| Section | Must cover |
|:--|:--|
| Acceptance | `<how users agree>` |
| Services covered | `<what products and surfaces are included>` |
| Acceptable use | `<misuse and enforcement>` |
| Accounts | `<if auth exists>` |
| Billing | `<if checkout exists>` |
| User content | `<if upload/media exists>` |
| IP and licenses | `<ownership and permitted use>` |
| Liability and disclaimers | `<jurisdiction-aware placeholders>` |
| Governing law | `<venue/arbitration/consumer carve-outs>` |

## Drafting Notes

- Start from the generated scaffold when present.
- Keep commercial terms aligned with checkout and refund flows.
- Treat all generated language as placeholders until reviewed by counsel.
