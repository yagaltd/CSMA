/**
 * MindmapNode - NodeObj factories, id/time helpers, and schema constants
 * shared by MindmapService and its section siblings.
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Cut/paste move; no behavior
 * changes.
 */

import { uid } from '../../../utils/id.js';
export const SCHEMA_BRANCH = 'mindmap/branch';
export const SCHEMA_LEAF = 'mindmap/leaf';

// Branch hue palette — cycled through for auto-assigned per-branch colors.
// Hues chosen to be visually distinct, theme-agnostic (CSS derives actual
// colors from the hue via hsl() with light/dark-aware lightness values).
const BRANCH_HUES = [210, 30, 175, 340, 130, 50, 275, 160];
let _nextHueIdx = 0;
function _nextBranchHue() {
  const h = BRANCH_HUES[_nextHueIdx % BRANCH_HUES.length];
  _nextHueIdx++;
  return h;
}

export function generateId(prefix = 'n') {
  return `${prefix}_${uid()}`;
}

export function now() {
  return Date.now();
}

export function makeRoot(name) {
  return {
    id: generateId('root'),
    topic: name,
    schemaType: SCHEMA_BRANCH,
    status: 'pending',
    children: [],
    expanded: true,
    direction: 0,
    branchHue: BRANCH_HUES[0], // root always blue
    metadata: { leafCount: 0, doneCount: 0 },
    updatedAt: now()
  };
}

export function makeBranch(topic, meta = {}) {
  return {
    id: generateId('branch'),
    topic,
    schemaType: SCHEMA_BRANCH,
    status: meta.status || 'pending',
    tag: meta.tag || 'module',
    children: [],
    expanded: true,
    direction: 0,
    branchHue: meta.branchHue || _nextBranchHue(),
    metadata: { leafCount: 0, doneCount: 0, ...(meta.metadata || {}) },
    updatedAt: now()
  };
}

export function makeLeaf(topic, meta = {}) {
  return {
    id: generateId('leaf'),
    topic,
    schemaType: SCHEMA_LEAF,
    status: meta.status || 'pending',
    children: [],
    branchHue: meta.branchHue || _nextBranchHue(),
    metadata: {
      specPath: meta.specPath || null,
      bottleneck: meta.bottleneck || 'standard',
      note: meta.note || null,
      leafCount: 0,
      doneCount: 0
    },
    updatedAt: now()
  };
}
