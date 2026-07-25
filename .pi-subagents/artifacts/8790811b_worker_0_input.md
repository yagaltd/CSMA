# Task for worker

[Read from: /home/aurel/Documents/github/CSMA-SSMA/CSMA/context.md, /home/aurel/Documents/github/CSMA-SSMA/CSMA/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement the typeset plan at `src/style/foundation/typeset-plan.md`. Read it IN FULL first — it is the spec.

Context:
- We are on git branch `feat/modular-wave`. Your worktree was created from its HEAD.
- Wave 0 already added the `contextSerializers` contribution type to runtime — you do NOT touch runtime at all.
- Repo is CSMA: design-token-first vanilla JS template. Read `AGENTS.md` for token/architecture rules.

Scope (phases 1–5 of the plan):
1. Phase 1 — create `src/style/foundation/typeset.css` (the rhythm engine)
2. Phase 2 — create `src/style/foundation/typeset-presets.css` (catalog: `.csma-typeset-docs`, `-blog`, `-chat`, `-slides`, `-large`)
3. Phase 3 — add two `@import` lines to `src/style/main.css` (after the existing `./base.css` import, before layout)
4. Phase 4 — create `demo/typeset-demo.html` + `demo/typeset-demo.js` + `demo/typeset-demo.css` per §6 of the plan
5. Phase 5 — create `docs/typeset/SKILL.md` per §7 of the plan (frontmatter + reading chain + streaming contract + definition of done)

Hard rules (from plan §10 Safety Checklist):
- Typeset reads CSMA tokens via `var(--…)`. Never writes to `:root`.
- All visual values reference `var(--ts-*)` variables scoped to `.csma-typeset`. No raw values in element selectors.
- No new design tokens created.
- Use `:where()` guard pattern so typeset coexists with `base.css` (zero specificity).
- Streaming-safe: no `:last-child`, `:has()`, `:empty` in layout rules. Spacing via `margin-block-start` only.

Out of scope (do NOT do):
- Phase 6 of plan (slides integration) — that's a different agent's job
- Any runtime JS, any module under `src/modules/`
- Modifying `base.css` or any existing CSS file except `main.css` (one @import addition)

Verification before declaring done:
- Run `npx vitest run` — all 748 existing tests must still pass (you add no new tests in v1; the plan does not require them)
- Run `npm run lint:styles` if it exists — must not error on your new files
- Open the demo HTML mentally and confirm structure matches §6.3 of the plan

When done:
- Commit in your worktree with message: `feat(typeset): CSS rhythm engine + presets + demo + skill (Wave 1-A)`
- Return a summary: files created (with line counts), test result line, any deviations from plan + why.

Open questions in the plan you may encounter: take the 'lean' default noted in the plan and document the choice in your summary. Do not block on them.

If you hit a real blocker (something the plan did not anticipate), stop, write the blocker to a file `BLOCKER.md` in your worktree root, commit it, and return the blocker text in your summary.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

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