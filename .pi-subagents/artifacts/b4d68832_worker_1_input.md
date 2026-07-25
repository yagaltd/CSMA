# Task for worker

[Read from: /home/aurel/Documents/github/CSMA-SSMA/CSMA-slides/context.md, /home/aurel/Documents/github/CSMA-SSMA/CSMA-slides/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement the slides module per `src/modules/slides/plan.md`. Read it IN FULL first — it is the spec, including §12 SKILL.md which has the layout catalog and JSON config schema.

CRITICAL — your environment:
- Your CWD is an isolated git worktree at `/home/aurel/Documents/github/CSMA-SSMA/CSMA-slides` on branch `wave2-slides`. node_modules + .pi-subagents are symlinked from the parent repo. Run tests with `npx vitest run` from your CWD.
- Branch base = `feat/modular-wave` HEAD which already contains: typeset CSS (with `.csma-typeset-slides` preset), history module, agent-context module, ai-ui, all CSMA runtime.
- The typeset `slides` preset is documented in `src/style/foundation/typeset-presets.css`. Use it as the parent prose class for slide content.

DECISIONS (locked, do not re-debate):
- Skip Phase 6 (CLI in separate package) — out of scope for this wave. Stop at Phase 5.
- CSS-first animation per CSMA rule. GSAP only as documented escalation (§12.14).
- `textContent` only for user data — no innerHTML (security rule).
- Contracts for ALL navigation (§3.4).

Scope (phases 1–5 of the plan):
1. Phase 1 — Core engine (~700 LOC):
   - `src/modules/slides/services/SlideDeckService.js` (~200 LOC) per plan §5.1 skeleton + §5.2 next() algorithm + §5.3 registerMax + §5.4 cross-tab sync
   - `src/modules/slides/contracts/slides-contracts.js` per plan §4 (navigation intents, annotation intents, note intents, state change events, export intents)
   - `src/modules/slides/engine/deck.js` per §6.1 (DOM factory)
   - `src/modules/slides/engine/build.js` per §6.2 (click-build state)
   - `src/modules/slides/engine/transitions.js` per §6.3 (slide enter/exit, CSS-first)
   - `src/modules/slides/engine/thumbnails.js` per §6.4 (canvas previews)
   - `src/modules/slides/index.js` manifest: `id: 'slides'`, dependencies as needed, services: `['slideDeck']`, contracts: `Object.keys(SlidesContracts)`, contributes: `{ commands: [], navigation: [], panels: [], adapters: [], views: [] }`
2. Phase 2 — Chrome UI (~350 LOC): `dock.js`, `rail.js`, `grid.js`, `presenter.js` per §7. Type II components (EventBus-driven). CSS in `src/modules/slides/chrome/{dock,rail,grid,presenter}.css`.
3. Phase 3 — First 6 layouts (~210 LOC): pick from §8.2 catalog: title, section-header, two-column, bullet-list, big-number, quote.
4. Phase 4 — Remaining 18 layouts from §8.2 catalog (~630 LOC). All 24 layouts total.
5. Phase 5 — Annotator (`engine/annotator.js` per §6.5 SVG drawing overlay) + media export hooks (stub, full export is post-v1).
6. SKILL.md per plan §12 — full agent authoring skill including JSON config schema (§12.9), layout selection rules (§12.5), centering rule (§12.6), definition of done (§12.16).

CSS per plan §9: `slides.css` (scaffold) + `dock.css` (chrome). Token usage policy §9.3 — read CSMA design tokens, no raw values.

Tests required:
- `tests/slides/slide-deck-service.test.js` — state machine, next()/prev(), registerMax
- `tests/slides/contracts-test.js` — every SLIDE_* / INTENT_SLIDE_* payload validates
- `tests/slides/layouts.test.js` — each of 24 layouts produces expected DOM structure given sample config
- `tests/slides/build-state.test.js` — click-build increments
- `tests/slides/cross-tab-sync.test.js` — two services sync via BroadcastChannel (jsdom mock)

HARD CONSTRAINTS:
- Do NOT touch any file outside `src/modules/slides/`, `demo/slides.html` (or similar), `tests/slides/`, `docs/slides/SKILL.md`.
- Do NOT modify runtime files, other modules, or typeset CSS.
- All 842 existing tests must still pass when you finish.
- Token-driven CSS only. No inline styles. Use `data-slide-type`, `data-build-step`, etc. attributes.
- `textContent` for any user-provided strings.
- Cross-tab sync via BroadcastChannel (storage-event fallback optional).

When done:
- Verify `npx vitest run` from your CWD shows 842 baseline + your new tests, ALL passing.
- Commit in your worktree with message: `feat(slides): SlideDeckService + 24 layouts + chrome + annotator + skill (Wave 2-E, no CLI)`
- Return summary: files created/modified (with line counts), final test count, deviations from plan + why.

Open questions / ambiguities: take the conservative documented default and note the choice.

If real blocker: stop, write `BLOCKER.md`, commit, return blocker text in summary. Do NOT silently downscope.

Budget: up to 40 turns. This is a large build (~2500 LOC across 24 layouts + engine + chrome).

## Acceptance Contract
Acceptance level: reviewed
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope
- criterion-2: Return evidence sufficient for an independent acceptance review

Required evidence: changed-files, tests-added, commands-run, validation-output, residual-risks, no-staged-files

Review gate: optional by reviewer.

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
`criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
`commandsRun[].result` must be exactly one of: passed, failed, not-run.
`manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```