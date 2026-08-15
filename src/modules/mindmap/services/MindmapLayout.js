/**
 * MindmapLayout - layout direction control and layout/connector convenience
 * entry points for MindmapService.
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Mixed onto
 * MindmapService.prototype by MindmapService.js; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 *
 * Extraction-forced adaptation: the two `MindmapService.measureTextWidth`
 * call sites in layout() now call `measureTextWidth` imported from
 * MindmapTextMeasure.js directly (the class-name reference is out of scope
 * in this module). Identical behavior.
 */

import { now } from './MindmapNode.js';
import { layout as layoutTree } from './LayoutEngine.js';
import { main as mainConnector, sub as subConnector, rectFromNodes, directionClassFor } from './ConnectorGeometry.js';
import { measureTextWidth } from './MindmapTextMeasure.js';

export const MindmapLayout = {
  // ─── Layout direction ───────────────────────────────────────────

  async setLayoutDirection(direction, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    if (![0, 1, 2, 3].includes(direction)) {
      throw new Error('[MindmapService] direction must be 0 (left), 1 (right), 2 (side), or 3 (down)');
    }
    const previousDirection = map.meta.layoutDirection;
    const previousChildDirections = (map.root.children || []).map((c) => ({ id: c.id, direction: c.direction }));
    // Set direction on root children based on global layout
    for (const child of map.root.children) {
      if (direction === 2) {
        // side layout: alternate left/right
        const idx = map.root.children.indexOf(child);
        child.direction = idx % 2 === 0 ? 0 : 1;
      } else if (direction === 3) {
        // down layout: LayoutEngine treats an unset `direction` as "down",
        // so clear the side field instead of stamping the numeric 3.
        child.direction = undefined;
      } else {
        child.direction = direction;
      }
    }
    map.meta.layoutDirection = direction;
    map.meta.updatedAt = now();
    map.root.updatedAt = now();
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'setLayoutDirection',
        mapId: map.meta.id,
        direction,
        previousDirection,
        previousChildDirections
      });
    }
    // Persist root children (their direction fields changed)
    for (const child of map.root.children) {
      await this._persistNode(map.meta.id, child);
    }
    await this._persistNode(map.meta.id, map.root);
    this._publish('MINDMAP_STRUCTURE_CHANGED', {
      mapId: map.meta.id,
      nodeId: map.root.id,
      operation: 'setLayoutDirection',
      details: { direction }
    });
  },

  getLayoutDirection(mapId) {
    const map = this._getMap(mapId);
    if (!map) return 1; // default to right
    return typeof map.meta.layoutDirection === 'number' ? map.meta.layoutDirection : 1;
  },

  // ─── Layout convenience (renderers call this) ────────────────────

  layout(mapId, options = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return { nodes: [], links: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };
    // Inject the map's layout direction (numeric 0/1/2/3) so LayoutEngine
    // can select the DOWN vs SIDE branch. Caller options override if set.
    const opts = { direction: map.meta.layoutDirection ?? 1, ...options };
    // Default sizing: fixed unless callbacks provided.
    if (!opts.getWidth) {
      const svc = this;
      opts.getWidth = (node) => {
        if (node._cachedWidth == null) {
          const topicW = measureTextWidth(node.topic || 'Untitled');
          const tagW = node.tag ? measureTextWidth(node.tag) + 28 : 0;
          const noteW = (node.metadata?.note || node.notes) ? 24 : 0;
          node._cachedWidth = Math.ceil(Math.max(64, topicW + tagW + noteW + 36));
        }
        return node._cachedWidth;
      };
    }
    if (!opts.getHeight) {
      opts.getHeight = () => 48;
    }
    // Pass spacing to LayoutEngine (does not bloat node dimensions).
    if (opts.columnGap == null) opts.columnGap = options.columnGap ?? 80;
    if (opts.siblingGap == null) opts.siblingGap = options.siblingGap ?? 12;
    return layoutTree(map.root, opts);
  },

  /**
   * Build SVG path `d` strings for every link produced by layout().
   * Returns [{link, d}] so renderers can stamp <path> elements directly.
   */
  connectorPaths(mapId, options = {}) {
    const { nodes, links } = this.layout(mapId, options);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out = [];
    for (const link of links) {
      const parent = byId.get(link.from);
      const child = byId.get(link.to);
      if (!parent || !child) continue;
      const rect = rectFromNodes(parent, child);
      const dirClass = directionClassFor(link);
      const containerHeight = options.containerHeight || 600;
      const isFirst = parent.kind === 'root';
      const d = link.kind === 'main'
        ? mainConnector(rect, { direction: dirClass, containerHeight })
        : subConnector(rect, { direction: dirClass, isFirst });
      out.push({ link, d });
    }
    return out;
  },

};
