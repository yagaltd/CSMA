# Task for worker

[Read from: /home/aurel/Documents/github/CSMA-SSMA/CSMA-mindmap/context.md, /home/aurel/Documents/github/CSMA-SSMA/CSMA-mindmap/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement the mindmap module per `src/modules/mindmap/plan.md`. Read it IN FULL first — it is the spec. Also read `src/modules/mindmap/plan/components.md` (legacy component specs, still accurate).

CRITICAL — your environment:
- Your CWD is an isolated git worktree at `/home/aurel/Documents/github/CSMA-SSMA/CSMA-mindmap` on branch `wave2-mindmap`. node_modules + .pi-subagents are symlinked from the parent repo. Run tests with `npx vitest run` from your CWD.
- Branch base = `feat/modular-wave` HEAD which already contains: history module, agent-context module, typeset CSS, ai-ui, storage, all CSMA runtime.
- The history module API: see `src/modules/history/services/HistoryService.js` — methods `record(intent, payload, meta)`, `undo()`, `redo()`, `getAll()`, `getSince(cursor)`, `hasEntry(id)`, `ingest(entry)`, `clock`, `cursor`. Events: `HISTORY_OP_RECORDED`, `HISTORY_OP_UNDONE`, `HISTORY_OP_REDONE`, `HISTORY_LOG_READY`.
- The agent-context module: register serializers via your module manifest `contributes.contextSerializers: [{store, format, fn, label, default}]`. Service API: `agentContext.get({store, format, filter, depth, cursor})`, `agentContext.subscribe({store, format}, cb)` (requires history module loaded).
- The `contextSerializers` contribution type is wired into ModuleManifest + ModuleManager. The SerializerRegistry is a core service registered as `serializerRegistry`.
- mind-elixir source to port is at `~/Documents/vibe/mind-elixir-core/src/utils/{layout.ts, svg.ts, generateBranch.ts}` (97+244+107 LOC TypeScript). Port to plain JS, preserve MIT license attribution.

DECISIONS (locked, do not re-debate):
- All 8 v1 features ship: view, edit, status, collapse, undo/redo, drag-drop, multi-map, search
- Port mind-elixir layout to plain JS inside CSMA (option 4a)
- Headless: NO mind-elixir runtime DOM import. Only port layout math.
- Local-first: IDB only, no SSMA/SQLite/sync in v1
- Markdown is a serialization format for agent context ONLY — not the runtime model, not the storage format

Scope (phases 1–9 of the plan):
1. Port `layout.ts` + `svg.ts` + `generateBranch.ts` → `src/modules/mindmap/services/LayoutEngine.js` + `ConnectorGeometry.js` as pure functions. Add `vendor/MIND_ELIXIR_LICENSE` + header attribution.
2. Create 3 components via `npm run create-component <name>` then author CSS: `branch-node`, `leaf-node`, `connector-line`. Specs in `plan/components.md`. Type I (CSS-only state). Then `npm run generate-ai-ui-catalog` so they appear in the catalog.
3. `MindmapService.js` — full API per plan §Public API. Every mutator calls `history.record('mindmap', {op, nodeId, before, after})` and fires a `MINDMAP_*` contract event.
4. `MindmapStore.js` — IDB adapter over storage module: `maps` store (metadata) + `map_nodes` store (one record per NodeObj).
5. Render loop: on `loadMap`, traverse + LayoutEngine → mount components via ai-ui (`service.applyOp({spec:{component:'branch-node'}})`). Draw connectors via ConnectorGeometry into one SVG layer.
6. Undo/redo proxies to history. Collapse is visual-only but still recorded.
7. Drag-drop: HTML5 DnD on branch/leaf nodes. Validate drop targets (leaves can't accept children).
8. Multi-map: `createMap`, `listMaps`, `loadMap`, `deleteMap`. Search: `Search.js` fuzzy over topic + filter by status/tag.
9. `MarkdownCodec.js` + serializers `toMarkdown`, `toAscii`, `toMinimalJson`. Register via manifest `contributes.contextSerializers`.
10. Demo `demo/mindmap.html` + README.

CONTRACTS to define in `contracts/mindmap-contracts.js`:
MINDMAP_NODE_ADDED, MINDMAP_NODE_REMOVED, MINDMAP_NODE_UPDATED, MINDMAP_STRUCTURE_CHANGED, MINDMAP_NODE_MOVED, MINDMAP_COLLAPSED, MINDMAP_MAP_CREATED, MINDMAP_MAP_DELETED.

NodeObj shape per plan §NodeObj — use exactly.

Tests required (per plan §Tests):
- `tests/mindmap/layout-engine.test.js` — golden layouts
- `tests/mindmap/connector-geometry.test.js`
- `tests/mindmap/mindmap-service.test.js`
- `tests/mindmap/render.test.js` (jsdom)
- `tests/mindmap/undo-redo.test.js`
- `tests/mindmap/drag-drop.test.js`
- `tests/mindmap/search.test.js`
- `tests/mindmap/markdown-codec.test.js`
- `tests/mindmap/contracts-test.js`

HARD CONSTRAINTS:
- Do NOT touch any file outside `src/modules/mindmap/`, `src/ui/components/{branch-node,leaf-node,connector-line}/`, `demo/mindmap.html`, `tests/mindmap/`, `src/modules/ai-ui/catalog/componentCatalog.js` (regenerated).
- Do NOT modify any runtime file (ModuleManager, ModuleManifest, Contracts, features.js, bootstrap.js).
- Do NOT modify other modules (history, agent-context, optimistic-sync, typeset, slides).
- All 842 existing tests must still pass when you finish. New tests added on top.
- Token-driven CSS only. Read `docs/design/SKILL.md` if unsure about token usage. No `:root` writes, no inline styles in components.
- No raw emoji or color literals in CSS — use `data-status` attributes that map to tokens.

When done:
- Verify `npx vitest run` from your CWD shows 842 baseline + your new tests, ALL passing.
- Commit in your worktree with message: `feat(mindmap): headless local-first mindmap — layout port + components + service + serializers (Wave 2-D)`
- Return summary: files created/modified (with line counts), final test count, deviations from plan + why.

Open questions in the plan (§Open questions): take the 'lean' default and document the choice in your final summary.

If you hit a real blocker (something the plan didn't anticipate), stop, write `BLOCKER.md` in your worktree root, commit it, return the blocker text in your summary. Do NOT silently downscope.

Budget: you have up to 40 turns. Use them. This is a large multi-phase build.

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