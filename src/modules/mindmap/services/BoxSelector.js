/**
 * BoxSelector — box/marquee selection for mindmap canvas.
 *
 * Phase 12 of the mindmap module (CSMA). Standalone class.
 *
 * Drag on empty canvas area to draw a selection rectangle. On release,
 * all [data-node-id] elements intersecting the rectangle are selected.
 * Ctrl/Cmd adds to existing selection; without it, replaces selection.
 *
 * Dependencies: SelectionController (provides selectNodes, addToSelection,
 * isEditing, cancelCanvasClick).
 */

const BOX_CLASS = 'mindmap-box-select';
const DRAG_THRESHOLD = 5; // px — minimum drag distance to activate box select

export class BoxSelector {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container — the .canvas container element
   * @param {HTMLElement} opts.nodeLayer — the div containing [data-node-id] elements
   * @param {import('./SelectionController.js').SelectionController} opts.selection — SelectionController instance
   * @param {object} [opts.eventBus] — CSMA EventBus
   * @param {string} [opts.mapId] — active map id for event payload
   */
  constructor({ container, nodeLayer, selection, eventBus, mapId }) {
    this._container = container;
    this._nodeLayer = nodeLayer;
    this._selection = selection;
    this._eventBus = eventBus || null;
    this._mapId = mapId || null;

    // Box-select state
    this._active = false;
    this._startX = 0;
    this._startY = 0;
    this._boxEl = null;

    // Bound handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._cancelBoxSelect.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);

    // Space key state — box selection must be disabled while Space is
    // held (the user intends to pan, not draw a box).
    this._spacePressed = false;
  }

  /**
   * Register pointer and keyboard listeners on the container.
   */
  attach() {
    this._container.addEventListener('pointerdown', this._onPointerDown);
    this._container.addEventListener('pointermove', this._onPointerMove);
    this._container.addEventListener('pointerup', this._onPointerUp);
    this._container.addEventListener('pointercancel', this._onPointerCancel);
    this._container.addEventListener('keydown', this._onKeyDown);
    this._container.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Remove listeners (without destroying instance state).
   */
  detach() {
    this._container.removeEventListener('pointerdown', this._onPointerDown);
    this._container.removeEventListener('pointermove', this._onPointerMove);
    this._container.removeEventListener('pointerup', this._onPointerUp);
    this._container.removeEventListener('pointercancel', this._onPointerCancel);
    this._container.removeEventListener('keydown', this._onKeyDown);
    this._container.removeEventListener('keyup', this._onKeyUp);
    this._cancelBoxSelect();
  }

  /**
   * Detach and clear all references.
   */
  destroy() {
    this.detach();
    this._container = null;
    this._nodeLayer = null;
    this._selection = null;
    this._eventBus = null;
  }

  // ─── Handlers ───────────────────────────────────────────────────

  /**
   * @param {PointerEvent} e
   */
  _handlePointerDown(e) {
    // Only primary button starts box selection
    if (e.button !== 0) return;
    // Space key held → user is panning, not selecting
    if (this._spacePressed) return;
    // During inline editing, no box selection
    if (this._selection.isEditing) return;

    const target = /** @type {HTMLElement} */ (e.target);

    // Box selection only activates when clicking on the canvas background
    // (the container itself or a non-node descendant like the SVG layer).
    const isCanvas = this._isCanvasTarget(target);
    if (!isCanvas) return;

    // Don't start if the pointer is on a node element.
    const nodeEl = target.closest('[data-node-id]');
    if (nodeEl) return;

    this._active = true;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._ctrlHeld = e.ctrlKey || e.metaKey;

    // Selection rectangle — create once, style inline
    if (!this._boxEl) {
      this._boxEl = document.createElement('div');
      this._boxEl.className = BOX_CLASS;
      this._boxEl.style.cssText =
        'border:1px solid #4f90f2;' +
        'background:rgba(79,144,242,0.15);' +
        'pointer-events:none;' +
        'position:fixed;' +
        'z-index:9999;' +
        'display:none;';
      document.body.appendChild(this._boxEl);
    }
  }

  /**
   * @param {PointerEvent} e
   */
  _handlePointerMove(e) {
    if (!this._active) return;

    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;

    // Enforce drag threshold — don't show box until moved at least 5px
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
      return;
    }

    if (!this._boxEl) return;

    const left = Math.min(this._startX, e.clientX);
    const top = Math.min(this._startY, e.clientY);
    const width = Math.abs(dx);
    const height = Math.abs(dy);

    this._boxEl.style.display = 'block';
    this._boxEl.style.left = left + 'px';
    this._boxEl.style.top = top + 'px';
    this._boxEl.style.width = width + 'px';
    this._boxEl.style.height = height + 'px';
  }

  /**
   * @param {PointerEvent} e
   */
  _handlePointerUp(e) {
    if (!this._active) return;

    this._active = false;

    // Compute selection rectangle bounds
    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;

    // If total movement was below threshold, treat as a plain canvas click
    // (SelectionController already handles that — we just clean up here).
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
      this._hideBox();
      // Signal SelectionController NOT to clear selection on this click.
      // The pointerup happened on the canvas but we consumed it.
      if (this._selection.cancelCanvasClick) {
        this._selection.cancelCanvasClick();
      }
      return;
    }

    // Build selection rect in client coordinates
    const selRect = {
      left: Math.min(this._startX, e.clientX),
      top: Math.min(this._startY, e.clientY),
      right: Math.max(this._startX, e.clientX),
      bottom: Math.max(this._startY, e.clientY),
    };

    this._hideBox();

    // Find intersecting node elements
    const intersectingIds = this._findIntersectingNodes(selRect);

    if (intersectingIds.length === 0) {
      return;
    }

    // Signal SelectionController not to clear on this canvas click.
    if (this._selection.cancelCanvasClick) {
      this._selection.cancelCanvasClick();
    }

    // Apply selection
    if (this._ctrlHeld) {
      // Add to existing selection
      for (const id of intersectingIds) {
        this._selection.addToSelection(id);
      }
    } else {
      this._selection.selectNodes(intersectingIds);
    }
  }

  /**
   * @param {PointerEvent} _e
   */
  _handlePointerCancel(_e) {
    this._cancelBoxSelect();
  }

  /**
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    if (e.code === 'Space') {
      this._spacePressed = true;
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  _handleKeyUp(e) {
    if (e.code === 'Space') {
      this._spacePressed = false;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────

  /**
   * Determine if a pointer event target is the canvas "background"
   * (as opposed to a node element or other interactive element).
   *
   * @param {HTMLElement} target
   * @returns {boolean}
   */
  _isCanvasTarget(target) {
    // The container itself
    if (target === this._container) return true;

    // Direct children that are structural layers, not nodes
    // .canvas contains: svg#connector-layer, div#node-layer (.node-layer)
    if (target === this._nodeLayer) return true;

    // SVG layer (connector paths beneath nodes)
    if (target.tagName === 'svg' && target.parentElement === this._container) return true;
    if (target.tagName === 'path' && target.closest('svg')?.parentElement === this._container) return true;

    // The container but reached via a descendant with no [data-node-id] ancestor
    if (this._container.contains(target) && !target.closest('[data-node-id]')) {
      return true;
    }

    return false;
  }

  /**
   * Find all [data-node-id] elements whose bounding client rect intersects
   * the given selection rectangle.
   *
   * @param {{left:number, top:number, right:number, bottom:number}} selRect
   * @returns {string[]}
   */
  _findIntersectingNodes(selRect) {
    const nodeEls = this._nodeLayer.querySelectorAll('[data-node-id]');
    const result = [];

    for (const el of nodeEls) {
      const rect = el.getBoundingClientRect();
      if (this._rectsIntersect(selRect, rect)) {
        const nodeId = el.dataset.nodeId;
        if (nodeId) result.push(nodeId);
      }
    }

    return result;
  }

  /**
   * Check if two rectangles intersect.
   *
   * @param {{left:number, top:number, right:number, bottom:number}} a
   * @param {DOMRect} b
   * @returns {boolean}
   */
  _rectsIntersect(a, b) {
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }

  /**
   * Hide (not remove) the box element.
   */
  _hideBox() {
    if (this._boxEl) {
      this._boxEl.style.display = 'none';
    }
  }

  /**
   * Cancel in-progress box selection (e.g. pointer cancelled, detached).
   */
  _cancelBoxSelect() {
    this._active = false;
    this._hideBox();
  }
}
