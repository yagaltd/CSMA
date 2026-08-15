/**
 * CSMA slider contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums } from '../validation/index.js';
import { contract } from './helpers.js';

export const SliderContracts = {
    // Slider Component Contracts
    // ========================================

    // UI: Intent to Change Slider Value
    INTENT_SLIDER_VALUE_CHANGED: contract({
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User changed slider value via interaction'
    }, object({
        sliderId: string(),
        value: number(),
        min: number(),
        max: number(),
        step: number(),
        timestamp: number()
    })),

    // UI: Intent to Start Slider Drag
    INTENT_SLIDER_DRAG_STARTED: contract({
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User started dragging slider thumb'
    }, object({
        sliderId: string(),
        startValue: number(),
        timestamp: number()
    })),

    // UI: Intent to End Slider Drag
    INTENT_SLIDER_DRAG_ENDED: contract({
        version: 1,
        type: 'intent',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User finished dragging slider thumb'
    }, object({
        sliderId: string(),
        startValue: number(),
        endValue: number(),
        timestamp: number()
    })),

    // UI: Slider Value Updated Event
    SLIDER_VALUE_UPDATED: contract({
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Slider value was updated and UI should reflect changes'
    }, object({
        sliderId: string(),
        value: number(),
        percentage: number(),
        min: number(),
        max: number(),
        timestamp: number()
    })),

    // UI: Slider State Changed Event
    SLIDER_STATE_CHANGED: contract({
        version: 1,
        type: 'event',
        owner: 'ui-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Slider state changed (dragging, idle, disabled)'
    }, object({
        sliderId: string(),
        state: enums(['idle', 'dragging', 'disabled']),
        timestamp: number()
    })),

};
