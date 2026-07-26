/**
 * FocusController — Wave 3 focus / isolation for the CSMA mindmap.
 *
 * Owns the focus set (seed node ids) + scope, computes the set of
 * "effective" node ids (ancestors + descendants for 'branch' scope,
 * descendants only for 'subtree' scope), and applies visual focus to the
 * live DOM. Also serializes the focused subtree for agent context.
 *
 * Tree math (parent index, effective-id computation, pruning) lives on
 * MindmapService so both the UI (this controller) and the agent-context
 * serializers (toMarkdown / toMinimalJson with { focusIds }) can reuse it
 * without instantiating a controller.
 */

export class FocusController {
  /**
   * @param {object} opts
   * @param {import('./MindmapService.js').MindmapService} opts.service
   * @param {object} [opts.eventBus]
   * @param {HTMLElement} opts.nodeLayer
   * @param {SVGElement} opts.svgLayer
   * @param {string} opts.mapId
   * @param {() => object|null} opts.getRoot
   * @param {(state: {focusIds:string[], scope:string, active:boolean}) => void} [opts.onChange]
   */
  constructor({ service, eventBus, nodeLayer, svgLayer, mapId, getRoot, onChange }) {
    this._service = service;
    this._eventBus = eventBus || null;
    this._nodeLayer = nodeLayer || null;
    this._svgLayer = svgLayer || null;
    this._mapId = mapId || null;
    this._getRoot = getRoot || (() => null);
    this._onChange = onChange || null;
    /** @type {Set<string>} */
    this._focusSet = new Set();
    this._scope = 'branch';
  }

  // ─── focus set mutations ────────────────────────────────────────

  focusNode(nodeId, { scope } = {}) {
    this._focusSet = new Set(nodeId ? [nodeId] : []);
    if (scope) this._scope = scope;
    this._changed();
  }

  focusNodes(nodeIds, { scope } = {}) {
    this._focusSet = new Set(Array.isArray(nodeIds) ? nodeIds : []);
    if (scope) this._scope = scope;
    this._changed();
  }

  addToFocus(nodeId) {
    if (nodeId) this._focusSet.add(nodeId);
    this._changed();
  }

  removeFromFocus(nodeId) {
    this._focusSet.delete(nodeId);
    this._changed();
  }

  toggleFocus(nodeId) {
    if (!nodeId) return;
    if (this._focusSet.has(nodeId)) this._focusSet.delete(nodeId);
    else this._focusSet.add(nodeId);
    this._changed();
  }

  clearFocus() {
    this._focusSet.clear();
    this._changed();
  }

  setScope(scope) {
    this._scope = scope === 'subtree' ? 'subtree' : 'branch';
    this._changed();
  }

  // ─── derived ─────────────────────────────────────────────────────

  get isActive() {
    return this._focusSet.size > 0;
  }

  get focusIds() {
    return Array.from(this._focusSet);
  }

  get effectiveIds() {
    const root = this._getRoot();
    if (!root) return [];
    return Array.from(this._service._computeEffectiveIds(root, this.focusIds, this._scope));
  }

  // ─── DOM application ─────────────────────────────────────────────

  apply() {
    if (!this._nodeLayer || !this._svgLayer) return;
    const eff = new Set(this.effectiveIds);
    const canvas = this._nodeLayer.parentElement;
    if (this.isActive) canvas?.setAttribute('data-mode', 'focus');
    else canvas?.removeAttribute('data-mode');

    this._nodeLayer.querySelectorAll('.branch-node[data-node-id]').forEach((el) => {
      if (eff.has(el.dataset.nodeId)) el.setAttribute('data-in-focus', '');
      else el.removeAttribute('data-in-focus');
    });
    this._svgLayer.querySelectorAll('.connector-line[data-child-id]').forEach((el) => {
      if (eff.has(el.dataset.childId)) el.setAttribute('data-in-focus', '');
      else el.removeAttribute('data-in-focus');
    });
  }

  // ─── context capture ────────────────────────────────────────────

  /**
   * Serialize the focused subtree (always connected — ancestors included —
   * so the agent gets self-contained context regardless of visual scope).
   * @param {{format?: 'markdown'|'json'}} [opts]
   * @returns {string}
   */
  exportContext({ format = 'markdown' } = {}) {
    const root = this._getRoot();
    if (!root) return '';
    const eff = this._service._computeEffectiveIds(root, this.focusIds, 'branch');
    const pruned = this._service._prune(root, eff);
    return this._service.codec.serialize(pruned, { format: format === 'json' ? 'json' : 'markdown' });
  }

  async copyContext({ format = 'markdown' } = {}) {
    const text = this.exportContext({ format });
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return text;
      }
    } catch { /* fall through to legacy path */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch { /* ignore */ }
    return text;
  }

  // ─── internals ──────────────────────────────────────────────────

  _changed() {
    const state = { focusIds: this.focusIds, scope: this._scope, active: this.isActive };
    if (this._service && typeof this._service._publish === 'function') {
      try {
        this._service._publish('MINDMAP_FOCUS_CHANGED', { mapId: this._mapId, ...state });
      } catch { /* swallow validation errors; onChange still fires */ }
    }
    if (typeof this._onChange === 'function') this._onChange(state);
  }
}
