import { SlideDeckService } from './services/SlideDeckService.js';
import { SlidesContracts } from './contracts/slides-contracts.js';

/**
 * slides module — presentation deck engine.
 *
 * Replaces bolt-slides / Slidev with vanilla JS DOM factories, CSS-driven
 * state, and EventBus contracts. The deck reads its config from
 * `window.__DECK_CONFIG__` (or via service.init(config)).
 *
 * Architecture (plan §3):
 *   - State ownership:  SlideDeckService is the single source of truth.
 *   - CSS-first motion: all animation via transitions + data-* toggles.
 *   - textContent only: no innerHTML anywhere.
 *   - Contracts:        every interaction publishes a validated INTENT_*.
 *
 * Dependencies: none required at runtime. Cross-tab presenter sync uses
 * BroadcastChannel; canvas thumbnails (Phase 5+) use the optional media module.
 */

export const manifest = {
    id: 'slides',
    name: 'Slides',
    version: '1.0.0',
    description: 'Presentation deck engine — vanilla JS DOM factories, CSS-driven state, EventBus contracts. 24 layout factories, dock/rail/grid/presenter chrome, annotation overlay, cross-tab presenter sync.',
    dependencies: [],
    services: ['slideDeck'],
    bundleSize: '~25KB',
    contracts: Object.keys(SlidesContracts),
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: []
    }
};

export const services = {
    slideDeck: SlideDeckService
};

export const contracts = SlidesContracts;

// Re-exports for direct programmatic use.
export { SlideDeckService } from './services/SlideDeckService.js';
export { SlidesContracts } from './contracts/slides-contracts.js';
export { mountDeck, readIndexFromHash } from './engine/deck.js';
export { createBuildElement, bindBuildToService, syncBuildVisibility } from './engine/build.js';
export { animateSlideTransition } from './engine/transitions.js';
export { renderThumbnail, createPlaceholderThumbnail } from './engine/thumbnails.js';
export { initAnnotator } from './engine/annotator.js';
export { initDock } from './chrome/dock.js';
export { initRail } from './chrome/rail.js';
export { initGrid } from './chrome/grid.js';
export { initPresenter } from './chrome/presenter.js';
export { LAYOUT_FACTORIES, LAYOUT_TYPES, renderSlide } from './layouts/index.js';
export { mountCountUp } from './ui/count-up.js';
export { mountTiltCard } from './ui/tilt-card.js';
