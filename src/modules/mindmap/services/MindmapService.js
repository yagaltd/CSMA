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
import { uid } from '../../../utils/id.js';
import { Search } from './Search.js';
import { layout as layoutTree } from './LayoutEngine.js';
import { main as mainConnector, sub as subConnector, rectFromNodes, directionClassFor } from './ConnectorGeometry.js';
import { arrowPath } from './ArrowGeometry.js';
import { NodeDragHandler } from './NodeDragHandler.js';
import { SelectionController } from './SelectionController.js';
import { ViewportController } from './ViewportController.js';
import { KeyboardHandler } from './KeyboardHandler.js';
import { BoxSelector } from './BoxSelector.js';
import { renderMindmapNodes } from '../ui/MindmapRenderer.js';
import { ClipboardManager } from './ClipboardManager.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { FocusController } from './FocusController.js';
// CullingCore / RenderScheduler available from ../../layout/ for opt-in use.

const ACTIVE_MAP_KEY = 'mindmap:active';
const SCHEMA_BRANCH = 'mindmap/branch';
const SCHEMA_LEAF = 'mindmap/leaf';

// Branch hue palette — cycled through for auto-assigned per-branch colors.
// Hues chosen to be visually distinct, theme-agnostic (CSS derives actual
// colors from the hue via hsl() with light/dark-aware lightness values).
const BRANCH_HUES = [210, 30, 175, 340, 130, 50, 275, 160];
let _nextHueIdx = 0;
function _nextBranchHue() {
  const h = BRANCH_HUES[_nextHueIdx % BRANCH_HUES.length];
  _nextHueIdx++;
  return h;
}

function generateId(prefix = 'n') {
  return `${prefix}_${uid()}`;
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
    branchHue: BRANCH_HUES[0], // root always blue
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
    branchHue: meta.branchHue || _nextBranchHue(),
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
    branchHue: meta.branchHue || _nextBranchHue(),
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
  static SURFACE_CSS = `
/* ── Canvas ─────────────────────────────────────────────────── */
.mm-canvas {
  position: relative; width: 100%; height: 100%; min-height: 320px;
  overflow: hidden; outline: none; user-select: none; touch-action: none;
  background: var(--mindmap-canvas-bg, var(--background, #fafafa));
}
.mm-surface-svg {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: visible;
}
.mm-surface-nodes {
  position: absolute; top: 0; left: 0; transform-origin: 0 0;
}
.mm-canvas[data-read-only] { pointer-events: none; }
.mm-surface-nodes [data-selected] {
  outline: 2px solid var(--accent); outline-offset: 2px;
}

/* ── Node base (shared) ─────────────────────────────────────── */
.mm-surface-nodes .mm-node {
  box-sizing: border-box; position: absolute;
  min-width: 0; min-height: 0; overflow: hidden;
  font-family: var(--font-family-base, system-ui);
  transition: box-shadow var(--duration-fast, 120ms) ease,
              opacity var(--duration-fast, 120ms) ease;
}
/* All nodes: rounded rect, tinted background, left accent border */
.mm-surface-nodes .mm-node {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px;
  background: hsl(var(--mm-hue, 210), 70%, 95%);
  border: 1px solid hsl(var(--mm-hue, 210), 50%, 65%);
  border-left-width: 3px;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  cursor: pointer;
}
.mm-node[data-kind="root"] {
  background: hsl(var(--mm-hue, 210), 60%, 90%);
  border: 2px solid hsl(var(--mm-hue, 210), 50%, 50%);
  border-radius: var(--radius-lg, 12px);
  padding: 6px 12px;
  font-weight: var(--font-weight-bold, 700);
}
/* Dark */
[data-theme="dark"] .mm-surface-nodes .mm-node,
[data-theme="dark-storm"] .mm-surface-nodes .mm-node {
  background: hsl(var(--mm-hue, 210), 25%, 14%);
  border-color: hsl(var(--mm-hue, 210), 40%, 35%);
}
[data-theme="dark"] .mm-node[data-kind="root"],
[data-theme="dark-storm"] .mm-node[data-kind="root"] {
  background: hsl(var(--mm-hue, 210), 20%, 18%);
  border-color: hsl(var(--mm-hue, 210), 50%, 45%);
}

/* ── Status dot ─────────────────────────────────────────────── */
.mm-node__status {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  background: hsl(var(--mm-hue, 210), 40%, 60%);
}
.mm-node[data-status="done"] .mm-node__status {
  background: var(--success, #22c55e);
}
.mm-node[data-status="in_progress"] .mm-node__status {
  background: hsl(var(--mm-hue, 210), 70%, 45%);
}
.mm-node[data-status="blocked"] .mm-node__status {
  background: var(--destructive, #ef4444);
}

/* ── Topic text ─────────────────────────────────────────────── */
.mm-node__topic {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  line-height: 1.3;
  color: var(--foreground);
  flex: 1;
}
.mm-node[data-kind="root"] .mm-node__topic {
  font-size: var(--font-size-base, 15px);
  font-weight: var(--font-weight-bold, 700);
}
.mm-node[data-status="done"] .mm-node__topic {
  text-decoration: line-through; opacity: 0.6;
}

/* ── Tag ────────────────────────────────────────────────────── */
.mm-node__tag {
  font-size: 10px; font-weight: 500;
  padding: 0 4px; border-radius: 3px;
  background: hsl(var(--mm-hue, 210), 60%, 88%);
  color: hsl(var(--mm-hue, 210), 60%, 30%);
  text-transform: lowercase;
}
[data-theme="dark"] .mm-node__tag,
[data-theme="dark-storm"] .mm-node__tag {
  background: hsl(var(--mm-hue, 210), 30%, 25%);
  color: hsl(var(--mm-hue, 210), 50%, 75%);
}

/* ── Collapse button ────────────────────────────────────────── */
.mm-node__collapse {
  position: absolute; left: -14px; top: 50%; transform: translateY(-50%);
  width: 14px; height: 14px; border-radius: 50%; padding: 0;
  background: var(--surface); border: 1px solid hsl(var(--mm-hue, 210), 50%, 65%);
  cursor: pointer; font-size: 8px; line-height: 12px; text-align: center;
  color: hsl(var(--mm-hue, 210), 50%, 40%); z-index: 2;
}
.mm-node__collapse:hover {
  background: hsl(var(--mm-hue, 210), 60%, 50%);
  border-color: hsl(var(--mm-hue, 210), 60%, 50%);
  color: #fff;
}
.mm-node__collapse::before { content: "▾"; }
.mm-node[data-collapsed="true"] .mm-node__collapse::before { content: "▸"; }
/* Hide collapse when no children */
.mm-node:not([data-has-children="true"]) .mm-node__collapse { display: none; }

/* ── Connectors ─────────────────────────────────────────────── */
.connector-line {
  stroke: hsl(var(--mm-hue, 210), 50%, 60%);
  stroke-width: 2; stroke-linecap: round; fill: none;
}
.connector-line[data-link-kind="main"] { stroke-width: 2.5; }
.connector-line[data-status="done"] { opacity: 0.3; }
.connector-line[data-status="blocked"] { stroke: var(--destructive, #ef4444); }
[data-theme="dark"] .connector-line,
[data-theme="dark-storm"] .connector-line {
  stroke: hsl(var(--mm-hue, 210), 45%, 50%);
}

/* ── Arrow cross-links ──────────────────────────────────────── */
.arrow-line {
  fill: none; stroke: hsl(var(--mm-hue, 210), 40%, 50%);
  stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: stroke; cursor: pointer;
}
.arrow-line[data-selected] { stroke-width: 2.5; stroke-dasharray: none; }
.mm-arrow-head { fill: hsl(var(--mm-hue, 210), 40%, 50%); }

/* ── Toolbar ────────────────────────────────────────────────── */
.mm-toolbar {
  position: absolute; top: var(--space-sm); left: var(--space-sm); z-index: 5;
  display: flex; gap: var(--space-xs); flex-wrap: wrap; align-items: center;
  padding: var(--space-xs);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  pointer-events: auto;
}
.mm-toolbar .button { pointer-events: auto; }

/* ── Focus ──────────────────────────────────────────────────── */
.mm-canvas[data-mode="focus"] .mm-surface-nodes .mm-node:not([data-in-focus]) { opacity: 0.25; filter: saturate(0.55); }
.mm-canvas[data-mode="focus"] .mm-surface-svg .connector-line:not([data-in-focus]) { opacity: 0.12; }
.mm-focus-pill {
  position: absolute; bottom: var(--space-sm); left: 50%; transform: translateX(-50%); z-index: 6;
  display: flex; gap: var(--space-xs); align-items: center;
  padding: var(--space-xs) var(--space-sm);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  pointer-events: auto;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--foreground) 12%, transparent);
}
.mm-focus-pill .badge { font-size: var(--font-size-xs, 12px); }

/* ── Drag ghost ─────────────────────────────────────────────── */
.mindmap-drag-ghost {
  position: fixed; z-index: 10001; pointer-events: none;
  padding: 4px 8px; border-radius: var(--radius-sm, 4px);
  background: var(--surface); border: 1px dashed var(--accent);
  font-size: var(--font-size-sm, 14px); white-space: nowrap;
}
.insert-preview-in { outline: 2px solid var(--accent); outline-offset: 3px; }
.insert-preview-before, .insert-preview-after {
  position: absolute; left: 0; right: 0; height: 3px;
  background: var(--accent); border-radius: 2px;
  z-index: 9999; pointer-events: none;
}
.insert-preview-before { top: -2px; }
.insert-preview-after { bottom: -2px; }
`;

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
  }

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
  // (Legacy 3-arg `search(mapId, …)` removed; the agent-facing
  // `search(query, {status, tag})` below is the single canonical method.)

  // ─── Arrows (§11 cross-link graph edges) ──────────────────────────

  getArrows(mapId) {
    const map = this._getMap(mapId);
    return map?.arrows || [];
  }

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
  }

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
  }

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
  }

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
  }

  /** Agent/UI entry point to isolate a node set on the live surface (§11.9 / Wave 3 focus). */
  requestFocus(nodeIds, { scope = 'branch' } = {}) {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    if (!ids.length) return;
    this._publish('MINDMAP_FOCUS_REQUESTED', { mapId: this._activeMapId, focusIds: ids, scope });
  }

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
  }

  toAscii(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return '';
    return this.codec.serialize(map.root, { format: 'ascii', ...opts });
  }

  toMinimalJson(mapId, opts = {}) {
    const map = this._getMap(mapId) || this._getMap(this._activeMapId);
    if (!map) return null;
    const { focusIds, scope, ...rest } = opts || {};
    const root = map.root;
    const pruned = Array.isArray(focusIds) && focusIds.length
      ? this._prune(root, this._computeEffectiveIds(root, focusIds, scope === 'subtree' ? 'subtree' : 'branch'))
      : root;
    return this.codec.serialize(pruned, { format: 'json', ...rest });
  }

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
  }

  getLayoutDirection(mapId) {
    const map = this._getMap(mapId);
    if (!map) return 1; // default to right
    return typeof map.meta.layoutDirection === 'number' ? map.meta.layoutDirection : 1;
  }

  // ─── Text measurement (canvas-based, no DOM reflow) ──────────────

  static _meterCanvas = null;
  static _meterCtx = null;

  static _getMeterCtx() {
    if (!MindmapService._meterCanvas) {
      MindmapService._meterCanvas = (typeof document !== 'undefined')
        ? document.createElement('canvas')
        : { getContext: () => null };
      MindmapService._meterCtx = MindmapService._meterCanvas.getContext('2d');
    }
    return MindmapService._meterCtx;
  }

  /** Shared text-measurement: approximate width for a 14px system-ui string. */
  static measureTextWidth(text, opts = {}) {
    const ctx = MindmapService._getMeterCtx();
    if (!ctx) return (String(text || '').length * 8 + 24);
    const weight = opts.weight || '400';
    const size = opts.size || 14;
    const family = opts.family || 'system-ui, -apple-system, sans-serif';
    ctx.font = `${weight} ${size}px ${family}`;
    return ctx.measureText(String(text || '')).width + 1.5;
  }

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
          const topicW = MindmapService.measureTextWidth(node.topic || 'Untitled');
          const tagW = node.tag ? MindmapService.measureTextWidth(node.tag) + 28 : 0;
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

  // ─── aiui surface mounting ──────────────────────────────────────

  /**
   * Mount an aiui surface into a container element.
   *
   * Runtime contract for module aiui surfaces:
   *   mountSurface(surfaceId, container, props) → cleanupFn
   *
   * Supported surfaces:
   *   - 'mindmap-canvas' — renders the map identified by `props.mapId` (or the
   *     active map) as an absolutely-positioned node layer plus an SVG
   *     connector layer, mirroring demo/mindmap.html. `props.readOnly` stamps
   *     a `data-read-only` attribute and disables pointer interaction.
   *
   * Returns a cleanup function that empties the container and unsubscribes
   * from structure-change events.
   */
  mountSurface(surfaceId, container, props = {}) {
    if (surfaceId !== 'mindmap-canvas') {
      throw new Error(`MindmapService.mountSurface: unknown surface "${surfaceId}"`);
    }
    const doc = container.ownerDocument || globalThis.document;
    const service = this;
    let resolvedMapId = props.mapId || this._activeMapId;

    const canvas = doc.createElement('div');
    canvas.className = 'mm-canvas';
    canvas.setAttribute('data-surface', 'mindmap-canvas');
    if (props.readOnly === true || props.readOnly === 'true') {
      canvas.setAttribute('data-read-only', '');
    }
    const style = doc.createElement('style');
    style.textContent = MindmapService.SURFACE_CSS;
    const toolbar = doc.createElement('div');
    toolbar.className = 'mm-toolbar';
    const svgLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLayer.setAttribute('class', 'mm-surface-svg');
    svgLayer.setAttribute('overflow', 'visible');
    const nodeLayer = doc.createElement('div');
    nodeLayer.className = 'mm-surface-nodes';
    canvas.append(style, toolbar, svgLayer, nodeLayer);
    container.append(canvas);

    // ── Toolbar surface (Wave 2) ───────────────────────────────────
    // Direction cycle: right → side → down → left (matches setLayoutDirection).
    const layoutDirs = [1, 2, 3, 0];
    const dirLabel = { 0: 'Left', 1: 'Right', 2: 'Side', 3: 'Down' };
    const makeToolButton = (label) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'button';
      b.setAttribute('data-variant', 'ghost');
      b.setAttribute('data-size', 'sm');
      b.textContent = label;
      return b;
    };
    const zoomInBtn = makeToolButton('Zoom in');
    const zoomOutBtn = makeToolButton('Zoom out');
    const fitBtn = makeToolButton('Fit');
    const layoutBtn = makeToolButton('Layout');
    const fullBtn = makeToolButton('Fullscreen');
    toolbar.append(zoomInBtn, zoomOutBtn, fitBtn, layoutBtn, fullBtn);
    const focusBtn = makeToolButton('Focus');
    const exitFocusBtn = makeToolButton('Exit focus');
    toolbar.append(focusBtn, exitFocusBtn);
    // Focus pill (Wave 3) — visibility driven by FocusController.onChange.
    const pill = doc.createElement('div');
    pill.className = 'mm-focus-pill';
    pill.hidden = true;
    const pillCount = doc.createElement('span');
    pillCount.className = 'badge';
    const pillHint = doc.createElement('span');
    pillHint.className = 'mm-focus-pill__hint';
    pillHint.textContent = 'Alt+Click node · Shift+Click arrow to add · Esc exit';
    const copyMdBtn = makeToolButton('Copy');
    const copyJsonBtn = makeToolButton('Copy JSON');
    const exitPillBtn = makeToolButton('Exit');
    pill.append(pillCount, pillHint, copyMdBtn, copyJsonBtn, exitPillBtn);
    canvas.append(pill);
    const updatePill = (s) => {
      const active = !!s?.active;
      pill.hidden = !active;
      pillCount.textContent = active ? `${s.focusIds?.length || 0} focused` : '0';
    };
    // Pill button listeners attached after focus is created (see below).
    // Stop toolbar pointer/keyboard events from reaching the canvas handlers
    // (drag / pan / context-menu / keyboard) attached below.
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'contextmenu', 'keydown', 'keyup', 'click']) {
      toolbar.addEventListener(ev, (e) => e.stopPropagation());
    }

    const topicOf = (id) => {
      const node = service.findNode(id, { mapId: resolvedMapId });
      return node ? node.topic : null;
    };

    const computeBounds = () => {
      const { nodes } = service.layout(resolvedMapId);
      if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
      }
      return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    };

    // ── Render via catalog components (mind-node / connector-line) ──
    const render = () => {
      const mapId = resolvedMapId || service._activeMapId;
      if (!mapId) return;

      renderMindmapNodes(nodeLayer, svgLayer, service, mapId, {
        onToggleCollapse: async (id, next) => {
          await service.collapse(id, next, { mapId: resolvedMapId });
          renderAfterMut();
        },
      });
      // Cross-link arrows (§11) — recomputed every render from fresh layout rects.
      const arrowDefs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = doc.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'mm-arrow');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('orient', 'auto-start-reverse');
      const tip = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      tip.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      tip.setAttribute('class', 'mm-arrow-head');
      marker.appendChild(tip);
      arrowDefs.appendChild(marker);
      svgLayer.append(arrowDefs);
      for (const { d, arrow } of service.arrowPaths(mapId)) {
        const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', 'arrow-line');
        p.setAttribute('data-arrow-id', arrow.id);
        p.setAttribute('data-from', arrow.from);
        p.setAttribute('data-to', arrow.to);
        p.setAttribute('data-direction', arrow.direction);
        if (arrow.style?.color) p.setAttribute('data-style-color', arrow.style.color);
        if (service._selectedArrowId === arrow.id) p.setAttribute('data-selected', 'true');
        p.setAttribute('marker-end', 'url(#mm-arrow)');
        svgLayer.append(p);
      }

      focus.apply();
    };

    const renderAfterMut = () => {
      render();
      requestAnimationFrame(() => {
        const rootEl = nodeLayer.querySelector('[data-kind="root"]');
        if (rootEl) {
          const rr = rootEl.getBoundingClientRect();
          const cr = canvas.getBoundingClientRect();
          if (rr.left < -200 || rr.top < -200 || rr.left > cr.width + 200) {
            const layout = service.layout(resolvedMapId);
            const root = layout.nodes.find((x) => x.kind === 'root');
            if (root) viewport.toCenter({ x: root.x, y: root.y, w: root.w, h: root.h });
          }
        }
      });
    };

    // ── Wire interaction handlers (Wave 2) ─────────────────────────
    // Selection + Viewport are shared controllers used by the other handlers.
    const selection = new SelectionController({
      container: canvas, nodeLayer, eventBus: service.eventBus, mapId: resolvedMapId,
      onSelect: () => {}, onMultiSelect: () => {},
      onEditCommit: async (id, topic) => {
        await service.updateNode(id, { topic }, { mapId: resolvedMapId });
        renderAfterMut();
      }
    });
    const viewport = new ViewportController({ container: canvas, nodeLayer, connectorLayer: svgLayer, eventBus: service.eventBus, mapId: resolvedMapId });
    const focus = new FocusController({ service, eventBus: service.eventBus, nodeLayer, svgLayer, mapId: resolvedMapId, getRoot: () => service._getMap(resolvedMapId)?.root, onChange: updatePill });

    // ── Attach pill button listeners (focus now available) ──────────
    copyMdBtn.addEventListener('click', () => focus.copyContext('markdown'));
    copyJsonBtn.addEventListener('click', () => focus.copyContext('json'));
    exitPillBtn.addEventListener('click', () => focus.clearFocus());

    // CullingCore available for opt-in use (see src/modules/layout/).
    service.eventBus.subscribe('MINDMAP_FOCUS_REQUESTED', (e) => {
      if (e?.mapId && e.mapId !== resolvedMapId) return;
      if (e?.focusIds?.length) focus.focusNodes(e.focusIds, { scope: e.scope || 'branch' });
    });
    new NodeDragHandler({ container: canvas, nodeLayer, selection, viewport, service, eventBus: service.eventBus, mapId: resolvedMapId, onRenderNeeded: renderAfterMut }).attach();
    const contextMenu = new ContextMenu({ container: canvas, service, selection, eventBus: service.eventBus, mapId: resolvedMapId, onRenderNeeded: renderAfterMut, focus });
    contextMenu.attach();
    new KeyboardHandler({ container: canvas, selection, viewport, service, eventBus: service.eventBus, mapId: resolvedMapId, onRenderNeeded: renderAfterMut, getRoot: () => service._getMap(resolvedMapId)?.root }).attach();
    new BoxSelector({ container: canvas, nodeLayer, selection, eventBus: service.eventBus, mapId: resolvedMapId }).attach();
    new ClipboardManager({ service, selection, eventBus: service.eventBus, mapId: resolvedMapId });

    // ── Wave 3: focus / isolation interactions ──────────────────────
    svgLayer.addEventListener('click', (e) => {
      const path = e.target.closest('.connector-line');
      if (!path) return;
      const childId = path.getAttribute('data-child-id');
      if (!childId) return;
      // Shift+Click accumulates into the focus set; plain click replaces (single branch).
      if (e.shiftKey) focus.addToFocus(childId);
      else focus.focusNode(childId);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!e.altKey) return;
      const nodeEl = e.target.closest('[data-node-id]');
      if (!nodeEl) return;
      const id = nodeEl.dataset.nodeId;
      if (!id) return;
      e.stopPropagation();
      e.preventDefault();
      focus.toggleFocus(id);
    }, true);
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') focus.clearFocus();
    });
    canvas.addEventListener('click', (e) => {
      if (e.target.closest('[data-node-id]') || e.target.closest('.mm-toolbar') || e.target.closest('.connector-line') || e.target.closest('.mm-focus-pill')) return;
      focus.clearFocus();
    });

    // ── Wave 4: cross-link arrows (§11) ────────────────────────────
    let linkMode = null;
    let arrowSource = null;
    this.startLinkMode = (direction, sourceId) => {
      linkMode = direction;
      arrowSource = sourceId || selection.selectedIds[0] || null;
      canvas.setAttribute('data-link-mode', direction);
      service._publish('MINDMAP_LINK_MODE_CHANGED', { mapId: resolvedMapId, active: true, direction, source: arrowSource });
      if (arrowSource) focus.focusNodes([arrowSource]);
    };
    const selectArrow = (arrowId) => {
      service._selectedArrowId = arrowId;
      const arrow = service.getArrows(resolvedMapId).find((a) => a.id === arrowId);
      if (arrow) {
        focus.focusNodes([arrow.from, arrow.to]);
        service._publish('MINDMAP_ARROW_SELECTED', { mapId: resolvedMapId, arrowId, from: arrow.from, to: arrow.to });
      }
      renderAfterMut();
    };
    svgLayer.addEventListener('click', (e) => {
      const p = e.target.closest('.arrow-line');
      if (!p) return;
      e.stopPropagation();
      const arrowId = p.getAttribute('data-arrow-id');
      if (arrowId) selectArrow(arrowId);
    });
    canvas.addEventListener('click', (e) => {
      if (!linkMode) return;
      const nodeEl = e.target.closest('[data-node-id]');
      if (!nodeEl) return;
      const targetId = nodeEl.dataset.nodeId;
      if (!targetId || targetId === arrowSource) return;
      service.addArrow(arrowSource, targetId, { direction: linkMode })
        .then(() => renderAfterMut())
        .catch((err) => console.warn('[mindmap] addArrow failed:', err.message));
      linkMode = null;
      arrowSource = null;
      canvas.removeAttribute('data-link-mode');
      service._publish('MINDMAP_LINK_MODE_CHANGED', { mapId: resolvedMapId, active: false });
    });
    canvas.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && service._selectedArrowId) {
        e.preventDefault();
        const id = service._selectedArrowId;
        service._selectedArrowId = null;
        service.removeArrow(id).then(() => renderAfterMut());
      }
    });

    // ── Toolbar bindings ──────────────────────────────────────────────
    zoomInBtn.addEventListener('click', () => viewport.scaleTo(viewport.scale * 1.2));
    zoomOutBtn.addEventListener('click', () => viewport.scaleTo(viewport.scale / 1.2));
    fitBtn.addEventListener('click', () => viewport.scaleFit(computeBounds()));
    layoutBtn.addEventListener('click', () => {
      const cur = service.getLayoutDirection(resolvedMapId);
      const next = layoutDirs[(layoutDirs.indexOf(cur) + 1) % layoutDirs.length];
      service.setLayoutDirection(next, { mapId: resolvedMapId });
      layoutBtn.textContent = `Layout: ${dirLabel[next]}`;
    });
    fullBtn.addEventListener('click', () => {
      if (doc.fullscreenElement) doc.exitFullscreen?.();
      else canvas.requestFullscreen?.();
    });
    focusBtn.addEventListener('click', () => focus.focusNodes(selection.selectedIds));
    exitFocusBtn.addEventListener('click', () => focus.clearFocus());
    layoutBtn.textContent = `Layout: ${dirLabel[service.getLayoutDirection(resolvedMapId)] || 'Right'}`;

    render();
    const offStructure = service.eventBus?.subscribe?.('MINDMAP_STRUCTURE_CHANGED', render);
    // Center the root on initial mount (mirrors the demo's centerMap()).
    requestAnimationFrame(() => {
      const layout = service.layout(resolvedMapId);
      const root = layout.nodes.find((x) => x.kind === 'root');
      if (root) viewport.toCenter({ x: root.x, y: root.y, w: root.w, h: root.h });
    });

    const destroy = () => {
      if (typeof offStructure === 'function') offStructure();
      try { selection.destroy(); } catch { /* noop */ }
      try { viewport.destroy(); } catch { /* noop */ }
      try { contextMenu.destroy(); } catch { /* noop */ }
      container.replaceChildren();
    };
    // Return a callable cleanup fn with host helper methods.
    const api = () => destroy();
    api.render = render;
    api.setMapId = (id) => { resolvedMapId = id; renderAfterMut(); };
    api.destroy = destroy;
    return api;
  }
}

export { SCHEMA_BRANCH, SCHEMA_LEAF };
export { makeBranch, makeLeaf, makeRoot };
