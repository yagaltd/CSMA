/**
 * build.js — click-build reveal element factory.
 *
 * A `.build` wrapper toggles `data-visible` based on the current click count
 * relative to its `at` step. The CSS handles the opacity/transform/filter
 * transition (see slides.css §build).
 *
 * On mount, each Build element calls `service.registerMax(at, slideIndex)` so
 * the service knows the slide's build ceiling. On BUILD_ADVANCED events, the
 * element updates its `data-visible` attribute based on `clicks >= at`.
 *
 * Pure DOM construction. textContent for all user strings.
 */

/**
 * Create a build-reveal wrapper.
 *
 * @param {object} opts
 * @param {number} opts.at — 1-indexed build step at which this element becomes visible
 * @param {HTMLElement[]} [opts.children] — DOM nodes to wrap
 * @param {object} [opts.service] — SlideDeckService (for registerMax)
 * @param {number} [opts.slideIndex] — slide index this build lives on
 * @param {number} [opts.currentClicks] — initial clicks (for first render)
 * @returns {HTMLElement} `.build` wrapper with `data-visible` set
 */
export function createBuildElement({ at, children = [], service = null, slideIndex, currentClicks = 0 } = {}) {
    const step = Math.max(1, Number(at) || 1);
    const wrap = document.createElement('div');
    wrap.className = 'build';
    wrap.dataset.buildStep = String(step);
    wrap.dataset.visible = currentClicks >= step ? 'true' : 'false';

    for (const child of children) {
        if (child instanceof Node) wrap.appendChild(child);
    }

    if (service && typeof service.registerMax === 'function') {
        service.registerMax(step, slideIndex);
    }

    return wrap;
}

/**
 * Subscribe a build element to BUILD_ADVANCED events for its slide.
 * Returns an unsubscribe function.
 */
export function bindBuildToService(buildEl, eventBus, slideIndex) {
    if (!eventBus?.subscribe) return () => {};
    const step = Number(buildEl.dataset.buildStep) || 1;
    const handler = (payload) => {
        if (Number.isFinite(slideIndex) && payload?.slide !== slideIndex) return;
        buildEl.dataset.visible = (payload?.click || 0) >= step ? 'true' : 'false';
    };
    return eventBus.subscribe('BUILD_ADVANCED', handler);
}

/**
 * Re-render a build element's visibility state from raw clicks.
 * Used by deck.js when first rendering a slide that already has clicks > 0
 * (e.g. navigating back).
 */
export function syncBuildVisibility(buildEl, clicks) {
    const step = Number(buildEl.dataset.buildStep) || 1;
    buildEl.dataset.visible = (clicks || 0) >= step ? 'true' : 'false';
}
