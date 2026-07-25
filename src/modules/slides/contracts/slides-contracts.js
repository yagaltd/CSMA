import { object, string, optional, array, number, boolean, any, size, enums } from '../../../runtime/validation/index.js';
import { contract } from '../../../runtime/Contracts.js';

/**
 * Slides module — EventBus contracts.
 *
 * Two groups:
 *   - INTENT_* contracts (user/agent → service): navigation, annotation, notes,
 *     export. All rate-limited. The agent drives the deck by publishing intents.
 *   - State events (service → UI): SLIDE_CHANGED, BUILD_ADVANCED, DECK_READY,
 *     DECK_DESTROYED, UI_STATE_CHANGED, PRESENTER_SYNC, ANNOTATION_UPDATED,
 *     DECK_EXPORT_COMPLETED.
 *
 * Every user interaction with the deck goes through a validated INTENT_* —
 * no direct DOM mutation by chrome. CSMA architecture rule §3.4 of plan.
 */

// ─── Navigation intents (user → service) ──────────────────────────────

const NAV_RATE = { requests: 10, windowMs: 1000, scope: 'session' };
const SLOW_RATE = { requests: 5, windowMs: 1000, scope: 'session' };

export const SlidesContracts = {
    INTENT_SLIDE_NEXT: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: NAV_RATE },
        description: 'Advance one build step, or if at max, advance to next slide'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_PREV: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: NAV_RATE },
        description: 'Reverse one build step, or if at zero, go to previous slide'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_GO: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Jump to a specific slide index (0-based)'
    }, object({ index: number(), timestamp: number() })),

    INTENT_SLIDE_FIRST: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Jump to the first slide (Home key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_LAST: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Jump to the last slide (End key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_TOGGLE_RAIL: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Toggle the thumbnail sidebar (S key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_TOGGLE_GRID: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Toggle the grid overview (G key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_TOGGLE_FS: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: { requests: 3, windowMs: 1000, scope: 'session' } },
        description: 'Toggle browser fullscreen (F key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_TOGGLE_DRAWING: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Toggle the annotation overlay (A key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_OPEN_PRESENTER: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: { requests: 2, windowMs: 1000, scope: 'session' } },
        description: 'Open the presenter view in a new tab (P key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_HIDE_UI: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Hide all chrome for clean projection (H key)'
    }, object({ timestamp: number() })),

    INTENT_SLIDE_ESCAPE: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Escape key — close grid/rail/drawing, or exit fullscreen'
    }, object({ timestamp: number() })),

    // ─── Annotation intents ───────────────────────────────────────────

    INTENT_ANNOTATION_STROKE: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: { requests: 120, windowMs: 1000, scope: 'session' } },
        description: 'Record a freehand stroke on the current slide'
    }, object({
        slide: number(),
        points: array(object({ x: number(), y: number() })),
        color: size(string(), 1, 32),
        width: number(),
        timestamp: optional(number())
    })),

    INTENT_ANNOTATION_CLEAR: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Clear all annotations on a slide'
    }, object({ slide: number(), timestamp: optional(number()) })),

    INTENT_ANNOTATION_UNDO: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: SLOW_RATE },
        description: 'Undo the last annotation stroke on a slide'
    }, object({ slide: number(), timestamp: optional(number()) })),

    // ─── Note intents ─────────────────────────────────────────────────

    INTENT_SLIDE_NOTE_UPDATE: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: { requests: 10, windowMs: 1000, scope: 'session' } },
        description: 'Update presenter notes for a slide (presenter view)'
    }, object({
        slide: number(),
        text: size(string(), 0, 5000),
        timestamp: optional(number())
    })),

    // ─── State events (service → UI) ──────────────────────────────────

    SLIDE_CHANGED: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'Current slide index changed (or clicks reset on navigation)'
    }, object({
        slide: number(),
        total: number(),
        clicks: number()
    })),

    BUILD_ADVANCED: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'A click-build step was revealed on the current slide'
    }, object({
        slide: number(),
        click: number(),
        maxClicks: number()
    })),

    DECK_READY: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'Deck finished initial render from config — chrome may mount'
    }, object({
        total: number(),
        config: object()
    })),

    DECK_DESTROYED: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'Deck teardown complete — listeners and DOM cleaned up'
    }, object({})),

    UI_STATE_CHANGED: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'A UI visibility toggle changed (rail/grid/drawing/fs/uiHidden)'
    }, object({
        railOpen: boolean(),
        gridOpen: boolean(),
        drawing: boolean(),
        fs: boolean(),
        uiHidden: boolean()
    })),

    PRESENTER_SYNC: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'Cross-tab state sync — presenter follows main deck'
    }, object({
        slide: number(),
        clicks: number()
    })),

    ANNOTATION_UPDATED: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'Annotations changed on a slide — SVG overlay re-renders'
    }, object({
        slide: number(),
        strokes: array(any())
    })),

    // ─── Export intents (Phase 5 stub; full export via media module) ──

    INTENT_DECK_EXPORT_PNG: contract({
        version: 1, type: 'intent', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        security: { rateLimits: { requests: 2, windowMs: 1000, scope: 'session' } },
        description: 'Request a PNG export of a slide (stub — full impl via media module)'
    }, object({
        slide: number(),
        width: optional(number()),
        height: optional(number()),
        scale: optional(number()),
        timestamp: optional(number())
    })),

    DECK_EXPORT_COMPLETED: contract({
        version: 1, type: 'event', owner: 'slides',
        lifecycle: 'active', stability: 'stable', compliance: 'public',
        description: 'A slide export completed — payload carries the blob'
    }, object({
        slide: number(),
        blob: any(),
        mimeType: size(string(), 1, 64)
    }))
};
