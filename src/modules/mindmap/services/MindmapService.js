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
import { SCHEMA_BRANCH, SCHEMA_LEAF, generateId, now, makeRoot, makeBranch, makeLeaf } from './MindmapNode.js';
import { SURFACE_CSS } from './MindmapSurfaceCSS.js';
import { _getMeterCtx, measureTextWidth } from './MindmapTextMeasure.js';
import { MindmapUndo } from './MindmapUndo.js';
import { MindmapSearch } from './MindmapSearch.js';
import { MindmapArrows } from './MindmapArrows.js';
import { MindmapSerialization } from './MindmapSerialization.js';
import { MindmapLayout } from './MindmapLayout.js';
import { MindmapMount } from './MindmapMount.js';

const ACTIVE_MAP_KEY = 'mindmap:active';

export class MindmapService {
  static SURFACE_CSS = SURFACE_CSS;
  static _getMeterCtx = _getMeterCtx;
  static measureTextWidth = measureTextWidth;

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
    this.agentContext.register({
      name: 'mindmap.search',
      description: 'Fuzzy search mindmap nodes by topic / status / tag',
      fn: (data, opts) => svc.search(opts?.query || '', { status: opts?.status, tag: opts?.tag }),
      moduleId: 'mindmap'
    });
    this.agentContext.register({
      name: 'mindmap.focus',
      description: 'Isolate a branch (or set of nodes) by node id(s); dims the rest of the map.',
      fn: (data, opts) => {
        const ids = opts?.nodeIds || (opts?.nodeId ? [opts.nodeId] : []);
        if (ids.length) svc.requestFocus(ids, { scope: opts?.scope || 'branch' });
        return { focused: ids };
      },
      moduleId: 'mindmap'
    });
    this.agentContext.register({
      name: 'mindmap.arrow',
      description: 'List cross-link arrows in the active map (filter by node or direction); isolate a linked context by focusing its two endpoints.',
      fn: (data, opts) => {
        const mapId = typeof opts?.mapId === 'string' ? opts.mapId : svc._activeMapId;
        let arrows = svc.getArrows(mapId);
        if (opts?.nodeId) arrows = arrows.filter((a) => a.from === opts.nodeId || a.to === opts.nodeId);
        if (opts?.direction) arrows = arrows.filter((a) => a.direction === opts.direction);
        let isolated = null;
        if (opts?.arrowId && opts?.isolate) {
          const arrow = arrows.find((a) => a.id === opts.arrowId) || svc.getArrows(mapId).find((a) => a.id === opts.arrowId);
          if (arrow) {
            svc.requestFocus([arrow.from, arrow.to], { scope: 'branch' });
            isolated = arrow.id;
          }
        }
        return { mapId, arrows, isolated };
      },
      moduleId: 'mindmap'
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  // ─── Focus / isolation helpers (Wave 3) ──────────────────────────

  _findNodeById(root, id) {
    if (!root) return null;
    if (root.id === id) return root;
    for (const c of root.children || []) {
      const found = this._findNodeById(c, id);
      if (found) return found;
    }
    return null;
  }

  _buildParentIndex(root) {
    const idx = new Map();
    const walk = (n, parentId) => {
      for (const c of n.children || []) {
        idx.set(c.id, parentId);
        walk(c, c.id);
      }
    };
    walk(root, null);
    return idx;
  }

  _collectDescendants(node, set) {
    set.add(node.id);
    for (const c of node.children || []) this._collectDescendants(c, set);
  }

  _computeEffectiveIds(root, focusIds, scope = 'branch') {
    const parentIndex = this._buildParentIndex(root);
    const eff = new Set();
    for (const seed of focusIds || []) {
      eff.add(seed);
      const seedNode = this._findNodeById(root, seed);
      if (seedNode) this._collectDescendants(seedNode, eff);
      if (scope === 'branch') {
        let pid = parentIndex.get(seed);
        while (pid) {
          eff.add(pid);
          pid = parentIndex.get(pid);
        }
      }
    }
    return eff;
  }

  _prune(root, effectiveIds) {
    const copy = (n) => ({
      ...n,
      children: (n.children || []).filter((c) => effectiveIds.has(c.id)).map(copy),
    });
    return copy(root);
  }


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
      // Auto-promote leaf to branch (mind-elixir style: any node can have children)
      parent.schemaType = SCHEMA_BRANCH;
      parent.children = [];
    }
    const branch = makeBranch(topic, meta);
    // Inherit branch hue from parent if not explicitly set.
    if (meta.branchHue == null && parent.branchHue != null) {
      branch.branchHue = parent.branchHue;
    }
    branch.direction = parent.direction;
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

  async insertSibling(nodeId, position, topic, meta = {}, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node: sibling, parent } = this._findNodeAndParent(map.root, nodeId);
    if (!sibling) throw new Error(`[MindmapService] node ${nodeId} not found`);
    if (!parent) throw new Error('[MindmapService] cannot insert sibling before root; use addBranch');
    const idx = parent.children.indexOf(sibling);
    const insertAt = position === 'before' ? idx : idx + 1;
    const branch = makeBranch(topic, meta);
    branch.direction = sibling.direction;
    parent.children.splice(insertAt, 0, branch);
    parent.updatedAt = now();
    this._recomputeBranchCounts(parent);
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'insertSibling',
        mapId: map.meta.id,
        nodeId: branch.id,
        parentId: parent.id,
        position,
        node: branch
      });
    }
    await this._persistTree(map.meta.id, branch);
    await this._persistNode(map.meta.id, parent);
    this._publish('MINDMAP_NODE_ADDED', {
      mapId: map.meta.id,
      nodeId: branch.id,
      parentId: parent.id,
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
      // Auto-promote leaf to branch (mind-elixir style: any node can have children)
      parent.schemaType = SCHEMA_BRANCH;
      parent.children = [];
    }
    const leaf = makeLeaf(topic, meta);
    // Inherit branch hue from parent if not explicitly set.
    if (meta.branchHue == null && parent.branchHue != null) {
      leaf.branchHue = parent.branchHue;
    }
    leaf.direction = parent.direction;
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
    // Invalidate cached text width when topic or tag changes.
    if ('topic' in changes || 'tag' in changes) {
      delete node._cachedWidth;
    }
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

  async insertParent(nodeId, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node: original, parent: grandparent } = this._findNodeAndParent(map.root, nodeId);
    if (!original) throw new Error(`[MindmapService] node ${nodeId} not found`);
    if (!grandparent) throw new Error('[MindmapService] cannot insert parent above root');
    const idx = grandparent.children.indexOf(original);
    const newParent = makeBranch(original.topic || 'Parent', {});
    newParent.children = [original];
    grandparent.children[idx] = newParent;
    grandparent.updatedAt = now();
    this._recomputeBranchCounts(newParent);
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'insertParent',
        mapId: map.meta.id,
        nodeId: newParent.id,
        originalNodeId: nodeId,
        grandparentId: grandparent.id,
        index: idx,
        node: newParent
      });
    }
    await this._persistTree(map.meta.id, newParent);
    await this._persistNode(map.meta.id, grandparent);
    this._publish('MINDMAP_STRUCTURE_CHANGED', {
      mapId: map.meta.id,
      nodeId,
      operation: 'insertParent',
      details: { parentId: newParent.id }
    });
    return { parent: newParent, child: original };
  }

  async moveUp(nodeId, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node, parent } = this._findNodeAndParent(map.root, nodeId);
    if (!node) throw new Error(`[MindmapService] node ${nodeId} not found`);
    if (!parent) throw new Error('[MindmapService] cannot reorder the root node');
    const idx = parent.children.indexOf(node);
    if (idx <= 0) return node; // already first
    const oldIndex = idx;
    parent.children.splice(idx, 1);
    parent.children.splice(idx - 1, 0, node);
    parent.updatedAt = now();
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'moveUp',
        mapId: map.meta.id,
        nodeId,
        parentId: parent.id,
        oldIndex,
        newIndex: idx - 1
      });
    }
    await this._persistNode(map.meta.id, parent);
    this._publish('MINDMAP_NODE_MOVED', {
      mapId: map.meta.id,
      nodeId,
      fromParent: parent.id,
      toParent: parent.id,
      index: idx - 1
    });
    return node;
  }

  async moveDown(nodeId, options = {}) {
    const map = this._getMap(options.mapId);
    if (!map) throw new Error('[MindmapService] no active map');
    const { node, parent } = this._findNodeAndParent(map.root, nodeId);
    if (!node) throw new Error(`[MindmapService] node ${nodeId} not found`);
    if (!parent) throw new Error('[MindmapService] cannot reorder the root node');
    const idx = parent.children.indexOf(node);
    if (idx >= parent.children.length - 1) return node; // already last
    const oldIndex = idx;
    parent.children.splice(idx, 1);
    parent.children.splice(idx + 1, 0, node);
    parent.updatedAt = now();
    this._recomputeBranchCounts(map.root);
    if (!options.skipHistory) {
      this._recordOp('mindmap', {
        op: 'moveDown',
        mapId: map.meta.id,
        nodeId,
        parentId: parent.id,
        oldIndex,
        newIndex: idx + 1
      });
    }
    await this._persistNode(map.meta.id, parent);
    this._publish('MINDMAP_NODE_MOVED', {
      mapId: map.meta.id,
      nodeId,
      fromParent: parent.id,
      toParent: parent.id,
      index: idx + 1
    });
    return node;
  }

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

}
// ─── Section mixins (Phase 6 split — see audit-fix-plan.md §6.1) ────
// Extracted sections are mixed back onto the service so every internal
// `this.*` call and the public surface behave exactly as before. Statics
// (text measurement) are re-attached above in the class body.
Object.assign(MindmapService.prototype, MindmapUndo);
Object.assign(MindmapService.prototype, MindmapSearch);
Object.assign(MindmapService.prototype, MindmapArrows);
Object.assign(MindmapService.prototype, MindmapSerialization);
Object.assign(MindmapService.prototype, MindmapLayout);
Object.assign(MindmapService.prototype, MindmapMount);

export { SCHEMA_BRANCH, SCHEMA_LEAF, makeBranch, makeLeaf, makeRoot };
