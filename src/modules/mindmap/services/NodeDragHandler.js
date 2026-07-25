/**
 * NodeDragHandler — pointer-event-driven drag-drop for mindmap nodes.
 *
 * Phase 14 of the mindmap module (CSMA). Standalone class; imported by
 * the demo page or renderer.
 *
 * Replaces the original Phase 6 (HTML5 drag-drop). Uses pointer events
 * with a ghost element, insert-preview indicators, drop-target hit-testing,
 * and edge auto-scroll. Inspired by mind-elixir-core's nodeDraggable.ts.
 *
 * Integration points:
 *   - SelectionController: which nodes are selected (selectedIds), isEditing guard
 *   - ViewportController: edge auto-scroll during drag (viewport.move)
 *   - MindmapService: moveNode(nodeId, targetParentId, index?)
 *
 * Security: zero innerHTML. Ghost text via textContent. Previews via
 * createElement + className.
 */

const DRAG_THRESHOLD = 5;          // px before drag activates
const EDGE_SCROLL_MARGIN = 50;     // px from container edge
const EDGE_SCROLL_SPEED = 20;      // px per 100ms
const EDGE_SCROLL_INTERVAL = 100;  // ms
const INSERT_ZONE_RATIO = 0.25;    // top/bottom 25% = before/after, middle 50% = in

const GHOST_CLASS = 'mindmap-drag-ghost';
const PREVIEW_BEFORE_CLASS = 'mindmap-insert-preview-before';
const PREVIEW_AFTER_CLASS = 'mindmap-insert-preview-after';
const PREVIEW_IN_CLASS = 'mindmap-insert-preview-in';

const STATE = { Idle: 0, Ready: 1, Dragging: 2 };

// ─── Private helpers ──────────────────────────────────────────────

/**
 * Check whether ancestorId is an ancestor of startNode in the tree.
 * Walks up via nodeObj.parent references.
 *
 * @param {object} service — MindmapService (for findNode)
 * @param {string} startNodeId
 * @param {string|Set<string>} ancestorIds — one id or a set of ids
 * @returns {boolean}
 */
function isDescendantOf(service, startNodeId, ancestorIds) {
  const checkSet = ancestorIds instanceof Set ? ancestorIds : new Set([ancestorIds]);
  let current = service.findNode(startNodeId);
  // We need parent references. If nodeObj has .parent, use it.
  // Otherwise walk the tree from root (expensive but reliable).
  // The NodeObj in CSMA mindmap does NOT have a .parent field directly.
  // Use _findNodeAndParent which is private, but we can walk from root.
  // Simpler: collect all descendants of each dragged node, check target.
  return false; // overridden by _collectDescendantIds check below
}

/**
 * Collect all descendant node IDs of rootId using the service tree.
 * @param {object} service
 * @param {string} rootId
 * @returns {Set<string>}
 */
function collectDescendantIds(service, rootId) {
  const ids = new Set();
  const subtree = service.getSubtree(rootId, { maxDepth: 100 });
  if (!subtree) return ids;
  const stack = [subtree];
  while (stack.length) {
    const n = stack.pop();
    if (Array.isArray(n.children)) {
      for (const c of n.children) {
        ids.add(c.id);
        stack.push(c);
      }
    }
  }
  return ids;
}

// ─── Public class ──────────────────────────────────────────────────

export class NodeDragHandler {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container — the .canvas element
   * @param {HTMLElement} opts.nodeLayer — div containing [data-node-id] elements
   * @param {object} opts.selection — SelectionController instance
   * @param {object} opts.viewport — ViewportController instance
   * @param {object} opts.service — MindmapService instance
   * @param {object} [opts.eventBus]
   * @param {string} [opts.mapId]
   * @param {function():void} opts.onRenderNeeded — callback to trigger re-render
   */
  constructor({ container, nodeLayer, selection, viewport, service, eventBus, mapId, onRenderNeeded }) {
    this._container = container;
    this._nodeLayer = nodeLayer;
    this._selection = selection;
    this._viewport = viewport;
    this._service = service;
    this._eventBus = eventBus || null;
    this._mapId = mapId || null;
    this._onRenderNeeded = onRenderNeeded || (() => {});

    // State machine
    this._state = STATE.Idle;
    this._startX = 0;
    this._startY = 0;
    this._pointerId = null;

    // Dragged nodes
    /** @type {string[]} */
    this._draggedIds = [];

    // Ghost
    /** @type {HTMLElement|null} */
    this._ghost = null;

    // Drop target
    /** @type {string|null} */
    this._targetId = null;
    /** @type {'before'|'after'|'in'|null} */
    this._insertType = null;

    // Insert preview elements
    /** @type {HTMLElement|null} */
    this._previewEl = null;
    /** @type {HTMLElement|null} */
    this._previewTargetEl = null;

    // Edge auto-scroll interval
    /** @type {number|null} */
    this._scrollInterval = null;

    // Bound handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onPointerCancel = this._handleCancel.bind(this);

    this._attached = false;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  attach() {
    if (this._attached) return;
    this._attached = true;
    this._container.addEventListener('pointerdown', this._onPointerDown);
    this._container.addEventListener('pointermove', this._onPointerMove);
    this._container.addEventListener('pointerup', this._onPointerUp);
    this._container.addEventListener('pointercancel', this._onPointerCancel);
    document.addEventListener('keydown', this._onKeyDown, true);
  }

  detach() {
    if (!this._attached) return;
    this._attached = false;
    this._container.removeEventListener('pointerdown', this._onPointerDown);
    this._container.removeEventListener('pointermove', this._onPointerMove);
    this._container.removeEventListener('pointerup', this._onPointerUp);
    this._container.removeEventListener('pointercancel', this._onPointerCancel);
    document.removeEventListener('keydown', this._onKeyDown, true);
    this._cleanup();
  }

  destroy() {
    this.detach();
    this._container = null;
    this._nodeLayer = null;
    this._selection = null;
    this._viewport = null;
    this._service = null;
    this._eventBus = null;
    this._onRenderNeeded = null;
  }

  // ─── Handle pointer-down ─────────────────────────────────────────

  /**
   * @param {PointerEvent} e
   */
  _handlePointerDown(e) {
    // Guard: only primary button (mouse left) or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Guard: skip during inline editing
    if (this._selection.isEditing) return;
    // Guard: skip during space-pressed pan
    if (this._viewport._spacePressed) return;

    const target = /** @type {HTMLElement} */ (e.target);
    const nodeEl = target.closest('[data-node-id]');
    if (!nodeEl) return;

    const nodeId = nodeEl.dataset.nodeId;
    if (!nodeId) return;

    // Root node is NOT draggable
    const nodeObj = this._service.findNode(nodeId);
    if (!nodeObj || !nodeObj.parent) return; // root has no parent

    // Determine which nodes to drag
    const sel = this._selection;
    if (!sel.selectedIds.has(nodeId)) {
      // Clicked an unselected node → select it, clear others
      sel.clearSelection();
      sel.selectNode(nodeId);
    }
    // Drag all currently selected nodes (excluding root)
    this._draggedIds = Array.from(sel.selectedIds).filter(id => {
      const n = this._service.findNode(id);
      return n && n.parent; // exclude root
    });

    if (this._draggedIds.length === 0) return;

    // Pre-compute descendant sets for drop-target validation
    this._descendantSets = new Map();
    for (const id of this._draggedIds) {
      this._descendantSets.set(id, collectDescendantIds(this._service, id));
    }

    this._startX = e.clientX;
    this._startY = e.clientY;
    this._pointerId = e.pointerId;
    this._state = STATE.Ready;

    // Capture pointer so we get moves outside the container
    this._container.setPointerCapture(e.pointerId);
  }

  // ─── Handle pointer-move ─────────────────────────────────────────

  /**
   * @param {PointerEvent} e
   */
  _handlePointerMove(e) {
    if (this._state === STATE.Idle) return;
    if (e.pointerId !== this._pointerId) return;

    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (this._state === STATE.Ready && distance > DRAG_THRESHOLD) {
      this._enterDragMode(e);
      return;
    }

    if (this._state === STATE.Dragging) {
      this._updateDrag(e);
    }
  }

  _enterDragMode(e) {
    this._state = STATE.Dragging;

    // Dim originals
    for (const id of this._draggedIds) {
      const el = this._nodeLayer.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (el) el.style.opacity = '0.4';
    }

    // Create ghost
    this._ghost = document.createElement('div');
    this._ghost.className = GHOST_CLASS;
    if (this._draggedIds.length === 1) {
      const el = this._nodeLayer.querySelector(`[data-node-id="${CSS.escape(this._draggedIds[0])}"]`);
      this._ghost.textContent = el ? el.textContent : '';
    } else {
      this._ghost.textContent = `${this._draggedIds.length} nodes`;
    }
    this._ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:10001;'
      + 'background:var(--surface,#fff);border:1px solid var(--accent,#4f90f2);'
      + 'border-radius:var(--mindmap-node-radius,4px);padding:4px 8px;'
      + 'opacity:0.9;font-size:var(--mindmap-node-font-size,14px);'
      + 'transform:translate(-10px,-10px);white-space:nowrap;';
    this._container.appendChild(this._ghost);

    this._updateDrag(e);
  }

  _updateDrag(e) {
    // Update ghost position
    if (this._ghost) {
      this._ghost.style.left = e.clientX + 'px';
      this._ghost.style.top = e.clientY + 'px';
    }

    // Hit-test for drop target
    this._findDropTarget(e);

    // Edge auto-scroll
    this._edgeScroll(e);
  }

  // ─── Drop-target detection ───────────────────────────────────────

  /**
   * @param {PointerEvent} e
   */
  _findDropTarget(e) {
    const threshold = 12 * (this._viewport ? this._viewport.scale : 1);

    // Bias: try above cursor first, then below
    let targetEl = /** @type {HTMLElement|null} */ (
      document.elementFromPoint(e.clientX, e.clientY - threshold)
    );
    if (!targetEl || !targetEl.closest('[data-node-id]')) {
      targetEl = /** @type {HTMLElement|null} */ (
        document.elementFromPoint(e.clientX, e.clientY + threshold)
      );
    }

    const nodeEl = targetEl ? targetEl.closest('[data-node-id]') : null;
    const newTargetId = nodeEl ? nodeEl.dataset.nodeId : null;

    // Clear preview if target changed
    if (newTargetId !== this._targetId) {
      this._clearPreview();
      this._targetId = newTargetId || null;
      this._insertType = null;
      this._previewTargetEl = null;
    }

    if (!this._targetId) return;

    // Validate target
    if (!this._isValidTarget(this._targetId)) {
      this._clearPreview();
      this._targetId = null;
      this._insertType = null;
      return;
    }

    // Determine insert type from cursor position relative to target rect
    const rect = nodeEl.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const ratio = relY / rect.height;

    let insertType;
    if (ratio < INSERT_ZONE_RATIO) {
      insertType = 'before';
    } else if (ratio > 1 - INSERT_ZONE_RATIO) {
      insertType = 'after';
    } else {
      // 'in' only if target is a branch (can accept children)
      const targetObj = this._service.findNode(this._targetId);
      if (targetObj && targetObj.schemaType === 'mindmap/branch') {
        insertType = 'in';
      } else {
        // Leaf target: default to 'after' when cursor is in the middle
        insertType = ratio < 0.5 ? 'before' : 'after';
      }
    }

    if (insertType !== this._insertType || nodeEl !== this._previewTargetEl) {
      this._clearPreview();
      this._insertType = insertType;
      this._previewTargetEl = nodeEl;
      this._showPreview(nodeEl, insertType);
    }
  }

  /**
   * Check if targetId is a valid drop target (not self, not descendant).
   * @param {string} targetId
   * @returns {boolean}
   */
  _isValidTarget(targetId) {
    if (!targetId) return false;
    // Cannot drop on oneself
    if (this._draggedIds.includes(targetId)) return false;
    // Cannot drop on a descendant of any dragged node
    for (const [id, descendants] of this._descendantSets) {
      if (descendants.has(targetId)) return false;
    }
    return true;
  }

  // ─── Insert preview ──────────────────────────────────────────────

  /**
   * @param {HTMLElement} nodeEl
   * @param {string} insertType
   */
  _showPreview(nodeEl, insertType) {
    if (insertType === 'in') {
      nodeEl.classList.add(PREVIEW_IN_CLASS);
      return;
    }

    // Create a bar element for before/after
    const bar = document.createElement('div');
    bar.className = insertType === 'before' ? PREVIEW_BEFORE_CLASS : PREVIEW_AFTER_CLASS;
    bar.style.cssText = 'position:absolute;left:0;right:0;height:3px;'
      + 'background:var(--accent,#4f90f2);border-radius:2px;z-index:9999;pointer-events:none;';
    if (insertType === 'before') {
      bar.style.top = '-2px';
    } else {
      bar.style.bottom = '-2px';
    }
    nodeEl.style.position = nodeEl.style.position || 'relative';
    nodeEl.appendChild(bar);
    this._previewEl = bar;
  }

  _clearPreview() {
    if (this._previewTargetEl) {
      this._previewTargetEl.classList.remove(PREVIEW_IN_CLASS);
    }
    if (this._previewEl) {
      this._previewEl.remove();
      this._previewEl = null;
    }
    this._previewTargetEl = null;
  }

  // ─── Edge auto-scroll ────────────────────────────────────────────

  /**
   * @param {PointerEvent} e
   */
  _edgeScroll(e) {
    if (!this._viewport) return;
    const rect = this._container.getBoundingClientRect();
    const nearLeft = e.clientX < rect.left + EDGE_SCROLL_MARGIN;
    const nearRight = e.clientX > rect.right - EDGE_SCROLL_MARGIN;
    const nearTop = e.clientY < rect.top + EDGE_SCROLL_MARGIN;
    const nearBottom = e.clientY > rect.bottom - EDGE_SCROLL_MARGIN;

    const needsScroll = nearLeft || nearRight || nearTop || nearBottom;

    if (needsScroll && !this._scrollInterval) {
      let dx = 0, dy = 0;
      if (nearLeft) dx = EDGE_SCROLL_SPEED;
      else if (nearRight) dx = -EDGE_SCROLL_SPEED;
      if (nearTop) dy = EDGE_SCROLL_SPEED;
      else if (nearBottom) dy = -EDGE_SCROLL_SPEED;

      const vp = this._viewport;
      const scale = vp.scale || 1;
      this._scrollInterval = setInterval(() => {
        vp.move(dx * scale, dy * scale);
      }, EDGE_SCROLL_INTERVAL);
    } else if (!needsScroll && this._scrollInterval) {
      this._stopScroll();
    }
  }

  _stopScroll() {
    if (this._scrollInterval !== null) {
      clearInterval(this._scrollInterval);
      this._scrollInterval = null;
    }
  }

  // ─── Handle pointer-up (drop) ────────────────────────────────────

  /**
   * @param {PointerEvent} e
   */
  async _handlePointerUp(e) {
    if (this._state === STATE.Idle) return;
    if (e.pointerId !== this._pointerId) return;

    const wasDragging = this._state === STATE.Dragging;

    // Release pointer capture
    try { this._container.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }

    if (wasDragging && this._targetId && this._insertType) {
      await this._executeDrop();
    }

    this._cleanup();
  }

  // ─── Handle cancel ───────────────────────────────────────────────

  /**
   * @param {PointerEvent|KeyboardEvent} _e
   */
  _handleCancel(_e) {
    if (this._state === STATE.Idle) return;
    this._cleanup();
  }

  /**
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    if (this._state === STATE.Idle) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this._cleanup();
    }
  }

  // ─── Execute drop ────────────────────────────────────────────────

  async _executeDrop() {
    const targetId = this._targetId;
    const insertType = this._insertType;
    if (!targetId || !insertType) return;

    const targetObj = this._service.findNode(targetId);
    if (!targetObj) return;

    try {
      if (insertType === 'in') {
        // Move each dragged node as child of target
        // Move in reverse so order is preserved
        const reversed = [...this._draggedIds].reverse();
        for (const id of reversed) {
          await this._service.moveNode(id, targetId);
        }
      } else {
        // Before/after: find target's parent, compute index
        // Target's parent: we need to find it. Use _findNodeAndParent if exposed,
        // otherwise walk the tree. Since _findNodeAndParent is private,
        // we find the parent by searching root's children.
        const map = this._service._getMap(this._mapId);
        if (!map) return;

        const { parent } = this._findParentOf(map.root, targetId);
        if (!parent) return; // target is root? shouldn't happen

        let targetIndex = parent.children.findIndex(c => c.id === targetId);
        if (targetIndex === -1) return;

        if (insertType === 'after') targetIndex += 1;

        // Move dragged nodes to this position (reverse order)
        const reversed = [...this._draggedIds].reverse();
        for (const id of reversed) {
          await this._service.moveNode(id, parent.id, targetIndex);
        }
      }

      this._onRenderNeeded();

      if (this._eventBus) {
        try {
          this._eventBus.publish('MINDMAP_STRUCTURE_CHANGED', {
            mapId: this._mapId,
            nodeId: targetId,
            operation: `drag-${insertType}`,
            details: { draggedIds: this._draggedIds, targetId, insertType }
          });
        } catch (_) { /* ignore */ }
      }
    } catch (err) {
      console.error('[NodeDragHandler] drop failed:', err);
    }
  }

  /**
   * Find parent of a node in the tree. Returns { node, parent }.
   * @param {object} root
   * @param {string} nodeId
   * @returns {{ node: object|null, parent: object|null }}
   */
  _findParentOf(root, nodeId) {
    if (!root) return { node: null, parent: null };
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      if (Array.isArray(n.children)) {
        for (const c of n.children) {
          if (c.id === nodeId) return { node: c, parent: n };
          stack.push(c);
        }
      }
    }
    return { node: null, parent: null };
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  _cleanup() {
    this._state = STATE.Idle;
    this._pointerId = null;

    // Restore original node opacity
    for (const id of this._draggedIds) {
      const el = this._nodeLayer.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (el) el.style.opacity = '';
    }
    this._draggedIds = [];
    this._descendantSets = null;

    // Remove ghost
    if (this._ghost) {
      this._ghost.remove();
      this._ghost = null;
    }

    // Remove preview
    this._clearPreview();
    this._targetId = null;
    this._insertType = null;

    // Stop edge scroll
    this._stopScroll();
  }
}
