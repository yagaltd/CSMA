/**
 * MindmapService — interactive local-first mindmap for CSMA.
 *
 * Owns the in-memory NodeObj tree and persists via MindmapStore. Every
 * mutating call records an op to the history module so undo/redo work
 * uniformly. All state changes fire a MINDMAP_* EventBus event validated
 * via Contracts.
 *
 * The service is sync-agnostic and local-only in v1: no SSMA gateway,
 * no SQLite, no multi-device reconciliation. See plan.md §Out of scope.
 *
 * Open questions resolved (lean defaults):
 *   1. Active-map persistence: remembered in localStorage 'mindmap:active'.
 *   2. IDs in markdown output: omitted by default, opt-in via {ids:true}.
 *   3. Layout on resize: debounced recompute (handled by the renderer
 *      adapter, not this service).
 *   4. Empty map root in markdown: omitted (synthetic container).
 */

import { MindmapStore } from './MindmapStore.js';
import { MarkdownCodec } from './MarkdownCodec.js';
import { Search } from './Search.js';
import { layout as layoutTree } from './LayoutEngine.js';
import { main as mainConnector, sub as subConnector, rectFromNodes, directionClassFor } from './ConnectorGeometry.js';

const ACTIVE_MAP_KEY = 'mindmap:active';
const SCHEMA_BRANCH = 'mindmap/branch';
const SCHEMA_LEAF = 'mindmap/leaf';

function generateId(prefix = 'n') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return Date.now();
}

function makeRoot(name) {
  return {
    id: generateId('root'),
    topic: name,
    schemaType: SCHEMA_BRANCH,
    status: 'pending',
    children: [],
    expanded: true,
    direction: 0,
    metadata: { leafCount: 0, doneCount: 0 },
    updatedAt: now()
  };
}

function makeBranch(topic, meta = {}) {
  return {
    id: generateId('branch'),
    topic,
    schemaType: SCHEMA_BRANCH,
    status: meta.status || 'pending',
    tag: meta.tag || 'module',
    children: [],
    expanded: true,
    direction: 0,
    metadata: { leafCount: 0, doneCount: 0, ...(meta.metadata || {}) },
    updatedAt: now()
  };
}

function makeLeaf(topic, meta = {}) {
  return {
    id: generateId('leaf'),
    topic,
    schemaType: SCHEMA_LEAF,
    status: meta.status || 'pending',
    children: [],
    metadata: {
      specPath: meta.specPath || null,
      bottleneck: meta.bottleneck || 'standard',
      note: meta.note || null,
      leafCount: 0,
      doneCount: 0
    },
    updatedAt: now()
  };
}

export class MindmapService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.store = null;
    this.history = null;
    this.agentContext = null;
    this.aiui = null;
    this.codec = new MarkdownCodec();
    this.searcher = new Search();
    this._maps = new Map();      // mapId → { meta, root }
    this._activeMapId = null;
    this._undoHandler = null;
    this._redoHandler = null;
    this._applyingHistoryOp = false;
  }

  init({ storage = null, history = null, agentContext = null, aiui = null, store = null } = {}) {
    this.store = store || new MindmapStore({ storage });
    this.history = history || null;
    this.agentContext = agentContext || null;
    this.aiui = aiui || null;

    // Restore last active map from localStorage (lean default for open Q1).
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(ACTIVE_MAP_KEY);
        if (stored) this._activeMapId = stored;
      } catch { /* ignore */ }
    }

    // Subscribe to history so undo/redo actually reverse state changes.
    if (this.history && this.eventBus) {
      this._undoHandler = (payload) => this._onHistoryReversed(payload, 'undo');
      this._redoHandler = (payload) => this._onHistoryReversed(payload, 'redo');
      try {
        this.eventBus.subscribe('HISTORY_OP_UNDONE', this._undoHandler);
        this.eventBus.subscribe('HISTORY_OP_REDONE', this._redoHandler);
      } catch { /* tests without eventBus subscription support */ }
    }

    // Register serializers with agent-context (if available).
    if (this.agentContext && typeof this.agentContext.register === 'function') {
      this._registerSerializers();
    }
  }

  destroy() {
    if (this.eventBus && this._undoHandler) {
      try {
        this.eventBus.unsubscribe('HISTORY_OP_UNDONE', this._undoHandler);
        this.eventBus.unsubscribe('HISTORY_OP_REDONE', this._redoHandler);
      } catch { /* noop */ }
    }
    this._maps.clear();
  }

  _registerSerializers() {
    // Serializer functions are bound to this service so they have access
    // to the in-memory tree without a storage round-trip.
    const svc = this;
    this.agentContext.register({
      store: 'map_nodes',
      format: 'markdown',
      fn: (data, opts) => svc.toMarkdown(typeof opts?.mapId === 'string' ? opts.mapId : svc._activeMapId, opts || {}),
      label: 'Mindmap (markdown)',
      default: true,
      moduleId: 'mindmap'
    });
    this.agentContext.register({
      store: 'map_nodes',
      format: 'ascii',
      fn: (data, opts) => svc.toAscii(typeof opts?.mapId === 'string' ? opts.mapId : svc._activeMapId, opts || {}),
      label: 'Mindmap (ascii tree)',
      moduleId: 'mindmap'
    });
    this.agentContext.register({
      store: 'map_nodes',
      format: 'json',
      fn: (data, opts) => svc.toMinimalJson(typeof opts?.mapId === 'string' ? opts.mapId : svc._activeMapId, opts || {}),
      label: 'Mindmap (minimal JSON)',
      moduleId: 'mindmap'
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  _publish(eventName, payload) {
    if (!this.eventBus) return;
    try {
      this.eventBus.publish(eventName, payload);
    } catch (err) {
      // EventBus may reject unknown events when contracts are strict; in
      // tests we publish anyway via publishSync if available.
      if (typeof this.eventBus.publishSync === 'function') {
        try { this.eventBus.publishSync(eventName, payload); } catch { /* swallow */ }
      }
    }
  }

  _getMap(mapId) {
    const id = mapId || this._activeMapId;
    if (!id) return null;
    return this._maps.get(id) || null;
  }

  _setActive(mapId) {
    this._activeMapId = mapId;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(ACTIVE_MAP_KEY, mapId); } catch { /* ignore */ }
    }
  }

  _findNodeAndParent(root, nodeId) {
    if (!root) return { node: null, parent: null };
    if (root.id === nodeId) return { node: root, parent: null };
    const stack = [{ node: root, parent: null }];
    while (stack.length) {
      const { node, parent } = stack.pop();
      if (node.id === nodeId) return { node, parent };
      const kids = Array.isArray(node.children) ? node.children : [];
      for (const k of kids) stack.push({ node: k, parent: node });
    }
    return { node: null, parent: null };
  }

  _recomputeBranchCounts(branch) {
    if (!branch || !Array.isArray(branch.children)) return;
    let leafCount = 0;
    let doneCount = 0;
    for (const child of branch.children) {
      if (child.schemaType === SCHEMA_LEAF) {
        leafCount += 1;
        if (child.status === 'done') doneCount += 1;
      } else {
        this._recomputeBranchCounts(child);
        leafCount += child.metadata?.leafCount || 0;
        doneCount += child.metadata?.doneCount || 0;
      }
    }
    branch.metadata = { ...(branch.metadata || {}), leafCount, doneCount };
  }

  async _persistNode(mapId, node) {
    if (!this.store) return;
    await this.store.putNode({ ...node, mapId });
  }

  async _persistTree(mapId, node) {
    await this._persistNode(mapId, node);
    if (Array.isArray(node.children)) {
      for (const c of node.children) await this._persistTree(mapId, c);
    }
  }

  _recordOp(intent, payload, options = {}) {
    if (!this.history || this._applyingHistoryOp) return null;
    return this.history.record(intent, payload, options);
  }

  // ─── Maps ────────────────────────────────────────────────────────

  async createMap(name) {
    const mapId = generateId('map');
    const root = makeRoot(name || 'Untitled map');
    const meta = { id: mapId, name, rootId: root.id, createdAt: now(), updatedAt: now() };
    this._maps.set(mapId, { meta, root });
    if (this.store) {
      await this.store.putMap(meta);
      await this.store.putNode({ ...root, mapId });
    }
    this._setActive(mapId);
    this._publish('MINDMAP_MAP_CREATED', { mapId, name });
    return mapId;
  }

  async listMaps() {
    if (this.store) {
      const fromStore = await this.store.listMaps();
      const result = [];
      for (const meta of fromStore) {
        if (this._maps.has(meta.id)) {
          result.push(this._maps.get(meta.id).meta);
        } else {
          result.push(meta);
        }
      }
      return result;
    }
    return Array.from(this._maps.values()).map((m) => m.meta);
  }

  async loadMap(mapId) {
    if (this._maps.has(mapId)) {
      this._setActive(mapId);
      return this._maps.get(mapId).root;
    }
    if (!this.store) return null;
    const meta = await this.store.getMap(mapId);
    if (!meta) return null;
    const nodes = await this.store.getAllNodes();
    const byId = new Map(nodes.filter((n) => n.mapId === mapId).map((n) => [n.id, n]));
    const root = byId.get(meta.rootId);
    if (!root) return null;
    const attachChildren = (node) => {
      const stripped = { ...node };
      delete stripped.mapId;
      stripped.children = [];
      return stripped;
    };
    // Reconstruct via root.children ids (persisted as part of NodeObj).
    const reconstruct = (node) => {
      const stripped = attachChildren(node);
      if (Array.isArray(node.children)) {
        stripped.children = node.children
          .map((c) => (typeof c === 'string' ? byId.get(c) : c))
          .filter(Boolean)
          .map(reconstruct);
      }
      return stripped;
    };
    const tree = reconstruct(root);
    this._maps.set(mapId, { meta, root: tree });
    this._setActive(mapId);
    return tree;
  }

  async deleteMap(mapId) {
    this._maps.delete(mapId);
    if (this.store) {
      await this.store.deleteNodesForMap(mapId);
      await this.store.deleteMap(mapId);
    }
    if (this._activeMapId === mapId) this._activeMapId = null;
    this._publish('MINDMAP_MAP_DELETED', { mapId });
  }

  // ─── Node CRUD ───────────────────────────────────────────────────

  async addBranch(parentId, topic, meta = {}, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map; call createMap or loadMap first');
    const { node: parent } = this._findNodeAndParent(map.root, parentId);
    if (!parent) throw new Error(`[MindmapService] parent ${parentId} not found`);
    if (parent.schemaType === SCHEMA_LEAF) {
      throw new Error('[MindmapService] cannot add child to a leaf');
    }
    const branch = makeBranch(topic, meta);
    parent.children = parent.children || [];
    parent.children.push(branch);
    parent.updatedAt = now();
    this._recomputeBranchCounts(parent);
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'addBranch',
        mapId: map.meta.id,
        parentId,
        node: branch
      });
    }
    await this._persistTree(map.meta.id, branch);
    await this._persistNode(map.meta.id, parent);
    this._publish('MINDMAP_NODE_ADDED', {
      mapId: map.meta.id,
      nodeId: branch.id,
      parentId,
      node: { id: branch.id, topic: branch.topic, schemaType: branch.schemaType, status: branch.status }
    });
    return branch;
  }

  async addLeaf(parentId, topic, meta = {}, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node: parent } = this._findNodeAndParent(map.root, parentId);
    if (!parent) throw new Error(`[MindmapService] parent ${parentId} not found`);
    if (parent.schemaType === SCHEMA_LEAF) {
      throw new Error('[MindmapService] cannot add child to a leaf');
    }
    const leaf = makeLeaf(topic, meta);
    parent.children = parent.children || [];
    parent.children.push(leaf);
    parent.updatedAt = now();
    this._recomputeBranchCounts(parent);
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'addLeaf',
        mapId: map.meta.id,
        parentId,
        node: leaf
      });
    }
    await this._persistNode(map.meta.id, leaf);
    await this._persistNode(map.meta.id, parent);
    this._publish('MINDMAP_NODE_ADDED', {
      mapId: map.meta.id,
      nodeId: leaf.id,
      parentId,
      node: { id: leaf.id, topic: leaf.topic, schemaType: leaf.schemaType, status: leaf.status }
    });
    return leaf;
  }

  async updateNode(nodeId, changes, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node } = this._findNodeAndParent(map.root, nodeId);
    if (!node) throw new Error(`[MindmapService] node ${nodeId} not found`);
    const previousStatus = node.status;
    const before = { ...node };
    Object.assign(node, changes, { updatedAt: now() });
    if (changes.metadata) {
      node.metadata = { ...(node.metadata || {}), ...changes.metadata };
    }
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'updateNode',
        mapId: map.meta.id,
        nodeId,
        before,
        after: { ...node }
      });
    }
    await this._persistNode(map.meta.id, node);
    this._publish('MINDMAP_NODE_UPDATED', {
      mapId: map.meta.id,
      nodeId,
      changes,
      previousStatus: previousStatus !== node.status ? previousStatus : undefined
    });
    return node;
  }

  async updateStatus(nodeId, status, options = {}) {
    return this.updateNode(nodeId, { status }, options);
  }

  async removeNode(nodeId, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    if (nodeId === map.root.id) {
      throw new Error('[MindmapService] cannot remove the root node; use deleteMap');
    }
    const { node, parent } = this._findNodeAndParent(map.root, nodeId);
    if (!node) throw new Error(`[MindmapService] node ${nodeId} not found`);
    const cascaded = [];
    const collectIds = (n) => {
      cascaded.push(n.id);
      if (Array.isArray(n.children)) n.children.forEach(collectIds);
    };
    collectIds(node);
    const before = parent.children.map((c) => c.id);
    parent.children = parent.children.filter((c) => c.id !== nodeId);
    parent.updatedAt = now();
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'removeNode',
        mapId: map.meta.id,
        nodeId,
        parentBefore: before,
        removed: node
      });
    }
    if (this.store) await this.store.deleteNodes(cascaded);
    await this._persistNode(map.meta.id, parent);
    this._publish('MINDMAP_NODE_REMOVED', { mapId: map.meta.id, nodeId, cascaded });
    return { removed: cascaded, cascaded };
  }

  async moveNode(nodeId, newParentId, index, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    if (nodeId === map.root.id) throw new Error('[MindmapService] cannot move the root node');
    const { node: moving, parent: oldParent } = this._findNodeAndParent(map.root, nodeId);
    if (!moving) throw new Error(`[MindmapService] node ${nodeId} not found`);
    const { node: newParent } = this._findNodeAndParent(map.root, newParentId);
    if (!newParent) throw new Error(`[MindmapService] target parent ${newParentId} not found`);
    if (newParent.schemaType === SCHEMA_LEAF) throw new Error('[MindmapService] cannot move into a leaf');
    if (newParentId === nodeId || this._isDescendantOf(moving, newParentId)) {
      throw new Error('[MindmapService] cannot move a node into itself or its own descendant');
    }
    const fromParentId = oldParent.id;
    const before = oldParent.children.map((c) => c.id);
    oldParent.children = oldParent.children.filter((c) => c.id !== nodeId);
    newParent.children = newParent.children || [];
    const insertAt = typeof index === 'number' ? Math.max(0, Math.min(index, newParent.children.length)) : newParent.children.length;
    newParent.children.splice(insertAt, 0, moving);
    oldParent.updatedAt = now();
    newParent.updatedAt = now();
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'moveNode',
        mapId: map.meta.id,
        nodeId,
        fromParent: fromParentId,
        toParent: newParentId,
        index: insertAt,
        oldParentBefore: before
      });
    }
    await this._persistNode(map.meta.id, oldParent);
    await this._persistNode(map.meta.id, newParent);
    this._publish('MINDMAP_NODE_MOVED', {
      mapId: map.meta.id,
      nodeId,
      fromParent: fromParentId,
      toParent: newParentId,
      index: insertAt
    });
    return moving;
  }

  _isDescendantOf(node, ancestorId) {
    if (!Array.isArray(node.children)) return false;
    for (const c of node.children) {
      if (c.id === ancestorId) return true;
      if (this._isDescendantOf(c, ancestorId)) return true;
    }
    return false;
  }

  // ─── Structure ───────────────────────────────────────────────────

  async collapse(nodeId, collapsed, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node } = this._findNodeAndParent(map.root, nodeId);
    if (!node) throw new Error(`[MindmapService] node ${nodeId} not found`);
    if (node.schemaType !== SCHEMA_BRANCH) {
      throw new Error('[MindmapService] only branches can be collapsed');
    }
    const previous = node.expanded;
    node.expanded = !collapsed;
    node.updatedAt = now();
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'collapse',
        mapId: map.meta.id,
        nodeId,
        before: previous,
        after: node.expanded
      });
    }
    await this._persistNode(map.meta.id, node);
    this._publish('MINDMAP_COLLAPSED', { mapId: map.meta.id, nodeId, collapsed });
    this._publish('MINDMAP_STRUCTURE_CHANGED', {
      mapId: map.meta.id,
      nodeId,
      operation: collapsed ? 'collapse' : 'expand',
      details: { expanded: node.expanded }
    });
  }

  findNode(nodeId, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) return null;
    return this._findNodeAndParent(map.root, nodeId).node;
  }

  getSubtree(nodeId, { maxDepth = Infinity } = {}, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) return null;
    const { node } = this._findNodeAndParent(map.root, nodeId);
    if (!node) return null;
    const clone = (n, depth) => {
      const out = { ...n };
      if (depth >= maxDepth) {
        out.children = [];
      } else if (Array.isArray(n.children)) {
        out.children = n.children.map((c) => clone(c, depth + 1));
      }
      return out;
    };
    return clone(node, 0);
  }

  // ─── Undo / Redo ─────────────────────────────────────────────────

  canUndo() { return this.history ? Boolean(this.history.canUndo?.()) : false; }
  canRedo() { return this.history ? Boolean(this.history.canRedo?.()) : false; }

  async undo(options = {}) {
    if (!this.history) return null;
    const entry = this.history.undo(options);
    // State reversal handled by _onHistoryReversed subscription; return summary.
    if (!entry) return null;
    return { op: entry.payload?.op, nodeId: entry.payload?.nodeId };
  }

  async redo(options = {}) {
    if (!this.history) return null;
    const entry = this.history.redo(options);
    if (!entry) return null;
    return { op: entry.payload?.op, nodeId: entry.payload?.nodeId };
  }

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
  }

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
      default:
        break;
    }
  }

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
      default:
        break;
    }
  }

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
  }

  _indexIn(idList, nodeId) {
    if (!Array.isArray(idList)) return undefined;
    return idList.indexOf(nodeId);
  }

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
  }

  // ─── Search ──────────────────────────────────────────────────────

  search(mapId, query, { status, tag } = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return [];
    return this.searcher.search(map.root, query, { status, tag });
  }

  // ─── Serialization ───────────────────────────────────────────────

  toMarkdown(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return '';
    return this.codec.serialize(map.root, { format: 'markdown', ...opts });
  }

  toAscii(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return '';
    return this.codec.serialize(map.root, { format: 'ascii', ...opts });
  }

  toMinimalJson(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return null;
    return this.codec.serialize(map.root, { format: 'json', ...opts });
  }

  // ─── Layout convenience (renderers call this) ────────────────────

  layout(mapId, options = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return { nodes: [], links: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };
    return layoutTree(map.root, options);
  }

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
  }
}

export { SCHEMA_BRANCH, SCHEMA_LEAF };
export { makeBranch, makeLeaf, makeRoot };
