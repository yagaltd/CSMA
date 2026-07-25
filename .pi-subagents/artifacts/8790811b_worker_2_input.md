# Task for worker

[Read from: /home/aurel/Documents/github/CSMA-SSMA/CSMA/context.md, /home/aurel/Documents/github/CSMA-SSMA/CSMA/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement the agent-context module plan at `src/modules/agent-context/plan.md`. Read it IN FULL first — it is the spec.

Context:
- We are on git branch `feat/modular-wave`. Your worktree was created from its HEAD.
- Wave 0 ALREADY added `'contextSerializers'` to `MODULE_CONTRIBUTION_TYPES` in `src/runtime/ModuleManifest.js` AND added `contextSerializers: 'serializer'` mapping in `src/runtime/ModuleManager.js`. You do NOT need to redo that. (Verify it's there before starting; if so, skip plan Phase 1 step 1–2.)
- Repo is CSMA. Read `AGENTS.md` for architecture rules.
- Decision 1a: in-browser API ONLY for v1. NO MCP server transport.

Goal: generic in-browser service that any module uses to expose its state to an AI agent, with format negotiation. Domain serializers register via `contributes.contextSerializers` in their module manifest; agent-context dispatches.

Scope (phases 1–3 of the plan, plus phase 4 as optional):
1. Phase 1 — Runtime contribution plumbing:
   - Wave 0 already added the type + mapping. Verify.
   - Add a `SerializerRegistry` class (or pattern matching existing registries like commands/panels) — but the registry itself is owned by agent-context, NOT by ModuleManager. The ModuleManager's existing `registerContributions` loop will call `registry.register(moduleId, entry)` IF a registry under key `'serializer'` exists in `this.registries`. So agent-context must register its SerializerRegistry instance into the ModuleManager's registries at init.
   - Read `src/runtime/ModuleManager.js` constructor (line 22) to confirm: `this.registries = registries` — passed in. The bootstrap code that creates ModuleManager must now pass `{ serializer: new SerializerRegistry(...) }`.
   - Find where ModuleManager is constructed (likely in features.js or main bootstrap) and wire it.
2. Phase 2 — `AgentContextService`:
   - `src/modules/agent-context/services/AgentContextService.js`
   - API: `init`, `register`, `unregister`, `stores`, `formats`, `serializers`, `get({store, format, id?, filter?, depth?, cursor?})`, optional `subscribe` (throws clear error if history not loaded)
   - Defaults: `markdown` format, truncate at 50KB with `truncated:true` + cursor
   - Fallback to generic formatters when no domain serializer registered
3. Phase 3 — Generic formatters `src/modules/agent-context/services/formatters/`:
   - `MarkdownFormatter.js`, `JsonFormatter.js`, `AsciiFormatter.js`
   - Best-effort over arbitrary record shapes (per plan §3)
4. Phase 4 (optional, do it) — History subscription gating. If history module present, `subscribe()` works. Else throws `[AgentContext] subscription requires history module`. NOTE: history module is being built in parallel (Wave 1-B) — your code should feature-detect, not hard-depend.
5. Phase 5 — README + skill doc update at end (keep README concise)

Module manifest `src/modules/agent-context/index.js`:
- `id: 'agent-context'`
- `dependencies: []` (or `['history']` if you make subscribe feature-detect at manifest level — prefer runtime detection)
- `services: ['agentContext']`
- `contracts: Object.keys(AgentContextContracts)`
- `contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }` (no serializers itself; it OWNS the registry, doesn't contribute to it)

Contracts (`contracts/agent-context-contracts.js`):
- `AGENT_CONTEXT_QUERIED`, `AGENT_CONTEXT_REGISTERED`, `AGENT_CONTEXT_UNREGISTERED`, `AGENT_CONTEXT_INVALIDATED`

Tests (per plan §Tests):
- `tests/agent-context/serializer-registry.test.js`
- `tests/agent-context/formatters.test.js`
- `tests/agent-context/agent-context-service.test.js` (end-to-end with stub module)
- `tests/agent-context/agent-context-subscription.test.js` (gated on history presence)

Critical:
- All 748 existing tests must still pass after your changes.
- The ModuleManager constructor wiring change is the riskiest part — verify with the existing ModuleManager tests.

Out of scope:
- MCP server transport (deferred per decision 1a)
- Streaming responses
- Auth/authz of agent callers (assume same-origin trusted)
- Caching of serialized output

When done:
- Commit in your worktree: `feat(agent-context): generic in-browser LLM context API with format dispatch (Wave 1-C)`
- Return summary: files created/modified, test results, deviations + why.

Open questions: take 'lean' default, document. Don't block.

If real blocker: write `BLOCKER.md`, commit, return text in summary.

---
Update progress at: /home/aurel/Documents/github/CSMA-SSMA/CSMA/.pi-subagents/artifacts/progress/8790811b/progress.md

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