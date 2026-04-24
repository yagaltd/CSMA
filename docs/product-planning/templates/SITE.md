# SITE

## Site Goal

| Field | Decision |
|:--|:--|
| Primary goal | `<what the site must achieve>` |
| Audience | `<who the site is for>` |
| Conversion | `<primary action>` |

## Manifest Mirror

| Field | Decision |
|:--|:--|
| Product type | `<site/web-app/hybrid/mobile-app>` |
| Web enabled | `<true/false>` |
| Indexable | `<true/false>` |
| Base URL | `<https://example.com>` |
| Default locale | `<en>` |

## Navigation

| Area | Links / behavior |
|:--|:--|
| Header | `<links, CTA, theme/language controls>` |
| Mobile nav | `<collapse/drawer/menu behavior>` |
| Footer | `<links, legal, social, secondary CTA>` |

## Pages

| Route | Purpose | Primary CTA | Required content |
|:--|:--|:--|:--|
| `/` | `<home goal>` | `<CTA>` | `<sections/assets>` |

## Public Route Inventory

| Route | Indexable | In manifest | Notes |
|:--|:--|:--|:--|
| `/` | `<yes/no>` | `<yes/no>` | `<sitemap/llms/legal relevance>` |

## Global Shell

| Area | Rule |
|:--|:--|
| Header | `<sticky/static, height, behavior>` |
| Footer | `<columns, legal, newsletter, etc.>` |
| Theme | `<light/dark/contrast expectations>` |
| SEO/meta | `<title/description/social cards>` |
| Consent | `<banner/sticky/modal/none>` |

## Legal And Compliance

| Need | Page / flow |
|:--|:--|
| Privacy | `<pages/privacy.md or not needed>` |
| Terms | `<pages/terms.md or not needed>` |
| Cookies | `<pages/cookies.md or not needed>` |
| Accessibility | `<assumptions>` |

## Generated Files

| Artifact | Expected | Source |
|:--|:--|:--|
| `pages/privacy.md` | `<yes/no>` | `npm run generate-project-artifacts` |
| `pages/terms.md` | `<yes/no>` | `npm run generate-project-artifacts` |
| `pages/cookies.md` | `<yes/no>` | `npm run generate-project-artifacts` |
| `public/robots.txt` | `<yes/no>` | `npm run generate-project-artifacts` |
| `public/sitemap.xml` | `<yes/no>` | `npm run generate-project-artifacts` |
| `public/llms.txt` | `<yes/no>` | `npm run generate-project-artifacts` |

## Shared Components

| Component | Used by | Notes |
|:--|:--|:--|
| `<component>` | `<pages>` | `<states/type>` |
