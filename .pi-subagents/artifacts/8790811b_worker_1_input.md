# Task for worker

[Read from: /home/aurel/Documents/github/CSMA-SSMA/CSMA/context.md, /home/aurel/Documents/github/CSMA-SSMA/CSMA/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement the history module plan at `src/modules/history/plan.md`. Read it IN FULL first — it is the spec.

Context:
- We are on git branch `feat/modular-wave`. Your worktree was created from its HEAD.
- Wave 0 already added the `contextSerializers` contribution type to runtime — irrelevant to you but don't undo it.
- Repo is CSMA. Read `AGENTS.md` for architecture rules.
- Decision 2b: HARD CUT migration of optimistic-sync (CSMA is dev, breaking OK).

Goal: extract `ActionLogService` from `src/modules/optimistic-sync/services/ActionLogService.js` into a new generic `history` module. Then refactor optimistic-sync to consume it.

Scope (phases 1–3 of the plan):
1. Phase 1 — Create `src/modules/history/` skeleton:
   - `index.js` (manifest: `id: 'history'`, dependencies: `['storage']`, services: `['history']`, contracts: `Object.keys(HistoryContracts)`)
   - `contracts/history-contracts.js` with `HISTORY_OP_RECORDED`, `HISTORY_OP_UNDONE`, `HISTORY_OP_REDONE`, `HISTORY_LOG_READY` per plan §Contracts
   - `services/HistoryService.js` — port from `ActionLogService.js` (494 LOC). Strip sync-specific methods (`markAcked`, `markFailed`, `getPending`, `updatePayload`) — those move to a new `optimistic-sync/services/SyncStateTracker.js`. Keep: `record`, `undo`, `redo`, `getAll`, `getSince`, `hasEntry`, `ingest`, `clock`, multi-tab `BroadcastChannel`, IDB store adapter.
   - `services/HistoryStore.js` (IDB adapter, extracted)
   - `services/BroadcastSync.js` (BroadcastChannel helper, extracted)
2. Phase 2 — Hard-cut migrate `optimistic-sync`:
   - Update `src/modules/optimistic-sync/index.js` to import `HistoryService` from history module, drop `ActionLogService` export, add `dependencies: ['history']`
   - Update `OptimisticSyncService.js` to inject `historyService` (rename from `actionLogService`)
   - Create `optimistic-sync/services/SyncStateTracker.js` (~80 LOC) to hold `markAcked`/`markFailed`/`getPending`/`updatePayload` — decorate entries with sync status in-memory
   - Update `CrdtReducerRegistry.js` constructor arg name from `actionLogService` to `historyService`
3. Phase 3 — Register history contracts; verify `Contracts.validate()` accepts the new event names

Critical constraints:
- The history module is generic — NO sync semantics. `status` field values on entries: `recorded`, `undone`, `redone` only. Sync states (`acked`, `failed`, `pending`) live in `SyncStateTracker` outside the entry.
- Tests must pass: `npx vitest run` — all 748 existing tests must still pass (especially `tests/contracts.test.js` and any optimistic-sync tests).
- New tests required (per plan §Tests):
  - `tests/history/history-service.test.js` — record/undo/redo, multi-step, cursor monotonicity
  - `tests/history/history-store.test.js` — IDB round-trip
  - `tests/history/history-broadcast.test.js` — two HistoryService instances share via BroadcastChannel (jsdom mock)
  - `tests/history/history-contracts.test.js` — payload validation

Out of scope:
- Phase 4 (README) — write a minimal one but don't spend long
- Refactoring `visual-editor/engine/Transaction.js` to use history — explicit follow-up, not this wave
- Server-side reconciliation, compression, snapshot caching

When done:
- Commit in your worktree with message: `feat(history): extract generic do/undo/redo module from ActionLogService, migrate optimistic-sync (Wave 1-B)`
- Return summary: files created/modified (line counts), test results (X/Y passing), any deviations + why.

Open questions in the plan: take the 'lean' default and document. Don't block.

If real blocker: write `BLOCKER.md` in worktree root, commit, return blocker text in summary.

---
Update progress at: /home/aurel/Documents/github/CSMA-SSMA/CSMA/.pi-subagents/artifacts/progress/8790811b/progress.md

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