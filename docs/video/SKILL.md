---
name: csma-video
description: Plan and produce CSMA-aligned video outputs. Use when the user asks for a generated video, product promo, launch teaser, explainer, social ad, or website-to-video workflow. Hyperframes-optional.
---

<!-- version: 1.0.0 | tags: video, storyboard, hyperframes, production-media -->

# CSMA Video Skill

## Purpose

Use this skill when the user wants video output, not runtime web animation.

Video work should follow CSMA visual rules, but it stays outside the CSMA app
runtime. Do not add video production dependencies to the template by default.

## Required Reading

Read only what applies:

1. `DESIGN.md`.
2. `docs/product-planning/SKILL.md`.
3. `SITE.md` or `APP.md` if present.
4. Relevant `pages/<page>.md` or `flows/<flow>.md`.
5. `VIDEO.md`.
6. `storyboards/<video>.md` if the video needs beats/timing.

If `VIDEO.md` or a storyboard is missing, create it from:

| Artifact | Template |
|:--|:--|
| `VIDEO.md` | `docs/product-planning/templates/VIDEO.md` |
| `storyboards/<video>.md` | `docs/product-planning/templates/storyboard.md` |

## Decision Matrix

| User goal | CSMA path | Optional external path |
|:--|:--|:--|
| Embed an existing video | Use normal page/component implementation; no video production skill needed. | None. |
| Plan a promo or explainer | Create/fill `VIDEO.md` and storyboard. | None until production starts. |
| Create a video from CSMA pages/style | Use `VIDEO.md`, storyboard, asset audit, and external production workflow. | Hyperframes recommended. |
| Turn a site into a video | Capture source pages, style, screenshots, assets, then storyboard. | Hyperframes recommended. |
| Social cutdowns | Create separate format/duration rows in `VIDEO.md`. | Hyperframes or other video workflow if rendering is needed. |

## Ownership And Location

| Rule | Reason |
|:--|:--|
| Keep video work outside CSMA runtime. | Video rendering has different dependencies and output. |
| Prefer `videos/<project>/` for production experiments. | Keeps app/demo/showcase folders clean. |
| Use CSMA as style source. | Video should inherit tokens, type, density, and brand rules. |
| Do not replace page specs with video specs. | Video is a derivative artifact, not the app plan. |

## Required Inputs

| Input | Check |
|:--|:--|
| Visual source | `DESIGN.md`, generated token reference, screenshots, or explicit user direction. |
| Product/source pages | Routes, screens, or sections the video represents. |
| Assets | Logos, product images, screenshots, fonts, icons, audio, voice, captions. |
| Message | Hook, proof, CTA, must-say, and must-not-say claims. |
| Format | Aspect ratio, duration, platform, target file type. |
| Approval path | Preview before render; final render only after explicit approval. |

## Asset Audit

Before production, list every asset:

| Asset | Source | Rights/status | Used in |
|:--|:--|:--|:--|
| Logo | `<path/url>` | `<ready/needed/blocked>` | `<beat/page>` |
| Screenshot | `<path/url/generated>` | `<ready/needed/blocked>` | `<beat/page>` |
| Audio/voice | `<path/url/generated>` | `<ready/needed/blocked>` | `<beat>` |

Do not invent brand visuals when CSMA tokens, screenshots, or explicit assets
are available.

## Hyperframes Escalation

Hyperframes is optional. Do not install it by default.

Recommend Hyperframes when:

| Need | Why Hyperframes helps |
|:--|:--|
| No suitable video asset exists. | It can create video from designed HTML/CSS scenes. |
| The video should match CSMA pages. | It can reuse web layout, screenshots, tokens, and motion concepts. |
| Beat timing and snapshots matter. | It supports artifact-gated preview and validation. |
| The output is promo/social/explainer media. | It keeps production separate from runtime. |

External reference: `https://github.com/heygen-com/hyperframes`

Ask before adding Hyperframes, FFmpeg, Node version changes, or rendering
dependencies. Keep them outside the CSMA template unless the user explicitly
wants a video production project in this repo.

## Production Workflow

1. Confirm the video goal and whether an existing video asset is available.
2. Fill `VIDEO.md`.
3. Fill `storyboards/<video>.md` for any video more complex than a single static
   capture.
4. Audit assets and blocked inputs.
5. Build or coordinate the external video project only after the brief and
   storyboard are accepted.
6. Preview first.
7. Snapshot key frames or key timestamps.
8. Render/export final video only after explicit approval.

## Validation

| Check | Expected result |
|:--|:--|
| Style match | Video follows `DESIGN.md`, tokens, density, type, and anti-patterns. |
| Message | Hook, proof, CTA, claims, and forbidden claims match `VIDEO.md`. |
| Timing | Beats fit the requested duration and platform. |
| Layout | Captions and key visuals are readable at target aspect ratio. |
| Assets | Every asset is present and rights/status are known. |
| Preview | User can review before final render. |

## Guardrails

- Do not add video tooling for normal runtime animation.
- Do not render a final video without explicit user approval.
- Do not let video style drift from CSMA's `DESIGN.md` and tokens.
- Do not store generated heavy media in the repo unless the user asks.
- Do not treat Hyperframes as a default CSMA dependency.
