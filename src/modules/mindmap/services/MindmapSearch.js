/**
 * MindmapSearch - agent-facing fuzzy search over the active mindmap.
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Mixed onto
 * MindmapService.prototype by MindmapService.js; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 */

export const MindmapSearch = {
  // ─── Search ──────────────────────────────────────────────────────
  // (Legacy 3-arg `search(mapId, …)` removed; the agent-facing
  // `search(query, {status, tag})` below is the single canonical method.)
  /** Fuzzy-search the active map; returns matches with ancestor topic path. */
  search(query, { status = null, tag = null } = {}) {
    const root = this._getMap(this._activeMapId)?.root;
    if (!root) return [];
    const matches = this.searcher.search(root, query, { status, tag });
    return matches.map((m) => ({
      id: m.nodeId,
      topic: m.topic,
      status: m.status,
      tag: m.tag || null,
      path: (m.path || []).map((p) => p.topic),
    }));
  },
};
