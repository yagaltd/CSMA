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
import { el } from './_shared.js';

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
 * Render a slide from its config.
 *
 * @param {object} config — slide config from window.__DECK_CONFIG__.slides[i]
 * @returns {HTMLElement}
 */
export function renderSlide(config) {
    if (!config || typeof config !== 'object') {
        return createFallbackSlide(config);
    }
    const factory = LAYOUT_FACTORIES[config.type];
    if (!factory) {
        return createFallbackSlide(config);
    }
    const result = factory(config);
    if (CONTENT_ONLY_LAYOUTS.has(config.type) && result && !result.classList?.contains('slide')) {
        // Wrap embedded-style layouts in a centered slide shell
        const shell = el('div', { className: 'slide center' });
        shell.dataset.layout = String(config.type);
        const inner = el('div', { className: 'slide-container' });
        inner.appendChild(result);
        shell.appendChild(inner);
        return shell;
    }
    return result;
}

/**
 * Fallback for unknown / missing config. Renders a centered "unsupported
 * layout" placeholder so the deck never crashes mid-presentation.
 */
export function createFallbackSlide(config = {}) {
    const slide = el('div', { className: 'slide center', dataset: { layout: 'fallback' } });
    const container = el('div', { className: 'slide-container' });
    container.appendChild(el('p', { className: 'kicker', text: 'Unknown layout' }));
    container.appendChild(el('h2', { className: 'headline', text: String(config?.type || '(missing type)') }));
    slide.appendChild(container);
    return slide;
}
