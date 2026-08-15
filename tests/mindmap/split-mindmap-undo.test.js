import { describe, it, expect } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { MindmapUndo } from '../../src/modules/mindmap/services/MindmapUndo.js';

/**
 * MindmapUndo — undo/redo section extracted from MindmapService.js
 * (Phase 6 split). Full undo/redo behavior with the real HistoryService is
 * covered by undo-redo.test.js (unchanged); this file pins the mixin wiring
 * and the no-history edge cases.
 */

function makeEventBus() {
  return { subscribe() {}, unsubscribe() {}, publish() {} };
}

describe('MindmapUndo (split piece)', () => {
  it('is mixed onto MindmapService.prototype', () => {
    expect(MindmapService.prototype.canUndo).toBe(MindmapUndo.canUndo);
    expect(MindmapService.prototype.canRedo).toBe(MindmapUndo.canRedo);
    expect(MindmapService.prototype.undo).toBe(MindmapUndo.undo);
    expect(MindmapService.prototype.redo).toBe(MindmapUndo.redo);
    expect(MindmapService.prototype._revertOp).toBe(MindmapUndo._revertOp);
    expect(MindmapService.prototype._reapplyOp).toBe(MindmapUndo._reapplyOp);
  });

  it('canUndo/canRedo are false without a history service', () => {
    const svc = new MindmapService(makeEventBus());
    svc.init({ storage: null });
    expect(svc.canUndo()).toBe(false);
    expect(svc.canRedo()).toBe(false);
  });

  it('undo/redo return null without a history service', async () => {
    const svc = new MindmapService(makeEventBus());
    svc.init({ storage: null });
    await expect(svc.undo()).resolves.toBeNull();
    await expect(svc.redo()).resolves.toBeNull();
  });
});
