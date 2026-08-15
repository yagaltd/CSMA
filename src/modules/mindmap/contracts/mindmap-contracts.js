import { object, string, optional, array, any, enums, number, boolean } from '../../../runtime/validation/index.js';
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

  MINDMAP_FOCUS_CHANGED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when the focus / isolation set or scope changes.'
  }, object({
    mapId: string(),
    focusIds: array(string()),
    scope: enums(['branch', 'subtree']),
    active: any()
  })),

  MINDMAP_ARROW_ADDED: contract(
    { version: 1, type: 'event', owner: 'mindmap', lifecycle: 'active', stability: 'stable', compliance: 'public', description: 'Published when a cross-link arrow is added.' },
    object({ mapId: string(), arrow: object({ id: string(), from: string(), to: string(), direction: enums(['forward', 'bidirectional']), label: optional(any()), style: optional(any()) }) })
  ),

  MINDMAP_ARROW_REMOVED: contract(
    { version: 1, type: 'event', owner: 'mindmap', lifecycle: 'active', stability: 'stable', compliance: 'public', description: 'Published when a cross-link arrow is removed.' },
    object({ mapId: string(), arrowId: string() })
  ),

  MINDMAP_ARROW_UPDATED: contract(
    { version: 1, type: 'event', owner: 'mindmap', lifecycle: 'active', stability: 'stable', compliance: 'public', description: 'Published when a cross-link arrow is updated.' },
    object({ mapId: string(), arrow: object({ id: string(), from: string(), to: string(), direction: enums(['forward', 'bidirectional']), label: optional(any()), style: optional(any()) }) })
  ),

  MINDMAP_ARROW_SELECTED: contract(
    { version: 1, type: 'event', owner: 'mindmap', lifecycle: 'active', stability: 'stable', compliance: 'public', description: 'Published when a cross-link arrow is selected.' },
    object({ mapId: string(), arrowId: string(), from: string(), to: string() })
  ),

  MINDMAP_LINK_MODE_CHANGED: contract(
    { version: 1, type: 'event', owner: 'mindmap', lifecycle: 'active', stability: 'stable', compliance: 'public', description: 'Published when link mode starts/stops.' },
    object({ mapId: string(), active: any(), direction: optional(enums(['forward', 'bidirectional'])), source: optional(string()) })
  ),

  MINDMAP_FOCUS_REQUESTED: contract(
    { version: 1, type: 'event', owner: 'mindmap', lifecycle: 'active', stability: 'stable', compliance: 'public', description: 'Inbound request to isolate (focus) a node set on the live surface (§11.9 / Wave 3 focus).' },
    object({ mapId: string(), focusIds: array(string()), scope: optional(enums(['branch', 'subtree'])) })
  ),

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
  })),

  // ── Viewport & keyboard (ViewportController / KeyboardHandler) ───────

  MINDMAP_VIEWPORT_CHANGED: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published (debounced via rAF) when the viewport pan/zoom transform changes'
  }, object({
    mapId: string(),
    tx: number(),
    ty: number(),
    scale: number()
  })),

  MINDMAP_KEYBOARD_SHORTCUT: contract({
    version: 1,
    type: 'event',
    owner: 'mindmap',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published when a registered keyboard shortcut fires (debugging / extensibility)'
  }, object({
    mapId: string(),
    shortcut: string(),
    key: string(),
    ctrl: boolean(),
    meta: boolean(),
    shift: boolean(),
    alt: boolean()
  }))
};
