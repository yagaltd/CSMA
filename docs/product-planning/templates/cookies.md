# Page: Cookie Policy

## Purpose

| Field | Decision |
|:--|:--|
| Generated from manifest | `<yes/no>` |
| Web surface enabled | `<true/false>` |
| Indexable | `<true/false>` |
| Review owner | `<legal/product/ops>` |

## Required Inputs

| Input | Source |
|:--|:--|
| Base URL and routes | `project-manifest.json` |
| Consent behavior | `project-manifest.json`, `SITE.md`, `flows/consent.md` |
| Session, auth, checkout, analytics usage | `APP.md`, runtime config, service notes |

## Required Sections

| Section | Must cover |
|:--|:--|
| Scope | `<which web experiences are covered>` |
| Technologies used | `<cookies, local storage, SDK storage, pixels>` |
| Categories | `<strictly necessary, analytics, preferences, commerce>` |
| Consent management | `<banner, settings, withdrawal>` |
| Managing cookies | `<browser and in-product controls>` |

## Module-Aware Additions

| Module group | Add section |
|:--|:--|
| `analytics`, `consent` | Analytics, tags, consent controls |
| `auth` | Session and login storage |
| `checkout` | Cart, billing, fraud-prevention storage |

## Drafting Notes

- This template applies only when `web.enabled=true`.
- Start from the generated scaffold when present.
- Do not infer vendor names or cookie lifetimes in v1 without confirmed implementation details.
