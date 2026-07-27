/**
 * Viewport — scroll-aware viewport rect tracking for any scrollable DOM element.
 *
 * Generic. No CSMA dependencies. Used by MorphEditor (1D vertical scrolling)
 * and mindmap (2D pan/zoom via ViewportController wrapper).
 *
 * Always reads live scroll positions from the DOM — never caches stale values.
 * Supports both top-down and bottom-up content orientation.
 */

export class Viewport {
  constructor(container) {
    this.container = container;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.orientation = 'top-down';
    this.contentHeight = 0;

    this._handleResize = this._handleResize.bind(this);
    this._handleScroll = this._handleScroll.bind(this);
  }

  /** Attach resize/scroll listeners. */
  init() {
    this._handleResize();
    window.addEventListener('resize', this._handleResize);
    this.container.addEventListener('scroll', this._handleScroll);
  }

  /** Detach listeners. */
  destroy() {
    window.removeEventListener('resize', this._handleResize);
    this.container.removeEventListener('scroll', this._handleScroll);
  }

  // ── Live dimensions ─────────────────────────────────────────────

  get scrollTop() {
    return this.container?.scrollTop || 0;
  }

  get scrollLeft() {
    return this.container?.scrollLeft || 0;
  }

  getScaledSize() {
    return {
      width: this.width * this.dpr,
      height: this.height * this.dpr,
    };
  }

  // ── Visible rect (world coordinates) ────────────────────────────

  /**
   * 1D viewport rect (for vertical-scrolling consumers like MorphEditor).
   * @returns {{ top: number, bottom: number }}
   */
  getVisibleRect() {
    const scrollTop = this.scrollTop;
    const flowOffset = this._getFlowOffset();
    const top = Math.max(0, scrollTop - flowOffset);
    return {
      top,
      bottom: scrollTop + this.height - flowOffset,
    };
  }

  /**
   * 2D viewport rect (for pan/zoom consumers like mindmap).
   * @param {{ x?: number, y?: number, scale?: number }} [transform]
   *   - transform.x / transform.y: pan offset in world pixels
   *   - transform.scale: zoom level (default 1)
   * @returns {{ x: number, y: number, w: number, h: number, right: number, bottom: number }}
   */
  getVisibleRect2D(transform = {}) {
    const scale = transform.scale || 1;
    const panX = transform.x || 0;
    const panY = transform.y || 0;
    return {
      x: -panX / scale,
      y: -panY / scale,
      w: this.width / scale,
      h: this.height / scale,
      get right() { return this.x + this.w; },
      get bottom() { return this.y + this.h; },
    };
  }

  // ── Orientation ─────────────────────────────────────────────────

  setContentHeight(height) {
    this.contentHeight = Math.max(0, Number(height) || 0);
  }

  setOrientation(orientation) {
    this.orientation = orientation === 'bottom-up' ? 'bottom-up' : 'top-down';
  }

  getOrientation() {
    return this.orientation;
  }

  /** @private */
  _getFlowOffset() {
    if (this.orientation !== 'bottom-up') return 0;
    return Math.max(0, this.height - this.contentHeight);
  }

  // ── Coordinate conversion ───────────────────────────────────────

  worldToScreenY(worldY) {
    return worldY - this.scrollTop + this._getFlowOffset();
  }

  screenToWorldY(screenY) {
    return screenY + this.scrollTop - this._getFlowOffset();
  }

  worldToOverlayY(worldY) {
    return this.worldToScreenY(worldY) + this.scrollTop;
  }

  // ── Internals ───────────────────────────────────────────────────

  _handleResize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = window.devicePixelRatio || 1;
  }

  _handleScroll() {
    // Intentionally empty — scrollTop is always read live from the
    // container so async-panning browsers (Firefox APZ) don't drift.
  }
}
