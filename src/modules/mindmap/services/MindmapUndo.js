/**
 * MindmapUndo - undo/redo orchestration and history-op reversal for
 * MindmapService.
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Mixed onto
 * MindmapService.prototype by MindmapService.js; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 */

import { now, SCHEMA_LEAF } from './MindmapNode.js';

export const MindmapUndo = {
  // ─── Undo / Redo ─────────────────────────────────────────────────

  canUndo() { return this.history ? Boolean(this.history.canUndo?.()) : false; },
  canRedo() { return this.history ? Boolean(this.history.canRedo?.()) : false; },

  async undo(options = {}) {
    if (!this.history) return null;
    const entry = this.history.undo(options);
    // State reversal handled by _onHistoryReversed subscription; return summary.
    if (!entry) return null;
    return { op: entry.payload?.op, nodeId: entry.payload?.nodeId };
  },

  async redo(options = {}) {
    if (!this.history) return null;
    const entry = this.history.redo(options);
    if (!entry) return null;
    return { op: entry.payload?.op, nodeId: entry.payload?.nodeId };
  },

  /**
   * Called by HISTORY_OP_UNDONE / _REDONE subscriptions. Reverses (on
   * undo) or re-applies (on redo) the state change described by the
   * entry payload, without recording a new history op.
   */
  async _onHistoryReversed(payload, direction) {
    const entryId = payload?.entry?.id;
    if (!entryId || !this.history) return;
    const entry = this.history.getEntry?.(entryId);
    if (!entry || entry.intent !== 'mindmap') return;
    const op = entry.payload?.op;
    if (!op) return;
    this._applyingHistoryOp = true;
    try {
      if (direction === 'undo') {
        await this._revertOp(entry.payload);
      } else {
        await this._reapplyOp(entry.payload);
      }
    } finally {
      this._applyingHistoryOp = false;
    }
  },

  async _revertOp(p) {
    const opts = { mapId: p.mapId, skipHistory: true };
    switch (p.op) {
      case 'addBranch':
      case 'addLeaf':
        await this.removeNode(p.node.id, opts);
        break;
      case 'removeNode': {
        const map = this._getMap(p.mapId);
        if (!map) break;
        const { node: parent } = this._findNodeAndParent(map.root, p.parentBefore?.[0]) || {};
        // Re-insert tree at original position under original parent.
        await this._restoreRemovedTree(p.removed, p.parentBefore, opts);
        break;
      }
      case 'updateNode':
        await this.updateNode(p.nodeId, p.before || {}, opts);
        break;
      case 'moveNode': {
        // Move back to old parent at the original index in parentBefore.
        await this.moveNode(p.nodeId, p.fromParent, this._indexIn(p.oldParentBefore, p.nodeId), opts);
        break;
      }
      case 'collapse':
        await this.collapse(p.nodeId, p.before === false, opts);
        break;
      case 'insertSibling':
      case 'insertParent':
        await this.removeNode(p.node.id, opts);
        break;
      case 'moveUp': {
        // reverse: move back down (swap with next sibling)
        const { node: moved, parent } = this._findNodeAndParent((this._getMap(p.mapId) || {}).root, p.nodeId);
        if (moved && parent) {
          const idx = parent.children.indexOf(moved);
          if (idx >= 0 && idx < parent.children.length - 1) {
            parent.children.splice(idx, 1);
            parent.children.splice(idx + 1, 0, moved);
          }
        }
        break;
      }
      case 'moveDown': {
        const { node: moved, parent } = this._findNodeAndParent((this._getMap(p.mapId) || {}).root, p.nodeId);
        if (moved && parent) {
          const idx = parent.children.indexOf(moved);
          if (idx > 0) {
            parent.children.splice(idx, 1);
            parent.children.splice(idx - 1, 0, moved);
          }
        }
        break;
      }
      case 'setLayoutDirection':
        if (typeof p.previousDirection === 'number') {
          await this.setLayoutDirection(p.previousDirection, opts);
        }
        break;
      case 'addArrow':
        await this.removeArrow(p.arrow.id, { mapId: p.mapId, skipHistory: true });
        break;
      case 'removeArrow':
        await this._restoreArrow(p.mapId, p.arrow, { skipHistory: true });
        break;
      case 'updateArrow':
        await this.updateArrow(p.arrowId, p.before, { mapId: p.mapId, skipHistory: true });
        break;
      default:
        break;
    }
  },

  async _reapplyOp(p) {
    const opts = { mapId: p.mapId, skipHistory: true };
    switch (p.op) {
      case 'addBranch':
      case 'addLeaf':
        // Restore the SAME node object (preserve id) so subsequent ops
        // that reference p.node.id resolve correctly.
        await this._restoreNode(p.parentId, p.node, opts);
        break;
      case 'removeNode':
        await this.removeNode(p.nodeId, opts);
        break;
      case 'updateNode': {
        const after = p.after || {};
        await this.updateNode(p.nodeId, after, opts);
        break;
      }
      case 'moveNode':
        await this.moveNode(p.nodeId, p.toParent, p.index, opts);
        break;
      case 'collapse':
        await this.collapse(p.nodeId, p.after === false, opts);
        break;
      case 'insertSibling':
        await this._restoreNode(p.parentId, p.node, opts);
        break;
      case 'insertParent':
        // Restore: add parent back under grandparent at same index.
        await this._restoreNode(p.grandparentId, p.node, opts);
        // Then remove the original from the restored parent's children
        // and place it back as a direct child of grandparent.
        // The restored node already has originalNodeId as a child,
        // but we need to collapse the insertParent by removing the wrapper.
        // For simplicity, we restore the tree as-persisted; the redo
        // handler fires a STRUCTURE_CHANGED event to prompt re-render.
        break;
      case 'moveUp':
      case 'moveDown': {
        // Replay: same op again
        const fn = p.op === 'moveUp' ? this.moveUp.bind(this) : this.moveDown.bind(this);
        await fn(p.nodeId, opts);
        break;
      }
      case 'setLayoutDirection':
        await this.setLayoutDirection(p.direction, opts);
        break;
      case 'addArrow':
        await this._restoreArrow(p.mapId, p.arrow, { skipHistory: true });
        break;
      case 'removeArrow':
        await this.removeArrow(p.arrow.id, { mapId: p.mapId, skipHistory: true });
        break;
      case 'updateArrow':
        await this.updateArrow(p.arrowId, p.after, { mapId: p.mapId, skipHistory: true });
        break;
      default:
        break;
    }
  },

  /**
   * Restore an exact arrow object (same id) into the map. Used by
   * undo/redo so arrow ids stay stable across history ops.
   */
  async _restoreArrow(mapId, arrow, options = {}) {
    const map = this._getMap(mapId);
    if (!map) return;
    if (!Array.isArray(map.arrows)) map.arrows = [];
    map.arrows.push(arrow);
    if (this.store?.putMap) await this.store.putMap(map);
    this._publish('MINDMAP_ARROW_ADDED', { mapId: map.meta.id, arrow });
  },

  /**
   * Restore an exact node object (same id) under a parent. Used by redo
   * for addBranch/addLeaf so dependent ops (updateStatus, moveNode) can
   * still find the node by id.
   */
  async _restoreNode(parentId, node, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node: parent } = this._findNodeAndParent(map.root, parentId);
    if (!parent) throw new Error(`[MindmapService] parent ${parentId} not found`);
    if (parent.schemaType === SCHEMA_LEAF) {
      throw new Error('[MindmapService] cannot restore under a leaf');
    }
    parent.children = parent.children || [];
    parent.children.push(node);
    parent.updatedAt = now();
    this._recomputeBranchCounts(parent);
    this._recomputeBranchCounts(map.root);
    await this._persistTree(map.meta.id, node);
    await this._persistNode(map.meta.id, parent);
    this._publish('MINDMAP_NODE_ADDED', {
      mapId: map.meta.id,
      nodeId: node.id,
      parentId,
      node: { id: node.id, topic: node.topic, schemaType: node.schemaType, status: node.status }
    });
    return node;
  },

  _indexIn(idList, nodeId) {
    if (!Array.isArray(idList)) return undefined;
    return idList.indexOf(nodeId);
  },

  async _restoreRemovedTree(removed, parentBefore) {
    if (!removed) return;
    const map = this._getMap();
    if (!map) return;
    // Find parent by first id in parentBefore (which holds the sibling order before removal).
    // Heuristic: parent is whatever node currently contains parentBefore siblings.
    const findParent = (root) => {
      const stack = [root];
      while (stack.length) {
        const n = stack.pop();
        if (Array.isArray(n.children)) {
          const childIds = n.children.map((c) => c.id);
          if (parentBefore.every((id) => id === removed.id || childIds.includes(id))) return n;
          for (const c of n.children) stack.push(c);
        }
      }
      return null;
    };
    const parent = findParent(map.root);
    if (!parent) return;
    const insertAt = parentBefore.indexOf(removed.id);
    parent.children.splice(insertAt < 0 ? parent.children.length : insertAt, 0, removed);
    this._recomputeBranchCounts(map.root);
    await this._persistTree(map.meta.id, removed);
  },
};
