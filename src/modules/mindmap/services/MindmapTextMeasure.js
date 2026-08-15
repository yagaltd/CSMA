/**
 * MindmapTextMeasure - canvas-based text measurement (no DOM reflow).
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Cut/paste move with
 * extraction-forced adaptation: a module-level meter cache replaces the
 * former `static _meterCanvas/_meterCtx` class fields, and the
 * `MindmapService.*` self-references become local calls. Identical behavior;
 * MindmapService.js re-exposes the functions as statics.
 */

let _meterCanvas = null;
let _meterCtx = null;

export function _getMeterCtx() {
  if (!_meterCanvas) {
    _meterCanvas = (typeof document !== 'undefined')
      ? document.createElement('canvas')
      : { getContext: () => null };
    _meterCtx = _meterCanvas.getContext('2d');
  }
  return _meterCtx;
}

/** Shared text-measurement: approximate width for a 14px system-ui string. */
export function measureTextWidth(text, opts = {}) {
  const ctx = _getMeterCtx();
  if (!ctx) return (String(text || '').length * 8 + 24);
  const weight = opts.weight || '400';
  const size = opts.size || 14;
  const family = opts.family || 'system-ui, -apple-system, sans-serif';
  ctx.font = `${weight} ${size}px ${family}`;
  return ctx.measureText(String(text || '')).width + 1.5;
}
