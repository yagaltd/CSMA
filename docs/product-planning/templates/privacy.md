# Page: Privacy Policy

## Purpose

| Field | Decision |
|:--|:--|
| Generated from manifest | `<yes/no>` |
| Surfaces covered | `<site/app/mobile/companion web>` |
| Jurisdiction focus | `<countries or regions>` |
| Review owner | `<legal/product/ops>` |

## Required Inputs

| Input | Source |
|:--|:--|
| Organization identity | `project-manifest.json` |
| Product modules | `project-manifest.json` |
| Public routes | `project-manifest.json` / `SITE.md` |
| Account, storage, payment, and AI behavior | `APP.md`, `flows/*.md`, service notes |

## Required Sections

| Section | Must cover |
|:--|:--|
| Data collected | `<user, device, operational, support>` |
| Use of data | `<service delivery, support, security, analytics>` |
| Sharing | `<vendors, subprocessors, legal disclosures>` |
| Retention | `<how long and why>` |
| Rights | `<access, deletion, correction, opt-out>` |
| Contact | `<support/legal contact>` |

## Module-Aware Additions

| Module group | Add section |
|:--|:--|
| `analytics`, `consent` | Tracking, analytics, consent |
| `auth` | Accounts, credentials, sessions |
| `checkout` | Billing, payment, refunds |
| `file-upload`, `media-capture`, `file-system` | Uploaded content and storage |
| `location` | Location data |
| `notifications` | Communications and push |
| `ai`, `ai-ui` | AI processing and output disclosure |

## Drafting Notes

- Start from the generated scaffold when present.
- Keep explicit `TODO` markers until the legal review is complete.
- Do not claim provider names, certifications, or retention periods unless they are confirmed.
