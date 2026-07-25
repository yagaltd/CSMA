import { object, string, optional, array, any, enums, number } from '../../../runtime/validation/index.js';
import { contract } from '../../../runtime/Contracts.js';

/**
 * Mindmap module — EventBus contracts.
 *
 * All events carry `mapId` so subscribers can scope to the active map.
 * Payloads follow the NodeObj shape (see plan.md §NodeObj).
 */

const STATUS_ENUM = enums(['pending', 'in_progress', 'done', 'blocked', 'abandoned', 'failed']);
const SCHEMA_TYPE_ENUM = enums(['mindmap/branch', 'mindmap/leaf']);

export const MindmapContracts = {
  MINDMAP_NODE_ADDED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a node (branch or leaf) is added to a map'
  }, object({
    mapId: string(),
    nodeId: string(),
    parentId: optional(string()),
    node: object({
      id: string(),
      topic: string(),
      schemaType: SCHEMA_TYPE_ENUM,
      status: STATUS_ENUM
    })
  })),

  MINDMAP_NODE_REMOVED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a node is removed. cascaded lists child ids also removed.'
  }, object({
    mapId: string(),
    nodeId: string(),
    cascaded: array(string())
  })),

  MINDMAP_NODE_UPDATED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when node properties change (topic, status, metadata, ...)'
  }, object({
    mapId: string(),
    nodeId: string(),
    changes: object(),
    previousStatus: optional(string())
  })),

  MINDMAP_STRUCTURE_CHANGED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when the tree structure changes (collapse, expand, reorder within parent). moveNode publishes MINDMAP_NODE_MOVED instead.'
  }, object({
    mapId: string(),
    nodeId: string(),
    operation: enums(['collapse', 'expand', 'reorder']),
    details: optional(object())
  })),

  MINDMAP_NODE_MOVED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a node is reparented'
  }, object({
    mapId: string(),
    nodeId: string(),
    fromParent: string(),
    toParent: string(),
    index: optional(number())
  })),

  MINDMAP_COLLAPSED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a branch is collapsed or expanded (also fires MINDMAP_STRUCTURE_CHANGED with operation=collapse|expand; this event is the narrow semantic signal for chrome UIs).'
  }, object({
    mapId: string(),
    nodeId: string(),
    collapsed: any()
  })),

  MINDMAP_MAP_CREATED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a new map is created'
  }, object({
    mapId: string(),
    name: string()
  })),

  MINDMAP_MAP_DELETED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a map is deleted'
  }, object({
    mapId: string()
  })),

  // ── Phase 10 — Selection & inline editing ────────────────────────

  MINDMAP_NODE_SELECTED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a single node is selected'
  }, object({
    mapId: string(),
    nodeId: string()
  })),

  MINDMAP_NODES_SELECTED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when the selection set changes (multi-select)'
  }, object({
    mapId: string(),
    nodeIds: array(string())
  })),

  MINDMAP_SELECTION_CLEARED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when the selection is cleared (canvas click, etc.)'
  }, object({
    mapId: string()
  })),

  MINDMAP_NODE_EDIT_START: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when inline editing begins on a node'
  }, object({
    mapId: string(),
    nodeId: string()
  })),

  MINDMAP_NODE_EDIT_END: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when inline editing ends (committed or cancelled)'
  }, object({
    mapId: string(),
    nodeId: string(),
    committed: any()
  }))
};
