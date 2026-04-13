# CSMA UX Contract

Product structure and user-flow contract for AI-assisted UI work.

This file defines what the product needs to do for users before visual or structural generation begins.

## Purpose

`UX.md` answers:

- who the users are
- what tasks matter most
- what screens and flows exist
- what empty, loading, success, and error experiences are expected
- what domain conventions should be respected

It does not answer:

- token values
- typography palette
- primitive API details
- archetype slot rules

## Source Of Truth For

- user roles
- jobs to be done
- sitemap
- page inventory
- critical journeys
- content priorities
- UX patterns by product type

## Recommended Sections

1. Users and jobs
2. Product type and domain
3. Sitemap
4. Key flows
5. Page inventory
6. Empty/loading/error/success expectations
7. Domain conventions
8. Open UX questions

## Example Domain Packs

CSMA can later support optional domain packs such as:

- ecommerce
- membership video app
- CRM
- docs portal
- marketing site
- admin dashboard

Each domain pack could provide:

- default sitemap
- expected core flows
- standard page inventory
- common empty states
- common content priorities

## Machine-Readable Contract

For deterministic tooling, the minimal machine-readable UX contract now lives as:

- schema: `src/ui/schemas/ux-contract.schema.json`
- example reference: `docs/csma-design/contracts/reference-membership-video.ux.json`

This does not replace `UX.md`. It gives scripts and AI a strict input shape for:

- user roles
- navigation groups
- screen inventory
- critical flows
- empty/loading/error/success expectations
- open product questions

## Sitemap First Rule

Before choosing archetypes, define at least:

- top-level screens
- primary navigation groups
- key conversion or task flows

Example:

```text
Membership video app
- Home
- Discover
- Library
- Continue watching
- Account
```

Without this, archetype selection is premature.

## Minimum Required Inputs Before Archetype Selection

Require at least:

- domain
- primary user roles
- top-level sitemap with at least 5 screens when product scope justifies it
- primary navigation groups
- top 3 MVP flows, step by step
- state expectations for key screens:
  - empty
  - loading
  - error
  - success
- open UX risks or unanswered questions

This makes `UX.md` a pass/fail input contract instead of loose guidance.

## Reference Example: Membership Video App

Use this example as the current UX reference until a project-specific UX contract replaces it.

Domain:

- membership video app / website

Primary user roles:

- visitor evaluating the catalog
- signed-in member watching content
- returning member resuming playback

Top-level sitemap:

- Home
- Discover
- Library
- Continue Watching
- Account

Primary navigation groups:

- browse
- continue/resume
- personal library
- account/subscription

Top 3 MVP flows:

1. visitor lands on Home -> browses catalog -> opens content detail -> sign-in or membership gate
2. signed-in member lands on Home or Continue Watching -> resumes playback
3. member opens Library -> finds saved content -> starts or resumes playback

State expectations:

- empty: library and continue-watching explain the benefit and next action
- loading: content lists and playback entry states indicate progress clearly
- error: playback and auth failures explain what happened and what to do next
- success: sign-in, library actions, and profile updates confirm outcome tersely

Open UX risks:

- when the paywall appears
- how anonymous browsing differs from member browsing
- whether Continue Watching is a top-level destination or a home-module only

## Relationship To Structure

`UX.md` decides what experiences exist.

`STRUCTURE.md` decides how those experiences are built.

```text
UX.md
  -> screen / flow need
  -> choose layout archetype
  -> choose content archetype
  -> compile
```

If AI starts inventing sitemap or flows from `STRUCTURE.md`, `UX.md` is missing or too weak.
