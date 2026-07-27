/**
 * CullingCore — viewport-aware visible-rect computation with overscan.
 *
 * Pure calculation, no DOM mutation, no data-model coupling.
 * Consumers feed it scroll/pan state and get back a rectangle that
 * includes overscan (extra margin for smooth scrolling without pop-in).
 *
 * Overscan adapts dynamically — faster scrolling = larger overscan
 * (velocity-decay model). The caller is responsible for using the
 * returned rect to filter its own data structure.
 *
 * Usage:
 *
 *   // 1D vertical (MorphEditor)
 *   const culling = new CullingCore({ getScrollTop: () => container.scrollTop });
 *   // … on each scroll event:
 *   culling.update();
 *   const vr = culling.getVisibleRect1D(viewportHeight);
 *   const visible = blockLayout.getBlocksInRange(vr.top, vr.bottom);
 *
 *   // 2D pan/zoom (mindmap)
 *   const culling = new CullingCore({
 *     getPanX: () => viewportController.panX,
 *     getPanY: () => viewportController.panY,
 *     getScale: () => viewportController.scale,
 *   });
 *   // … on each pan/zoom event:
 *   culling.update();
 *   const vr = culling.getVisibleRect2D(containerWidth, containerHeight);
 *   const visible = allNodes.filter(n => rectsIntersect(n, vr));
 */

export class CullingCore {
  constructor(opts = {}) {
    this._getScrollTop = opts.getScrollTop || (() => 0);
    this._getScrollLeft = opts.getScrollLeft || (() => 0);
    this._getPanX = opts.getPanX || (() => 0);
    this._getPanY = opts.getPanY || (() => 0);
    this._getScale = opts.getScale || (() => 1);

    this._baseOverscan = opts.baseOverscan ?? 100;
    this._maxOverscan = opts.maxOverscan ?? 300;
    this._decayFactor = opts.decayFactor ?? 0.8;

    this._overscan = this._baseOverscan;
    this._velocityX = 0;
    this._velocityY = 0;
    this._lastScrollTop = 0;
    this._lastScrollLeft = 0;
    this._lastPanX = 0;
    this._lastPanY = 0;
    this._lastUpdateTime = 0;

    this._mode = opts.mode || (opts.getPanX || opts.getPanY ? '2d' : '1d');
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Call on every scroll/pan event, or on a timer. */
  update() {
    const now = performance.now();
    const dt = now - this._lastUpdateTime;

    if (this._mode === '2d') {
      this._update2D(now, dt);
    } else {
      this._update1D(now, dt);
    }

    this._lastUpdateTime = now;
  }

  /** Call when scrolling stops — resets overscan to base. */
  reset() {
    this._overscan = this._baseOverscan;
    this._velocityX = 0;
    this._velocityY = 0;
  }

  // ── Visible rect ────────────────────────────────────────────────

  /**
   * 1D vertical visible rect with overscan (top/bottom only).
   * @param {number} viewportHeight
   * @returns {{ top: number, bottom: number, overscan: number }}
   */
  getVisibleRect1D(viewportHeight) {
    const scrollTop = this._getScrollTop();
    return {
      top: Math.max(0, scrollTop - this._overscan),
      bottom: scrollTop + viewportHeight + this._overscan,
      overscan: this._overscan,
    };
  }

  /**
   * 2D visible rect with overscan (all four sides).
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   * @returns {{ x: number, y: number, w: number, h: number, right: number, bottom: number, overscan: number }}
   */
  getVisibleRect2D(viewportWidth, viewportHeight) {
    const scale = this._getScale() || 1;
    const panX = this._getPanX();
    const panY = this._getPanY();
    const o = this._overscan;

    const x = (-panX - o) / scale;
    const y = (-panY - o) / scale;
    const w = (viewportWidth + o * 2) / scale;
    const h = (viewportHeight + o * 2) / scale;

    return {
      x, y, w, h,
      get right() { return this.x + this.w; },
      get bottom() { return this.y + this.h; },
      overscan: this._overscan,
    };
  }

  // ── Stats ───────────────────────────────────────────────────────

  getOverscan() {
    return this._overscan;
  }

  getVelocity() {
    return { x: this._velocityX, y: this._velocityY };
  }

  // ── Internals ───────────────────────────────────────────────────

  _update1D(now, dt) {
    const scrollTop = this._getScrollTop();
    if (dt > 0 && this._lastUpdateTime > 0) {
      const deltaScroll = scrollTop - this._lastScrollTop;
      const instantVelocity = Math.abs(deltaScroll / (dt / 1000)); // px/s
      this._velocityY = this._velocityY * this._decayFactor + instantVelocity * (1 - this._decayFactor);
    }
    this._lastScrollTop = scrollTop;

    // Map velocity to overscan (logarithmic — fast diminishing returns).
    const factor = Math.min(this._velocityY / 3000, 1);
    this._overscan = this._baseOverscan + (this._maxOverscan - this._baseOverscan) * factor;
  }

  _update2D(now, dt) {
    const panX = this._getPanX();
    const panY = this._getPanY();
    if (dt > 0 && this._lastUpdateTime > 0) {
      const dx = panX - this._lastPanX;
      const dy = panY - this._lastPanY;
      const d = Math.hypot(dx, dy);
      const instantVelocity = d / (dt / 1000);
      // Use the same velocity model for both axes — pan velocity is one scalar.
      this._velocityY = this._velocityY * this._decayFactor + instantVelocity * (1 - this._decayFactor);
    }
    this._lastPanX = panX;
    this._lastPanY = panY;

    const factor = Math.min(this._velocityY / 3000, 1);
    this._overscan = this._baseOverscan + (this._maxOverscan - this._baseOverscan) * factor;
  }
}
