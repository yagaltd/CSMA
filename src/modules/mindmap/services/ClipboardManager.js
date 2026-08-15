import { uid } from '../../../utils/id.js';

/**
 * ClipboardManager — copy, cut, and paste node trees in the CSMA mindmap.
 *
 * Phase 16 of the mindmap module (CSMA). Standalone class; imported by
 * the demo page or renderer.
 *
 * Uses navigator.clipboard when available (secure context), with an
 * in-memory stash as fallback for non-secure contexts.
 *
 * Clipboard format:
 *   {"csma-mindmap-clipboard": true, "version": 1, "nodes": [NodeObj...]}
 *
 * Security:
 *   — No innerHTML. All text via textContent.
 *   — Defensive JSON parsing with try/catch.
 *   — Magic marker checked before using clipboard data.
 */

const CLIPBOARD_MAGIC = 'csma-mindmap-clipboard';
const CLIPBOARD_VERSION = 1;
const SCHEMA_BRANCH = 'mindmap/branch';
const SCHEMA_LEAF = 'mindmap/leaf';

function generateId(prefix) {
  return `${prefix}_${uid()}`;
}

export class ClipboardManager {
  /**
   * @param {object} opts
   * @param {import('./MindmapService.js').MindmapService} opts.service
   * @param {import('./SelectionController.js').SelectionController} opts.selection
   * @param {object} [opts.eventBus]
   * @param {string} [opts.mapId]
   */
  constructor({ service, selection, eventBus, mapId }) {
    this._service = service;
    this._selection = selection;
    this._eventBus = eventBus || null;
    this._mapId = mapId || null;

    /** @type {object[]|null} — in-memory clipboard stash (fallback for non-secure contexts) */
    this._stash = null;
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Copy selected node trees to clipboard + in-memory stash.
   * Silently returns [] if nothing selected.
   * @returns {Promise<object[]>} cloned tree roots (with regenerated UUIDs)
   */
  async copy() {
    const ids = this._selection.selectedIds;
    if (ids.length === 0) {
      this._stash = null;
      return [];
    }

    const trees = [];
    for (const id of ids) {
      const subtree = this._service.getSubtree(id);
      if (subtree) {
        trees.push(this._deepClone(subtree));
      }
    }

    this._stash = trees;

    const payload = {
      [CLIPBOARD_MAGIC]: true,
      version: CLIPBOARD_VERSION,
      nodes: trees
    };

    await this._writeClipboard(JSON.stringify(payload));
    return trees;
  }

  /**
   * Copy + delete selected nodes from the tree.
   * Skips root node (cannot be cut).
   * @returns {Promise<object[]>} cloned tree roots (before deletion)
   */
  async cut() {
    const trees = await this.copy();
    if (trees.length === 0) return [];

    const ids = this._selection.selectedIds;
    const map = this._service._getMap(this._mapId);
    const rootId = map?.root?.id;

    for (const id of ids) {
      if (id === rootId) continue; // never cut root
      try {
        await this._service.removeNode(id);
      } catch (_) {
        // node may have been a descendant of a previously removed node
      }
    }

    this._selection.clearSelection();
    return trees;
  }

  /**
   * Paste cloned trees as children of the target node.
   * If the clipboard has valid mindmap data, uses that.
   * Otherwise falls back to the in-memory stash.
   * @param {string} [targetId] — parent node id (defaults to first selected node)
   * @returns {Promise<string[]>} ids of newly created top-level nodes
   */
  async paste(targetId) {
    // Determine target
    const parentId = targetId || this._selection.selectedIds[0];
    if (!parentId) return [];

    // Try clipboard first, then stash
    let trees = null;
    try {
      trees = await this._readClipboardTrees();
    } catch (_) {
      // clipboard unavailable or unparseable — fall through to stash
    }

    if (!trees || trees.length === 0) {
      trees = this._stash;
    }

    if (!trees || trees.length === 0) return [];

    const created = [];
    for (const tree of trees) {
      const newId = await this._pasteTree(tree, parentId);
      if (newId) created.push(newId);
    }

    // Update stash so re-pasting regenerates IDs (fresh clones)
    // Actually: keep the same stash for re-pasting. The user may want
    // to paste the same content multiple times. We'll re-clone each paste.
    // But we already mutated the trees' IDs during paste… re-clone from stash.
    // Since we deepClone'd before paste, the stash is still pristine.
    // We need to re-clone for the next paste call — handled by _pasteRoot
    // which deep-clones the tree itself.

    return created;
  }

  /**
   * Whether the clipboard or in-memory stash has content.
   * @returns {boolean}
   */
  hasContent() {
    return Array.isArray(this._stash) && this._stash.length > 0;
  }

  /**
   * Destroy — clear stash, release references.
   */
  destroy() {
    this._stash = null;
    this._service = null;
    this._selection = null;
    this._eventBus = null;
  }

  // ─── Private ────────────────────────────────────────────────────

  /**
   * Write text to the system clipboard. Falls back to in-memory only
   * if clipboard API is unavailable (non-secure context).
   * @param {string} text
   */
  async _writeClipboard(text) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (_) {
      // clipboard API may reject in some contexts; stash is enough
    }
  }

  /**
   * Read and parse clipboard text. Returns tree array or null.
   * @returns {Promise<object[]|null>}
   */
  async _readClipboardTrees() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      return null;
    }

    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (_) {
      return null;
    }

    if (!text) return null;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return null;
    }

    if (!parsed || parsed[CLIPBOARD_MAGIC] !== true) return null;
    if (!Array.isArray(parsed.nodes)) return null;

    return parsed.nodes;
  }

  /**
   * Deep-clone a node tree, regenerating all UUIDs.
   * Preserves schemaType, topic, status, tag, children structure.
   * Strips metadata.leafCount/doneCount (recomputed by service on insert).
   * @param {object} node
   * @returns {object}
   */
  _deepClone(node) {
    const prefix = node.schemaType === SCHEMA_LEAF ? 'leaf' : 'branch';
    const cloned = {
      id: generateId(prefix),
      topic: node.topic,
      schemaType: node.schemaType,
      status: node.status || 'pending',
      children: [],
      expanded: node.schemaType === SCHEMA_BRANCH ? (node.expanded !== false) : undefined,
      direction: node.direction ?? 0,
      metadata: {},
      updatedAt: Date.now()
    };

    // Copy whitelisted metadata fields
    if (node.metadata) {
      if (node.metadata.specPath) cloned.metadata.specPath = node.metadata.specPath;
      if (node.metadata.bottleneck) cloned.metadata.bottleneck = node.metadata.bottleneck;
      if (node.metadata.note) cloned.metadata.note = node.metadata.note;
      // leafCount and doneCount are NOT copied — recomputed by service
    }

    // Copy tag if present
    if (node.tag) cloned.tag = node.tag;

    // Recursively clone children
    if (Array.isArray(node.children)) {
      cloned.children = node.children.map((c) => this._deepClone(c));
    }

    return cloned;
  }

  /**
   * Paste a single tree under a parent, recreating the full subtree.
   * Uses service.addBranch/addLeaf to get proper history recording and
   * event publishing.
   * @param {object} tree — cloned tree root (with fresh UUIDs)
   * @param {string} parentId
   * @returns {Promise<string|null>} new root node id
   */
  async _pasteTree(tree, parentId) {
    // Deep-clone again so repeated pastes don't share UUIDs
    const root = this._deepClone(tree);

    if (root.schemaType === SCHEMA_BRANCH) {
      await this._service.addBranch(parentId, root.topic, {
        status: root.status,
        tag: root.tag,
        metadata: root.metadata
      });
    } else {
      await this._service.addLeaf(parentId, root.topic, {
        status: root.status,
        metadata: root.metadata
      });
    }

    // addBranch/addLeaf modify the parent and return the new node.
    // To find the new node's ID we need to look at the parent's children.
    // The service appends to the children array, so the last child is the new one.
    const map = this._service._getMap(this._mapId);
    if (!map) return null;
    const { node: parent } = this._service._findNodeAndParent(map.root, parentId);
    if (!parent || !Array.isArray(parent.children) || parent.children.length === 0) return null;

    const newRoot = parent.children[parent.children.length - 1];
    const newRootId = newRoot.id;

    // Paste children recursively
    if (Array.isArray(root.children)) {
      for (const child of root.children) {
        await this._pasteTree(child, newRootId);
      }
    }

    return newRootId;
  }
}
