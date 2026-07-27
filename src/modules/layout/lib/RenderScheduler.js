/**
 * RenderScheduler — RAF-based render coalescing with dirty tracking.
 *
 * Ensures at most one render per animation frame, regardless of how many
 * mutation events fire. Accumulates dirty state during the frame and
 * passes it to the consumer's render function.
 *
 * Pluggable event bus — emits 'render:scheduled' and 'render:complete'
 * so other modules can react (e.g. culling, stats, debug overlays).
 *
 * Usage:
 *
 *   const scheduler = new RenderScheduler(renderFn, { eventBus });
 *   scheduler.markViewportDirty();   // full redraw
 *   scheduler.markDirty('node-42');  // single entity dirty
 *   scheduler.forceRender();         // bypass RAF, render now
 */

export class RenderScheduler {
  /**
   * @param {Function} renderFn — receives { dirtyViewport: boolean, dirtyIds: string[] }
   * @param {object} [opts]
   * @param {object} [opts.eventBus] — optional EventBus for lifecycle events
   */
  constructor(renderFn, opts = {}) {
    this._renderFn = renderFn;
    this._eventBus = opts.eventBus || null;

    this._needsRender = false;
    this._isRendering = false;
    this._frameId = null;

    this._dirtyViewport = false;
    this._dirtyIds = new Set();

    // Performance history (for getPerfMetrics).
    this._frameTimeHistory = [];
    this._maxFrameHistory = 120; // ~2s at 60fps
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Full redraw — entire surface needs re-render. */
  markViewportDirty() {
    this._dirtyViewport = true;
    this._schedule();
  }

  /** Single entity changed (e.g. one node, one block). */
  markDirty(id) {
    this._dirtyIds.add(id);
    this._schedule();
  }

  /** Multiple entities changed at once. */
  markManyDirty(ids) {
    for (const id of ids) this._dirtyIds.add(id);
    this._schedule();
  }

  /** Everything dirty — equivalent to markViewportDirty + clear partials. */
  markAllDirty() {
    this._dirtyViewport = true;
    this._dirtyIds.clear();
    this._needsRender = true;
    this._schedule();
  }

  /** Render synchronously, bypassing RAF. Skips if already rendering. */
  forceRender() {
    if (this._isRendering) {
      this._needsRender = true;
      return;
    }
    this._execute(performance.now());
  }

  /** Cancel pending frame. */
  cancel() {
    if (this._frameId !== null) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
    this._needsRender = false;
  }

  /** True if a frame is scheduled or in-progress. */
  isScheduled() {
    return this._frameId !== null || this._isRendering || this._needsRender;
  }

  /**
   * Performance metrics since last reset.
   * @returns {{ fps: number, frameTimeP50: number, frameTimeP95: number }}
   */
  getPerfMetrics() {
    const recent = this._frameTimeHistory.slice(-30);
    let fps = 60;
    if (recent.length > 0) {
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      fps = Math.round(1000 / avg) || 60;
    }
    const sorted = [...this._frameTimeHistory].sort((a, b) => a - b);
    const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    return { fps, frameTimeP50: p50, frameTimeP95: p95 };
  }

  // ── Internals ───────────────────────────────────────────────────

  _schedule() {
    if (this._isRendering || this._frameId !== null) {
      this._needsRender = true;
      return;
    }
    this._requestFrame();
  }

  _requestFrame() {
    const startTime = performance.now();
    this._frameId = requestAnimationFrame(() => this._execute(startTime));
  }

  _execute(frameStartTime) {
    this._isRendering = true;
    this._frameId = null;

    const payload = {
      dirtyViewport: this._dirtyViewport,
      dirtyIds: Array.from(this._dirtyIds),
    };

    this._publish('render:scheduled', payload);

    this._renderFn(payload);

    const frameTime = performance.now() - frameStartTime;
    this._recordFrameTime(frameTime);

    this._publish('render:complete', {
      frameTime,
      dirtyCount: payload.dirtyIds.length,
      viewportDirty: payload.dirtyViewport,
    });

    this._dirtyIds.clear();
    this._dirtyViewport = false;
    this._isRendering = false;

    if (this._needsRender) {
      this._needsRender = false;
      this._requestFrame();
    }
  }

  _publish(eventName, payload) {
    if (!this._eventBus) return;
    try {
      if (typeof this._eventBus.publish === 'function') {
        this._eventBus.publish(eventName, payload);
      } else if (typeof this._eventBus.emit === 'function') {
        this._eventBus.emit(eventName, payload);
      }
    } catch {
      // EventBus may reject unknown events; swallow.
    }
  }

  _recordFrameTime(frameTime) {
    this._frameTimeHistory.push(frameTime);
    if (this._frameTimeHistory.length > this._maxFrameHistory) {
      this._frameTimeHistory.shift();
    }
  }
}
