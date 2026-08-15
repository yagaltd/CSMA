import { describe, it, expect } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { measureTextWidth, _getMeterCtx } from '../../src/modules/mindmap/services/MindmapTextMeasure.js';

/**
 * MindmapTextMeasure — canvas-based text measurement extracted from
 * MindmapService.js (Phase 6 split). Re-exposed as statics on the facade.
 */

describe('MindmapTextMeasure (split piece)', () => {
  it('is re-attached as statics on MindmapService', () => {
    expect(MindmapService.measureTextWidth).toBe(measureTextWidth);
    expect(MindmapService._getMeterCtx).toBe(_getMeterCtx);
  });

  it('falls back to a length-based estimate without canvas 2d context', () => {
    // jsdom's canvas getContext returns null → the estimate branch runs.
    const w = measureTextWidth('hello world');
    expect(typeof w).toBe('number');
    expect(w).toBeGreaterThan(0);
    expect(w).toBeCloseTo('hello world'.length * 8 + 24, 0);
  });
});
