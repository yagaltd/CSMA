Implemented Wave 1-A typeset per plan phases 1-5.

**Changed files: 7** (5 new, 1 modified, 1 new doc dir)
- `src/style/foundation/typeset.css` (152 LOC) — rhythm engine, `:where()` guard, streaming-safe spacing, opt-out
- `src/style/foundation/typeset-presets.css` (53 LOC) — 6 presets (docs, blog, chat, slides, video, large)
- `src/style/main.css` (+6/-4) — typeset inserted as §4, downstream sections renumbered
- `demo/typeset-demo.{html,js,css}` — interactive rhythm controls + prose preview
- `docs/typeset/SKILL.md` (205 LOC) — agent skill with streaming contract + DoD

**Validation:**
- `npx vitest run`: **748/748 pass** (no new tests — plan doesn't require them for v1)
- `npm run lint:styles`: **0 issues in new files** (13 pre-existing legacy issues in swatch/toggle-card/toggle-grid, unrelated)
- Token audit: 0 `:root` writes (the one grep hit is a header comment). 0 banned streaming selectors in element rules (both grep hits are inside explanatory comments).
- Committed in worktree as `feat(typeset): CSS rhythm engine + presets + demo + skill (Wave 1-A)`.

**Deviations from plan (documented):**
1. **Token name fix.** Plan §3.1 specifies `--ts-color-muted: var(--fg-muted)`, but `--fg-muted` does not exist in CSMA's generated tokens (only `--foreground-muted` does). Used `var(--foreground-muted, var(--foreground))` — nested fallback per plan §5.2 fallback policy, which explicitly anticipates this case.
2. **main.css renumbering.** Inserted Typeset as §4; bumped Hardening/Print/Touch/Components from §4-7 to §5-8 to keep sequential numbering. Cosmetic only, no cascade impact.

**Residual risks:**
- `typeset.css` is 5.5KB unminified, slightly above plan §10.5 target of <5KB (but matches the ~1.5KB gzipped estimate). Acceptable.
- Native CSS nesting (`& h1` inside `:where()`) used per plan §3.4. Supported in all evergreen browsers since 2023; matches CSMA's modern-browser target.

Sibling agents' in-flight work (history/services, agent-context/services, SerializerRegistry.js) correctly left untracked — parent merges those separately.