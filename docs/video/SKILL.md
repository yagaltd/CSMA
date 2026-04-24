---
name: csma-video
description: Integrate existing video assets into a CSMA site or app. Use when the user wants to embed, place, style, caption, or validate a provided video asset inside the built product.
---

<!-- version: 2.0.0 | tags: video, integration, embed, media -->

# CSMA Video Skill

## Purpose

Use this skill only when the CSMA agent is integrating an existing video asset
into the built website or app.

New video strategy, storyboarding, and video asset creation are not default
CSMA responsibilities. If the user needs a new promo, explainer, social cut,
or website-to-video output, treat that as upstream visual-content work and wait
for a finished brief or asset before implementing the integration here.

## Required Reading

Read only what applies:

1. `DESIGN.md`.
2. `docs/product-planning/SKILL.md`.
3. `SITE.md` or `APP.md` if present.
4. Relevant `pages/<page>.md` or `flows/<flow>.md`.
5. Any provided external video brief or asset list.

## Decision Matrix

| User goal | CSMA path | Outside default CSMA ownership |
|:--|:--|:--|
| Embed an existing video | Place it in the page/app, style the container, and verify playback/accessibility. | None. |
| Add captions/poster/fallback copy | Implement the asset integration cleanly. | None. |
| Plan a promo or explainer | Do not create the brief here by default. | Upstream visual-content planning. |
| Create a video from site/app pages | Do not create it here by default. | Upstream visual-content production. |

## Ownership And Location

| Rule | Reason |
|:--|:--|
| Keep new video production outside CSMA by default. | Strategy and asset generation are upstream content work. |
| Use CSMA as the integration surface. | CSMA places and styles the finished asset inside the site/app. |
| Do not replace page specs with video briefs. | Video is not a required CSMA planning artifact. |

## Required Inputs

| Input | Check |
|:--|:--|
| Video asset | URL, file path, embed provider, or CMS source. |
| Placement | Which route, screen, or section owns the video. |
| Supporting metadata | Poster, captions, transcript, title, consent/compliance notes. |
| Visual rules | `DESIGN.md`, token system, and surrounding layout constraints. |

## Integration Workflow

1. Confirm the video asset already exists or has been provided upstream.
2. Confirm where it belongs in the site/app and what role it plays.
3. Implement the embed/container/player treatment using normal CSMA page/component patterns.
4. Add captions, transcript links, poster images, consent gating, or fallback copy as needed.
5. Preview the page and validate playback, layout, and accessibility.

## Validation

| Check | Expected result |
|:--|:--|
| Style match | Video placement follows `DESIGN.md`, tokens, density, and anti-patterns. |
| Layout | Player, poster, captions, and controls fit target breakpoints. |
| Accessibility | Captions/transcript/fallback are present when required. |
| Playback | The asset loads or degrades cleanly. |
| Preview | The integrated page/screen can be reviewed before release. |

## Guardrails

- Do not create new video strategy or storyboard assets here by default.
- Do not add video production tooling to CSMA unless the user explicitly wants that exception in this repo.
- Do not let embedded video treatment drift from CSMA's `DESIGN.md` and tokens.
