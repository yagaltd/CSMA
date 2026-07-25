/**
 * ViewportController — pan, zoom, and viewport management for mindmap canvas.
 *
 * Manages CSS transform (translate + scale) on the node layer and connector
 * SVG layer. Handles mouse wheel pan/zoom, Space+drag grab-pan, cursor-centered
 * zoom math, toCenter, scaleFit, and scrollIntoView.
 *
 * Publishes debounced MINDMAP_VIEWPORT_CHANGED events via EventBus.
 *
 * Attribution: zoom math and pan/zoom interaction model inspired by
 * mind-elixir-core's interact.ts and mouse.ts. MIT license — see
 * vendor/MIND_ELIXIR_LICENSE.
 */

export class ViewportController {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container — the .canvas container element
   * @param {HTMLElement} opts.nodeLayer — the transformable div holding nodes
   * @param {SVGElement} opts.connectorLayer — the SVG layer (same transform)
   * @param {object} [opts.eventBus] — CSMA EventBus (publish MINDMAP_VIEWPORT_CHANGED)
   * @param {string} [opts.mapId] — active map id for event payload
   */
  constructor({ container, nodeLayer, connectorLayer, eventBus, mapId }) {
    this._container = container;
    this._nodeLayer = nodeLayer;
    this._connectorLayer = connectorLayer;
    this._eventBus = eventBus || null;
    this._mapId = mapId || null;

    // Transform state
    this._tx = 0;
    this._ty = 0;
    this._scale = 1;

    // Config (matching mind-elixir defaults)
    this.scaleMin = 0.2;
    this.scaleMax = 1.4;
    this.scaleSensitivity = 0.1;

    // Pan state (Space+drag)
    this._spacePressed = false;
    this._isPanning = false;
    this._panStartX = 0;
    this._panStartY = 0;
    this._panTx0 = 0;
    this._panTy0 = 0;

    // Debounce state
    this._rafId = null;
    this._pendingEvent = false;

    // Smooth-move timeout
    this._smoothTimeout = null;

    // Bound handlers (for removal)
    this._onWheel = this._handleWheel.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);

    // Attach listeners
    this._container.style.touchAction = 'none';
    this._container.addEventListener('wheel', this._onWheel, { passive: false });
    this._container.addEventListener('keydown', this._onKeyDown);
    this._container.addEventListener('keyup', this._onKeyUp);
    this._container.addEventListener('pointerdown', this._onPointerDown);
    this._container.addEventListener('pointermove', this._onPointerMove);
    this._container.addEventListener('pointerup', this._onPointerUp);

    // Ensure transform-origin is set on both layers
    this._nodeLayer.style.transformOrigin = '0 0';
    this._connectorLayer.style.transformOrigin = '0 0';

    // Apply initial transform
    this._applyTransform();
  }

  // ===================================================================
  // Public accessors
  // ===================================================================

  get tx() { return this._tx; }
  get ty() { return this._ty; }
  get scale() { return this._scale; }

  // ===================================================================
  // Core methods
  // ===================================================================

  /**
   * Pan by (dx, dy) in screen pixels. Smooth=true adds a 0.3s CSS
   * transition for animated moves (scrollIntoView, toCenter, etc.).
   * @param {number} dx — pixels right
   * @param {number} dy — pixels down
   * @param {boolean} [smooth=false]
   */
  move(dx, dy, smooth = false) {
    // Prevent consecutive smooth moves while transition is active
    if (smooth && this._smoothTimeout) return;

    this._tx += dx;
    this._ty += dy;

    if (smooth) {
      this._nodeLayer.style.transition = 'transform 0.3s';
      this._connectorLayer.style.transition = 'transform 0.3s';
      if (this._smoothTimeout) clearTimeout(this._smoothTimeout);
      this._smoothTimeout = setTimeout(() => {
        this._nodeLayer.style.transition = 'none';
        this._connectorLayer.style.transition = 'none';
        this._smoothTimeout = null;
      }, 300);
    }

    this._applyTransform();
    this._scheduleViewportEvent();
  }

  /**
   * Zoom to newVal, keeping the point at (cx, cy) fixed.
   * (cx, cy) are client coordinates relative to the viewport.
   * If omitted, scales from the container centre.
   * @param {number} newVal — target scale
   * @param {{ cx?: number, cy?: number }} [opts]
   */
  scaleTo(newVal, { cx, cy } = {}) {
    const clamped = Math.max(this.scaleMin, Math.min(this.scaleMax, newVal));
    if (clamped === this._scale) return;

    const oldScale = this._scale;

    // Determine the point in map-space that should stay fixed
    let mapX, mapY;
    if (typeof cx === 'number' && typeof cy === 'number') {
      const rect = this._container.getBoundingClientRect();
      mapX = (cx - rect.left - this._tx) / oldScale;
      mapY = (cy - rect.top - this._ty) / oldScale;
    } else {
      // Scale from container centre
      const rect = this._container.getBoundingClientRect();
      mapX = (rect.width / 2 - this._tx) / oldScale;
      mapY = (rect.height / 2 - this._ty) / oldScale;
    }

    this._scale = clamped;

    // Reposition so the map-space point stays under the same screen position
    if (typeof cx === 'number' && typeof cy === 'number') {
      const rect = this._container.getBoundingClientRect();
      this._tx = cx - rect.left - mapX * clamped;
      this._ty = cy - rect.top - mapY * clamped;
    } else {
      const rect = this._container.getBoundingClientRect();
      this._tx = rect.width / 2 - mapX * clamped;
      this._ty = rect.height / 2 - mapY * clamped;
    }

    this._applyTransform();
    this._scheduleViewportEvent();
  }

  /**
   * Reset transform so the root node (given as layout rect) is centred
   * in the container viewport.
   * @param {{ x: number, y: number, w: number, h: number }} rootRect
   */
  toCenter(rootRect) {
    if (!rootRect) return;
    const rect = this._container.getBoundingClientRect();
    const rootCenterX = rootRect.x + rootRect.w / 2;
    const rootCenterY = rootRect.y + rootRect.h / 2;
    this._tx = rect.width / 2 - rootCenterX * this._scale;
    this._ty = rect.height / 2 - rootCenterY * this._scale;
    this._applyTransform();
    this._scheduleViewportEvent();
  }

  /**
   * Auto-scale so all node bounds fit in the container with 40px padding.
   * Also centres the bounding box.
   * @param {{ x: number, y: number, w: number, h: number }} nodesRect
   */
  scaleFit(nodesRect) {
    if (!nodesRect || nodesRect.w <= 0 || nodesRect.h <= 0) return;
    const PAD = 40;
    const rect = this._container.getBoundingClientRect();
    const availW = Math.max(1, rect.width - PAD * 2);
    const availH = Math.max(1, rect.height - PAD * 2);
    const scaleX = availW / nodesRect.w;
    const scaleY = availH / nodesRect.h;
    const newScale = Math.min(scaleX, scaleY);
    const clamped = Math.max(this.scaleMin, Math.min(this.scaleMax, newScale));

    this._scale = clamped;

    // Centre the bounding box
    const bbCenterX = nodesRect.x + nodesRect.w / 2;
    const bbCenterY = nodesRect.y + nodesRect.h / 2;
    this._tx = rect.width / 2 - bbCenterX * clamped;
    this._ty = rect.height / 2 - bbCenterY * clamped;

    this._applyTransform();
    this._scheduleViewportEvent();
  }

  /**
   * Pan (smoothly) so that the given node rect is visible. If forceCenter,
   * always centres the node; otherwise only pans if the node is out of view
   * (with 50px margin).
   * @param {{ x: number, y: number, w: number, h: number }} nodeRect
   * @param {boolean} [forceCenter=false]
   */
  scrollIntoView(nodeRect, forceCenter = false) {
    if (!nodeRect) return;
    const containerRect = this._container.getBoundingClientRect();

    // Node corners in screen coordinates
    const nl = nodeRect.x * this._scale + this._tx;
    const nt = nodeRect.y * this._scale + this._ty;
    const nr = nl + nodeRect.w * this._scale;
    const nb = nt + nodeRect.h * this._scale;

    const margin = 50;
    const outLeft = nl < containerRect.left + margin;
    const outRight = nr > containerRect.right - margin;
    const outTop = nt < containerRect.top + margin;
    const outBottom = nb > containerRect.bottom - margin;

    if (!forceCenter && !outLeft && !outRight && !outTop && !outBottom) return;

    // Centre the node in the viewport
    const nodeCenterX = nodeRect.x + nodeRect.w / 2;
    const nodeCenterY = nodeRect.y + nodeRect.h / 2;
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    const targetTx = containerCenterX - nodeCenterX * this._scale;
    const targetTy = containerCenterY - nodeCenterY * this._scale;

    const dx = targetTx - this._tx;
    const dy = targetTy - this._ty;

    this.move(dx, dy, true);
  }

  /**
   * Remove all event listeners and clean up state.
   */
  destroy() {
    if (this._rafId) {
      const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
      caf(this._rafId);
    }
    if (this._smoothTimeout) clearTimeout(this._smoothTimeout);
    this._container.removeEventListener('wheel', this._onWheel);
    this._container.removeEventListener('keydown', this._onKeyDown);
    this._container.removeEventListener('keyup', this._onKeyUp);
    this._container.removeEventListener('pointerdown', this._onPointerDown);
    this._container.removeEventListener('pointermove', this._onPointerMove);
    this._container.removeEventListener('pointerup', this._onPointerUp);
    this._container.style.touchAction = '';
    this._nodeLayer.style.transition = 'none';
    this._connectorLayer.style.transition = 'none';
  }

  // ===================================================================
  // Private helpers
  // ===================================================================

  /**
   * Write the current (tx, ty, scale) to both layers as a CSS transform.
   */
  _applyTransform() {
    const t = `translate3d(${this._tx}px, ${this._ty}px, 0) scale(${this._scale})`;
    this._nodeLayer.style.transform = t;
    this._connectorLayer.style.transform = t;
  }

  /**
   * Schedule a debounced MINDMAP_VIEWPORT_CHANGED event via rAF.
   */
  _scheduleViewportEvent() {
    if (this._rafId) {
      this._pendingEvent = true;
      return;
    }
    this._pendingEvent = false;
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 16);
    this._rafId = raf(() => {
      this._rafId = null;
      this._fireViewportEvent();
      // If another change arrived during this rAF, fire one more
      if (this._pendingEvent) {
        this._pendingEvent = false;
        this._fireViewportEvent();
      }
    });
  }

  /**
   * Publish MINDMAP_VIEWPORT_CHANGED via EventBus if available.
   */
  _fireViewportEvent() {
    if (!this._eventBus) return;
    try {
      this._eventBus.publish('MINDMAP_VIEWPORT_CHANGED', {
        mapId: this._mapId,
        tx: this._tx,
        ty: this._ty,
        scale: this._scale
      });
    } catch {
      // EventBus may reject unknown events; try sync fallback
      if (typeof this._eventBus.publishSync === 'function') {
        try {
          this._eventBus.publishSync('MINDMAP_VIEWPORT_CHANGED', {
            mapId: this._mapId, tx: this._tx, ty: this._ty, scale: this._scale
          });
        } catch { /* swallow */ }
      }
    }
  }

  // ===================================================================
  // Event handlers
  // ===================================================================

  /** @param {WheelEvent} e */
  _handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Zoom: cursor-centred
      const delta = -e.deltaY;
      // Normalize delta: DOM_DELTA_LINE (~40px per line), DOM_DELTA_PAGE, DOM_DELTA_PIXEL
      let normalized;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        normalized = delta * 40;
      } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        normalized = delta * this._container.clientHeight;
      } else {
        normalized = delta;
      }
      const scaleDelta = (normalized / 100) * this.scaleSensitivity;
      this.scaleTo(this._scale + scaleDelta, { cx: e.clientX, cy: e.clientY });
    } else if (e.shiftKey) {
      // Horizontal pan only
      this.move(-e.deltaY, 0);
    } else {
      // Pan
      this.move(-e.deltaX, -e.deltaY);
    }
  }

  /** @param {KeyboardEvent} e */
  _handleKeyDown(e) {
    if (e.code === 'Space') {
      // Only capture Space if not in an input/editable field
      const tag = /** @type {Element} */ (e.target).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const isEditable = /** @type {Element} */ (e.target).isContentEditable;
      if (isEditable) return;
      e.preventDefault();
      this._spacePressed = true;
      this._container.style.cursor = 'grab';
    }
  }

  /** @param {KeyboardEvent} e */
  _handleKeyUp(e) {
    if (e.code === 'Space') {
      this._spacePressed = false;
      this._container.style.cursor = '';
    }
  }

  /** @param {PointerEvent} e */
  _handlePointerDown(e) {
    if (!this._spacePressed) return;
    // Only primary button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this._isPanning = true;
    this._panStartX = e.clientX;
    this._panStartY = e.clientY;
    this._panTx0 = this._tx;
    this._panTy0 = this._ty;
    this._container.style.cursor = 'grabbing';
    this._container.setPointerCapture(e.pointerId);
  }

  /** @param {PointerEvent} e */
  _handlePointerMove(e) {
    if (!this._isPanning) return;
    const dx = e.clientX - this._panStartX;
    const dy = e.clientY - this._panStartY;
    this._tx = this._panTx0 + dx;
    this._ty = this._panTy0 + dy;
    this._applyTransform();
    this._scheduleViewportEvent();
  }

  /** @param {PointerEvent} e */
  _handlePointerUp(e) {
    if (!this._isPanning) return;
    this._isPanning = false;
    this._container.style.cursor = this._spacePressed ? 'grab' : '';
    try { this._container.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }
}
