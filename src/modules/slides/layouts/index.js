/**
 * layouts/index.js — central layout registry.
 *
 * Maps `slide.type` → factory function. Each factory takes the slide config
 * and returns an HTMLElement. deck.js renderSlide() looks up the factory here.
 *
 * Layouts are pure — no EventBus access, no service calls. The deck wires
 * post-mount behaviors (count-ups, build registration, tab click handlers).
 */

import { createCoverSlide }        from './cover.js';
import { createSplitSlide }        from './split.js';
import { createBentoSlide }        from './bento.js';
import { createGlobeSlide }        from './globe.js';
import { createStatGridSlide }     from './stat-grid.js';
import { createBigNumberSlide }    from './big-number.js';
import { createContrastSlide }     from './contrast.js';
import { createQuoteSlide }        from './quote.js';
import { createComparisonSlide }   from './comparison.js';
import { createTableSlide }        from './table.js';
import { createStepsSlide }        from './steps.js';
import { createTimelineSlide }     from './timeline.js';
import { createChatSlide }         from './chat.js';
import { createPricingSlide }      from './pricing.js';
import { createAccordionSlide }    from './accordion.js';
import { createTabsSlide }         from './tabs.js';
import { createTeamSlide }         from './team.js';
import { createCodeWindowSlide }   from './code-window.js';
import { createBrowserFrameSlide } from './browser-frame.js';
import { createSpotlightCardSlide } from './spotlight-card.js';
import { createAgendaSlide }       from './agenda.js';
import { createSectionSlide }      from './section.js';
import { createMarqueeSlide }      from './marquee.js';
import { createCtaSlide }          from './cta.js';
import { spec } from './_shared.js';
import { AIUIComposerService } from '../../ai-ui/services/AIUIComposerService.js';

// Lazy default composer used by renderSlide()/buildSlide() when no composer is
// supplied. It has no EventBus / serviceManager, so it can mount raw-HTML spec
// trees (all current layouts) but NOT module surfaces. Callers that embed
// module surfaces (comments/video/charts) must pass a real composer
// via opts.composer (e.g. mountDeck passes the app composer).
let _defaultComposer = null;
function getDefaultComposer() {
    if (!_defaultComposer) _defaultComposer = new AIUIComposerService(null, null);
    return _defaultComposer;
}

function isSpecNode(value) {
    return Boolean(value)
        && typeof value === 'object'
        && !(typeof Node !== 'undefined' && value instanceof Node)
        && !Array.isArray(value)
        && (typeof value.tag === 'string' || typeof value.component === 'string');
}

const noopCleanup = () => {};

export const LAYOUT_FACTORIES = {
    cover: createCoverSlide,
    split: createSplitSlide,
    bento: createBentoSlide,
    globe: createGlobeSlide,
    'stat-grid': createStatGridSlide,
    'big-number': createBigNumberSlide,
    contrast: createContrastSlide,
    quote: createQuoteSlide,
    comparison: createComparisonSlide,
    table: createTableSlide,
    steps: createStepsSlide,
    timeline: createTimelineSlide,
    chat: createChatSlide,
    pricing: createPricingSlide,
    accordion: createAccordionSlide,
    tabs: createTabsSlide,
    team: createTeamSlide,
    'code-window': createCodeWindowSlide,
    'browser-frame': createBrowserFrameSlide,
    'spotlight-card': createSpotlightCardSlide,
    agenda: createAgendaSlide,
    section: createSectionSlide,
    marquee: createMarqueeSlide,
    cta: createCtaSlide
};

export const LAYOUT_TYPES = Object.keys(LAYOUT_FACTORIES);

// Layouts that return content-only (no `.slide` shell) when called as a top-level
// slide type. The registry wraps them so every deck slide is a full `.slide`.
// When these same factories are used as embedded media panels (e.g. inside a
// `split`), they're called directly by the parent layout — no wrapping.
const CONTENT_ONLY_LAYOUTS = new Set(['code-window', 'browser-frame']);

/**
 * Build (and, for spec-emitting layouts, mount) a slide. Returns the slide
 * element plus a cleanup function that tears down any mounted aiui surfaces.
 *
 * This is the Layer-2 → Layer-1 hand-off: a layout factory returns either a
 * DOM Node (back-compat, not-yet-converted layouts) or a spec tree (Phase
 * 2.0+ layouts). Spec trees are mounted via the composer's `mountTree()`.
 *
 * @param {object} config — slide config from window.__DECK_CONFIG__.slides[i]
 * @param {object} [opts]
 * @param {object} [opts.composer] — AIUIComposerService (required to embed
 *        module surfaces; defaults to a raw-mount-only composer)
 * @param {Document} [opts.documentRef]
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
export function buildSlide(config, opts = {}) {
    if (!config || typeof config !== 'object') {
        return { element: createFallbackSlide(config), cleanup: noopCleanup };
    }
    const factory = LAYOUT_FACTORIES[config.type];
    if (!factory) {
        return { element: createFallbackSlide(config), cleanup: noopCleanup };
    }

    const result = factory(config);

    const composer = opts.composer || getDefaultComposer();
    const documentRef = opts.documentRef || (typeof document !== 'undefined' ? document : undefined);

    let element;
    let cleanup = noopCleanup;
    if (result instanceof Node) {
        // Back-compat: layout still returns DOM (not yet converted to spec).
        element = result;
    } else if (isSpecNode(result)) {
        const mounted = composer.mountTree(result, null, { documentRef });
        element = mounted.root;
        cleanup = mounted.cleanup;
    } else {
        element = createFallbackSlide(config);
    }

    // code-window / browser-frame return content-only (no `.slide` shell) when
    // used as a top-level slide type; wrap them so every deck slide is full.
    // The content element is a live DOM Node at this point, so it embeds via
    // mountTree's DOM-passthrough (no ownership transfer of its cleanup).
    if (CONTENT_ONLY_LAYOUTS.has(config.type) && element && !element.classList?.contains('slide')) {
        const wrapperSpec = spec('div', {
            className: 'slide center',
            dataset: { layout: String(config.type) },
            children: [
                spec('div', { className: 'slide-container', children: [ element ] })
            ]
        });
        element = composer.mountTree(wrapperSpec, null, { documentRef }).root;
    }

    return { element, cleanup };
}

/**
 * Render a slide from its config. Returns the mounted DOM element (back-compat
 * with tests and callers that only need the element). For the cleanup function
 * (needed to tear down embedded aiui surfaces), use `buildSlide()` instead.
 *
 * @param {object} config — slide config from window.__DECK_CONFIG__.slides[i]
 * @param {object} [opts] — forwarded to `buildSlide()`
 * @returns {HTMLElement}
 */
export function renderSlide(config, opts = {}) {
    return buildSlide(config, opts).element;
}

/**
 * Fallback for unknown / missing config. Renders a centered "unsupported
 * layout" placeholder so the deck never crashes mid-presentation.
 */
export function createFallbackSlide(config = {}) {
    const fallbackSpec = spec('div', {
        className: 'slide center',
        dataset: { layout: 'fallback' },
        children: [
            spec('div', { className: 'slide-container', children: [
                spec('p', { className: 'kicker', text: 'Unknown layout' }),
                spec('h2', { className: 'headline', text: String(config?.type || '(missing type)') })
            ]})
        ]
    });
    return getDefaultComposer().mountTree(fallbackSpec).root;
}
