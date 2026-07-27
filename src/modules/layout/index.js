import { LayoutContracts } from './contracts/layout-contracts.js';

/**
 * layout module — generic viewport, culling, and render scheduling for CSMA.
 *
 * Contributes reusable DOM utilities with zero CSMA runtime dependencies:
 *
 *   - Viewport: live scroll/pan rect tracking for any DOM scroll container.
 *   - CullingCore: adaptive overscan rect computation with velocity decay.
 *   - RenderScheduler: RAF-based batched rendering with dirty tracking.
 *
 * Consumers:
 *
 *   - MorphEditor: Viewport (1D vertical), CullingCore (1D), RenderScheduler.
 *   - mindmap: Viewport.getVisibleRect2D, CullingCore (2D pan/zoom), RenderScheduler.
 *   - Any scroll-heavy surface: drop in the utilities you need.
 *
 * No ServiceManager registration — these are instantiated directly by
 * consumer modules. No dependencies on other CSMA modules.
 */

export const manifest = {
  id: 'layout',
  name: 'Layout Utilities',
  version: '1.0.0',
  description: 'Viewport tracking, culling, and render scheduling for CSMA surfaces',
  dependencies: [],
  services: [],
  contracts: Object.keys(LayoutContracts),
};

export { Viewport } from './lib/Viewport.js';
export { CullingCore } from './lib/CullingCore.js';
export { RenderScheduler } from './lib/RenderScheduler.js';
export { LayoutContracts } from './contracts/layout-contracts.js';
