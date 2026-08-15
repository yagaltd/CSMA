import { uid } from '../../../utils/id.js';

/**
 * KeyboardHandler — keyboard shortcuts for the mindmap canvas.
 *
 * Phase 11 of the mindmap module (CSMA). Standalone class; imported by
 * the demo page.
 *
 * Contract: .wave1-contract.md §Phase 11.
 *
 * Events published (when eventBus is available):
 *   MINDMAP_KEYBOARD_SHORTCUT → { mapId, shortcut, key, ctrl, meta, shift, alt }
 *
 * Depends on:
 *   - SelectionController (selectedIds, isEditing, selectNode, beginEdit)
 *   - ViewportController (scaleTo, toCenter)
 *   - MindmapService (insertSibling, insertParent, addBranch, removeNode,
 *       moveUp, moveDown, undo, redo, setLayoutDirection, getLayoutDirection,
 *       findNode)
 */

const LAYOUT_LEFT = 0;
const LAYOUT_RIGHT = 1;
const LAYOUT_SIDE = 2;
const LAYOUT_DOWN = 3;

const MOD = (e) => e.ctrlKey || e.metaKey;

export class KeyboardHandler {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container — the canvas element (must have tabindex="0")
   * @param {import('./SelectionController.js').SelectionController} opts.selection
   * @param {import('./ViewportController.js').ViewportController} opts.viewport
   * @param {import('./MindmapService.js').MindmapService} opts.service
   * @param {object} [opts.eventBus]
   * @param {string} [opts.mapId]
   * @param {function():void} [opts.onRenderNeeded] — called after tree mutation
   * @param {function():{root:object}} [opts.getRoot] — returns root NodeObj for tree navigation.
   *   If omitted, sibling/parent navigation will not work.
   */
  constructor({
    container,
    selection,
    viewport,
    service,
    eventBus,
    mapId,
    onRenderNeeded,
    getRoot
  }) {
    this._container = container;
    this._selection = selection;
    this._viewport = viewport;
    this._service = service;
    this._eventBus = eventBus || null;
    this._mapId = mapId || null;
    this._onRenderNeeded = onRenderNeeded || (() => {});
    this._getRoot = getRoot || (() => null);

    /** @type {object[]|null} */
    this._clipboard = null;

    this._handler = this._handleKeyDown.bind(this);
  }

  /**
   * Attach the keydown listener to the container.
   * Also ensures the container is focusable.
   */
  attach() {
    if (!this._container) return;
    this._container.setAttribute('tabindex', '0');
    this._container.addEventListener('keydown', this._handler);
  }

  /**
   * Detach the keydown listener.
   */
  detach() {
    if (this._container) {
      this._container.removeEventListener('keydown', this._handler);
    }
  }

  /**
   * Destroy — detach and clear state.
   */
  destroy() {
    this.detach();
    this._container = null;
    this._selection = null;
    this._viewport = null;
    this._service = null;
    this._eventBus = null;
    this._onRenderNeeded = null;
    this._getRoot = null;
    this._clipboard = null;
  }

  // ─── Key handler ──────────────────────────────────────────────────

  /**
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    // Pass through when inline editing is active
    if (this._selection && this._selection.isEditing) return;

    // Ignore events from input/textarea elements
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Ignore if target is contentEditable (our own inline edit creates one)
    if (e.target.isContentEditable) return;

    const key = e.key;
    const ctrl = MOD(e);
    const shift = e.shiftKey;
    const alt = e.altKey;

    let handled = false;

    // ─── Zoom shortcuts (work even without selection) ───────────────
    if (ctrl && (key === '=' || key === '+')) {
      e.preventDefault();
      this._viewport.scaleTo(this._viewport.scale + this._viewport.scaleSensitivity);
      this._emitShortcut('zoom-in', e);
      return;
    }
    if (ctrl && key === '-') {
      e.preventDefault();
      this._viewport.scaleTo(this._viewport.scale - this._viewport.scaleSensitivity);
      this._emitShortcut('zoom-out', e);
      return;
    }
    if (ctrl && key === '0') {
      e.preventDefault();
      this._viewport.scaleTo(1.0);
      this._emitShortcut('zoom-reset', e);
      return;
    }

    // ─── Layout direction shortcuts (work even without selection) ───
    if (ctrl && key === 'ArrowLeft') {
      e.preventDefault();
      this._service.setLayoutDirection(LAYOUT_LEFT).then(() => this._onRenderNeeded());
      this._emitShortcut('layout-left', e);
      return;
    }
    if (ctrl && key === 'ArrowRight') {
      e.preventDefault();
      this._service.setLayoutDirection(LAYOUT_RIGHT).then(() => this._onRenderNeeded());
      this._emitShortcut('layout-right', e);
      return;
    }
    if (ctrl && key === 'ArrowUp') {
      e.preventDefault();
      this._service.setLayoutDirection(LAYOUT_SIDE).then(() => this._onRenderNeeded());
      this._emitShortcut('layout-side', e);
      return;
    }
    if (ctrl && key === 'ArrowDown') {
      e.preventDefault();
      this._service.setLayoutDirection(LAYOUT_DOWN).then(() => this._onRenderNeeded());
      this._emitShortcut('layout-down', e);
      return;
    }

    // ─── Undo / Redo ────────────────────────────────────────────────
    if (ctrl && !shift && key === 'z') {
      e.preventDefault();
      this._service.undo().then(() => this._onRenderNeeded());
      this._emitShortcut('undo', e);
      return;
    }
    if (ctrl && (key === 'y' || (shift && key === 'Z'))) {
      // Ctrl+Y or Ctrl+Shift+Z
      e.preventDefault();
      this._service.redo().then(() => this._onRenderNeeded());
      this._emitShortcut('redo', e);
      return;
    }

    // ─── Copy / Cut / Paste ─────────────────────────────────────────
    if (ctrl && !shift && key === 'c') {
      e.preventDefault();
      this._copy();
      this._emitShortcut('copy', e);
      return;
    }
    if (ctrl && !shift && key === 'x') {
      e.preventDefault();
      this._copy();
      this._deleteSelected();
      this._emitShortcut('cut', e);
      return;
    }
    if (ctrl && !shift && key === 'v') {
      e.preventDefault();
      this._paste().then(() => this._onRenderNeeded());
      this._emitShortcut('paste', e);
      return;
    }

    // ─── F1, F2 ────────────────────────────────────────────────────
    if (key === 'F1') {
      e.preventDefault();
      const root = this._getRoot();
      if (root) {
        // root from _getRoot is the root NodeObj; we need its position
        // from layout. Since we don't have layout data here, just call
        // toCenter with a rough estimate or get the root element rect.
        const rootEl = this._findDomNode(root.id);
        if (rootEl) {
          const r = rootEl.getBoundingClientRect();
          const cr = this._container.getBoundingClientRect();
          this._viewport.toCenter({
            x: r.left - cr.left,
            y: r.top - cr.top,
            w: r.width,
            h: r.height
          });
        }
      }
      this._emitShortcut('center', e);
      return;
    }
    if (key === 'F2') {
      e.preventDefault();
      const ids = this._selection.selectedIds;
      if (ids.length === 1) {
        this._selection.beginEdit(ids[0]);
      }
      this._emitShortcut('edit', e);
      return;
    }

    // ─── Delete / Backspace ─────────────────────────────────────────
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      this._deleteSelected();
      this._emitShortcut('delete', e);
      return;
    }

    // ─── All remaining shortcuts require a single selected node ─────
    const selectedIds = this._selection ? this._selection.selectedIds : [];
    const selId = selectedIds.length >= 1 ? selectedIds[0] : null;

    if (!selId) return;

    // ─── Enter / Shift+Enter / Ctrl+Enter ───────────────────────────
    if (key === 'Enter') {
      e.preventDefault();
      if (ctrl) {
        // Ctrl/Cmd+Enter: insert parent
        this._service.insertParent(selId).then(() => this._onRenderNeeded());
        this._emitShortcut('insert-parent', e);
      } else if (shift) {
        // Shift+Enter: insert sibling before
        this._service.insertSibling(selId, 'before', 'New node').then(() => this._onRenderNeeded());
        this._emitShortcut('insert-sibling-before', e);
      } else {
        // Enter: insert sibling after
        this._service.insertSibling(selId, 'after', 'New node').then(() => this._onRenderNeeded());
        this._emitShortcut('insert-sibling-after', e);
      }
      return;
    }

    // ─── Tab: add child ─────────────────────────────────────────────
    if (key === 'Tab' && !shift) {
      e.preventDefault();
      this._service.addBranch(selId, 'New node').then(() => this._onRenderNeeded());
      this._emitShortcut('add-child', e);
      return;
    }

    // ─── Arrow navigation ───────────────────────────────────────────
    if (key === 'ArrowUp') {
      e.preventDefault();
      if (alt) {
        // Alt+Up: move node up
        this._service.moveUp(selId).then(() => this._onRenderNeeded());
        this._emitShortcut('move-up', e);
      } else {
        this._selectPrevSibling(selId);
        this._emitShortcut('select-prev-sibling', e);
      }
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      if (alt) {
        // Alt+Down: move node down
        this._service.moveDown(selId).then(() => this._onRenderNeeded());
        this._emitShortcut('move-down', e);
      } else {
        this._selectNextSibling(selId);
        this._emitShortcut('select-next-sibling', e);
      }
      return;
    }

    if (key === 'ArrowLeft') {
      e.preventDefault();
      this._selectParentOrLeft(selId);
      this._emitShortcut('select-parent-or-left', e);
      return;
    }

    if (key === 'ArrowRight') {
      e.preventDefault();
      this._selectFirstChildOrRight(selId);
      this._emitShortcut('select-child-or-right', e);
      return;
    }

    // ─── PageUp / PageDown: move node ───────────────────────────────
    if (key === 'PageUp') {
      e.preventDefault();
      this._service.moveUp(selId).then(() => this._onRenderNeeded());
      this._emitShortcut('move-up', e);
      return;
    }
    if (key === 'PageDown') {
      e.preventDefault();
      this._service.moveDown(selId).then(() => this._onRenderNeeded());
      this._emitShortcut('move-down', e);
      return;
    }
  }

  // ─── Navigation helpers ───────────────────────────────────────────

  /**
   * Select the previous sibling of nodeId. If nodeId is the first child,
   * do nothing.
   */
  _selectPrevSibling(nodeId) {
    const { node, parent } = this._findNodeAndParent(nodeId);
    if (!node || !parent || !Array.isArray(parent.children)) return;
    const idx = parent.children.indexOf(node);
    if (idx > 0) {
      this._selection.selectNode(parent.children[idx - 1].id);
    }
  }

  /**
   * Select the next sibling of nodeId. If nodeId is the last child,
   * do nothing.
   */
  _selectNextSibling(nodeId) {
    const { node, parent } = this._findNodeAndParent(nodeId);
    if (!node || !parent || !Array.isArray(parent.children)) return;
    const idx = parent.children.indexOf(node);
    if (idx >= 0 && idx < parent.children.length - 1) {
      this._selection.selectNode(parent.children[idx + 1].id);
    }
  }

  /**
   * Select the parent of nodeId. If nodeId is the root, select the
   * first LHS (left-hand-side) child instead.
   */
  _selectParentOrLeft(nodeId) {
    const { node, parent } = this._findNodeAndParent(nodeId);
    if (!node) return;

    if (parent) {
      // Not root → select parent
      this._selection.selectNode(parent.id);
    } else {
      // Root → select first LHS child (direction === 0)
      const root = node;
      if (Array.isArray(root.children)) {
        const lhs = root.children.find((c) => c.direction === LAYOUT_LEFT);
        if (lhs) {
          this._selection.selectNode(lhs.id);
        }
      }
    }
  }

  /**
   * Select the first child of nodeId. If node has no children, or is
   * collapsed, do nothing. If node is the root, select the first RHS
   * (right-hand-side) child.
   */
  _selectFirstChildOrRight(nodeId) {
    const { node, parent } = this._findNodeAndParent(nodeId);
    if (!node) return;

    if (!parent) {
      // Root → select first RHS child (direction === 1)
      if (Array.isArray(node.children)) {
        const rhs = node.children.find((c) => c.direction === LAYOUT_RIGHT || c.direction === undefined);
        if (rhs) {
          this._selection.selectNode(rhs.id);
        }
      }
    } else if (Array.isArray(node.children) && node.children.length > 0 && node.expanded !== false) {
      // Branch with visible children → select first child
      this._selection.selectNode(node.children[0].id);
    }
  }

  // ─── Copy / Paste / Delete helpers ─────────────────────────────────

  /**
   * Deep-clone selected node trees and store in clipboard.
   */
  _copy() {
    const ids = this._selection.selectedIds;
    if (ids.length === 0) return;

    const clones = [];
    for (const id of ids) {
      const node = this._service.findNode(id);
      if (node) {
        clones.push(this._deepCloneWithNewIds(node));
      }
    }
    this._clipboard = clones;
  }

  /**
   * Paste clipboard nodes as children of the first selected node.
   */
  async _paste() {
    if (!this._clipboard || this._clipboard.length === 0) return;
    const ids = this._selection.selectedIds;
    if (ids.length === 0) return;

    const targetId = ids[0];
    for (const clone of this._clipboard) {
      await this._service.addBranch(targetId, clone.topic, {
        status: clone.status,
        tag: clone.tag,
        metadata: clone.metadata
      });
    }
    // Keep clipboard for repeated paste
  }

  /**
   * Delete all selected nodes (except root).
   */
  async _deleteSelected() {
    const ids = this._selection.selectedIds;
    const root = this._getRoot();
    const rootId = root ? root.id : null;

    for (const id of ids) {
      if (id === rootId) continue; // never delete root
      try {
        await this._service.removeNode(id);
      } catch (e) {
        // Node may have been cascade-deleted already
      }
    }
    this._onRenderNeeded();
  }

  // ─── Tree utilities ────────────────────────────────────────────────

  /**
   * Find a node AND its parent in the tree.
   * Returns { node, parent } — parent is null if node is root.
   */
  _findNodeAndParent(nodeId) {
    const root = this._getRoot();
    if (!root) return { node: null, parent: null };
    if (root.id === nodeId) return { node: root, parent: null };

    const stack = [{ node: root, parent: null }];
    while (stack.length) {
      const { node, parent } = stack.pop();
      if (node.id === nodeId) return { node, parent };
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          stack.push({ node: child, parent: node });
        }
      }
    }
    return { node: null, parent: null };
  }

  /**
   * Deep-clone a NodeObj tree with fresh UUIDs.
   * Leaves children as empty arrays on leaf nodes.
   */
  _deepCloneWithNewIds(node) {
    const clone = {
      ...node,
      id: this._generateId(node.schemaType === 'mindmap/leaf' ? 'leaf' : 'branch'),
      children: [],
      updatedAt: Date.now()
    };
    if (Array.isArray(node.children)) {
      clone.children = node.children.map((c) => this._deepCloneWithNewIds(c));
    }
    return clone;
  }

  /**
   * Generate a unique ID.
   */
  _generateId(prefix = 'n') {
    return `${prefix}_${uid()}`;
  }

  // ─── DOM helpers ──────────────────────────────────────────────────

  /**
   * Find the DOM element for a node ID.
   */
  _findDomNode(nodeId) {
    return this._container.querySelector(`[data-node-id="${nodeId}"]`);
  }

  // ─── Event helper ─────────────────────────────────────────────────

  /**
   * Publish a MINDMAP_KEYBOARD_SHORTCUT event for debugging.
   */
  _emitShortcut(shortcut, e) {
    if (!this._eventBus) return;
    try {
      this._eventBus.publish('MINDMAP_KEYBOARD_SHORTCUT', {
        mapId: this._mapId,
        shortcut,
        key: e.key,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey
      });
    } catch {
      // EventBus may reject unknown events; swallow
      if (typeof this._eventBus.publishSync === 'function') {
        try {
          this._eventBus.publishSync('MINDMAP_KEYBOARD_SHORTCUT', {
            mapId: this._mapId,
            shortcut,
            key: e.key,
            ctrl: e.ctrlKey,
            meta: e.metaKey,
            shift: e.shiftKey,
            alt: e.altKey
          });
        } catch { /* swallow */ }
      }
    }
  }
}
