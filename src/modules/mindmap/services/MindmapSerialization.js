/**
 * MindmapSerialization - markdown / ascii / minimal-json export for
 * MindmapService (agent-context formats).
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Mixed onto
 * MindmapService.prototype by MindmapService.js; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 */

export const MindmapSerialization = {
  // ─── Serialization ───────────────────────────────────────────────

  toMarkdown(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return '';
    const { focusIds, scope, ...rest } = opts || {};
    const root = map.root;
    const pruned = Array.isArray(focusIds) && focusIds.length
      ? this._prune(root, this._computeEffectiveIds(root, focusIds, scope === 'subtree' ? 'subtree' : 'branch'))
      : root;
    return this.codec.serialize(pruned, { format: 'markdown', ...rest });
  },

  toAscii(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return '';
    return this.codec.serialize(map.root, { format: 'ascii', ...opts });
  },

  toMinimalJson(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return null;
    const { focusIds, scope, ...rest } = opts || {};
    const root = map.root;
    const pruned = Array.isArray(focusIds) && focusIds.length
      ? this._prune(root, this._computeEffectiveIds(root, focusIds, scope === 'subtree' ? 'subtree' : 'branch'))
      : root;
    return this.codec.serialize(pruned, { format: 'json', ...rest });
  },

};
