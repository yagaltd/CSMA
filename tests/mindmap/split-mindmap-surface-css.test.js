import { describe, it, expect } from 'vitest';
import { MindmapService } from '../../src/modules/mindmap/services/MindmapService.js';
import { SURFACE_CSS } from '../../src/modules/mindmap/services/MindmapSurfaceCSS.js';

/**
 * MindmapSurfaceCSS — mounted-surface stylesheet extracted from
 * MindmapService.js (Phase 6 split). Re-attached as `static SURFACE_CSS`.
 */

describe('MindmapSurfaceCSS (split piece)', () => {
  it('is re-attached as a static on MindmapService', () => {
    expect(MindmapService.SURFACE_CSS).toBe(SURFACE_CSS);
  });

  it('carries the surface stylesheet content', () => {
    expect(typeof SURFACE_CSS).toBe('string');
    expect(SURFACE_CSS.length).toBeGreaterThan(100);
    expect(SURFACE_CSS).toContain('.mm-canvas');
    expect(SURFACE_CSS).toContain('.mm-toolbar');
    expect(SURFACE_CSS).toContain('.mm-focus-pill');
  });
});
