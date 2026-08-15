import { object, string, optional, array, number, any } from '../../../runtime/validation/index.js';
import { contract } from '../../../runtime/Contracts.js';

/**
 * Layout module — EventBus contracts.
 *
 * These are lightweight utility contracts. The layout module itself
 * publishes 'render:scheduled' / 'render:complete' (RenderScheduler);
 * consumer modules may publish VIEWPORT_CHANGED to inform culling.
 */

export const LayoutContracts = {
  'render:scheduled': contract({
    version: 1,
    type: 'event',
    owner: 'layout',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published before a batched render begins. Carries dirty state for this frame.'
  }, object({
    dirtyViewport: any(),
    dirtyIds: array(string())
  })),

  'render:complete': contract({
    version: 1,
    type: 'event',
    owner: 'layout',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Published after a batched render completes. Includes frame timing stats.'
  }, object({
    frameTime: number(),
    dirtyCount: number(),
    viewportDirty: any()
  })),

  VIEWPORT_CHANGED: contract({
    version: 1,
    type: 'event',
    owner: 'layout',
    lifecycle: 'active',
    stability: 'stable',
    compliance: 'public',
    description: 'Consumer-published when viewport scroll/pan/zoom/resize changes. Used by culling to schedule re-evaluation.'
  }, object({
    scrollTop: optional(number()),
    scrollLeft: optional(number()),
    panX: optional(number()),
    panY: optional(number()),
    scale: optional(number()),
    width: optional(number()),
    height: optional(number())
  }))
};
