/**
 * MindmapArrows - cross-link graph edges (11) and focus requests for
 * MindmapService.
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Mixed onto
 * MindmapService.prototype by MindmapService.js; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 */

import { uid } from '../../../utils/id.js';
import { arrowPath } from './ArrowGeometry.js';

export const MindmapArrows = {
  // ─── Arrows (§11 cross-link graph edges) ──────────────────────────

  getArrows(mapId) {
    const map = this._getMap(mapId);
    return map?.arrows || [];
  },

  async addArrow(fromId, toId, { direction = 'forward', label = null, style = null, skipHistory = false } = {}) {
    const map = this._getMap();
    if (!map) throw new Error('[MindmapService] no active map for addArrow');
    if (fromId === toId) throw new Error('[MindmapService] arrow cannot connect a node to itself');
    const { node: fromNode } = this._findNodeAndParent(map.root, fromId);
    const { node: toNode } = this._findNodeAndParent(map.root, toId);
    if (!fromNode || !toNode) throw new Error('[MindmapService] arrow endpoints must exist in the map');
    // Reject structural (tree) edges — arrows are true cross-links only.
    if (this._isDescendantOf(fromNode, toId) || this._isDescendantOf(toNode, fromId)) {
      throw new Error('[MindmapService] arrow cannot duplicate a structural tree edge');
    }
    if (!Array.isArray(map.arrows)) map.arrows = [];
    const arrow = {
      id: `arrow-${uid()}`,
      from: fromId,
      to: toId,
      direction,
      label: label || undefined,
      style: style || undefined,
    };
    map.arrows.push(arrow);
    if (this.store?.putMap) await this.store.putMap(map);
    if (!skipHistory) this._recordOp('mindmap', { op: 'addArrow', mapId: map.meta.id, arrow });
    this._publish('MINDMAP_ARROW_ADDED', { mapId: map.meta.id, arrow });
    return arrow;
  },

  async removeArrow(arrowId, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map?.arrows?.length) return false;
    const idx = map.arrows.findIndex((a) => a.id === arrowId);
    if (idx === -1) return false;
    const [removed] = map.arrows.splice(idx, 1);
    if (this.store?.putMap) await this.store.putMap(map);
    if (!options.skipHistory) this._recordOp('mindmap', { op: 'removeArrow', mapId: map.meta.id, arrow: removed });
    this._publish('MINDMAP_ARROW_REMOVED', { mapId: map.meta.id, arrowId });
    return true;
  },

  async updateArrow(arrowId, changes = {}, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map?.arrows) return null;
    const arrow = map.arrows.find((a) => a.id === arrowId);
    if (!arrow) return null;
    const before = { ...arrow };
    Object.assign(arrow, changes);
    if (this.store?.putMap) await this.store.putMap(map);
    if (!options.skipHistory) this._recordOp('mindmap', { op: 'updateArrow', mapId: map.meta.id, arrowId, before, after: { ...arrow } });
    this._publish('MINDMAP_ARROW_UPDATED', { mapId: map.meta.id, arrow });
    return arrow;
  },

  /** Compute SVG paths for every arrow using LayoutEngine rects. */
  arrowPaths(mapId) {
    const map = this._getMap(mapId);
    if (!map?.arrows?.length) return [];
    const { nodes } = this.layout(mapId);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out = [];
    for (const arrow of map.arrows) {
      const from = byId.get(arrow.from);
      const to = byId.get(arrow.to);
      if (!from || !to) continue;
      const { d } = arrowPath(from, to, { curved: arrow.style?.curved !== false });
      out.push({ d, arrow });
    }
    return out;
  },

  /** Agent/UI entry point to isolate a node set on the live surface (§11.9 / Wave 3 focus). */
  requestFocus(nodeIds, { scope = 'branch' } = {}) {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    if (!ids.length) return;
    this._publish('MINDMAP_FOCUS_REQUESTED', { mapId: this._activeMapId, focusIds: ids, scope });
  },

};
