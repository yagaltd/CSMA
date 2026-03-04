## CSMA Contract Split & Registry Refactor Proposal
Modularize CSMA contract definitions while keeping a single runtime registry for validation parity with SSMA.

---

## Objective
Adopt the same "per-module contract + central registry" pattern that SSMA uses so each CSMA feature owns its schemas locally, contracts remain testable beside their services, and `runtime/Contracts.js` only aggregates validated exports for the EventBus.

---

## Current Friction
- **Monolith file**: `src/runtime/Contracts.js` contains all schemas, making diffs noisy and discouraging module teams from touching shared validation rules.
- **Duplication risk**: SSMA already consumes JSON contracts from `/shared/contracts`. Without mirrors on the client, the two sides drift and require manual copy/paste.
- **EventBus churn**: every new module forces edits deep in Contracts.js even when the module is feature-flagged or optional.

---

## Target Architecture
```
src/
  runtime/
    Contracts.js          # central registry (imports + spreads)
    validation/
      contract.js         # unchanged helper
  modules/
    <module>/
      contracts/
        <module>-contracts.js  # ECCA-compliant schemas + metadata
```

- **One registry** (`Contracts.js`) continues to export a single object the EventBus can trust.
- **Module-scoped definitions** live beside their services/tests, promoting ownership and keeping imports tree-shakeable.
- **Shared JSON contracts** under `/shared/contracts/*.json` stay the canonical source for SSMA; CSMA contract files import those (when available) or define higher-level superstruct schemas that match.

---

## Refactor Plan
1. **Inventory** existing contracts inside `runtime/Contracts.js` and group them by module (auth, forms, checkout, analytics, url-fetcher, etc.).
2. **Create contract files** per module (following `modules/url-fetcher/contracts/url-fetcher-contracts.js` as the template) and move the relevant schema blocks there.
3. **Re-export** inside `runtime/Contracts.js` by importing each module’s contract map and spreading it into the final `Contracts` object. Keep base/core contracts (e.g., `MODULE_LOADED`, `SECURITY_VIOLATION`) inline.
4. **Wire tests** so each contract file has its own Vitest assertions (matching SSMA’s `ContractRegistry` checks) before being imported into the runtime.
5. **Update ServiceManager + ModuleManager docs** to note the new expectation: every module must expose a `contracts/` folder and export that namespace in `index.js` for discovery.
6. **Sync automation**: extend `scripts/generate-ai-map.js` (or add a new `scripts/scan-contracts.mjs`) to list module contract files so tooling knows where schemas live.

---

## Risks & Mitigations
- **Missing contract imports** → add CI/Vitest test that ensures `runtime/Contracts.js` references every `modules/*/contracts/*.js` file (glob + dynamic import).
- **Schema drift vs shared JSON** → treat `/shared/contracts/*.json` as canonical; module contracts should import those JSON schemas or expose helper functions that enforce identical fields.
- **Bundle size** → module-level splits actually reduce always-on bundle cost because unused modules (feature flags off) can be tree-shaken when their contracts are not imported.

---

## Success Criteria
- Each CSMA module owns its contract file(s) and tests.
- `runtime/Contracts.js` becomes primarily an aggregator (<200 LOC).
- EventBus requires zero updates when enabling new modules—only the module’s contract export changes.
- `shared/contracts` stays the SSMA ↔ CSMA source of truth, guaranteeing schema parity through sync scripts.
