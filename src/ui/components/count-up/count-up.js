/**
 * count-up.js — animated number counter (Type II).
 *
 * Wraps a target element and animates from 0 (or previous value) to the target
 * over --motion-duration-enter when the element enters the viewport. Uses
 * requestAnimationFrame — cleaned up on teardown.
 *
 * CSMA rule: canvas/rAF renderers are transient. They must clean up on
 * teardown and respect prefers-reduced-motion (in which case we set the final
 * value immediately).
 *
 * @module count-up
 * @category ui/component
 */

const DEFAULT_DURATION_MS = 1200; // matches --motion-duration-enter token

/**
 * Mount a count-up on a target element.
 *
 * @param {HTMLElement} target — element whose textContent will be updated
 * @param {object} figure — `{ number, decimals, prefix, suffix }`
 * @param {object} [opts]
 * @param {number} [opts.durationMs]
 * @param {boolean} [opts.startOnEnter=true] — wait for IntersectionObserver entry
 * @param {Window} [opts.windowRef]
 * @returns {() => void} cleanup function (cancels rAF, removes observer)
 */
export function mountCountUp(target, figure, opts = {}) {
    if (!target) return () => {};
    const win = opts.windowRef || (typeof window !== 'undefined' ? window : null);
    const doc = target.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!win || !doc) {
        target.textContent = formatFigure(figure);
        return () => {};
    }

    const duration = Number.isFinite(opts.durationMs) ? opts.durationMs : DEFAULT_DURATION_MS;
    const startOnEnter = opts.startOnEnter !== false;

    const n = Number(figure?.number);
    if (!Number.isFinite(n)) {
        target.textContent = formatFigure(figure);
        return () => {};
    }

    const decimals = Number.isFinite(figure?.decimals) ? figure.decimals : 0;
    const prefix = figure?.prefix || '';
    const suffix = figure?.suffix || '';

    const reduced = prefersReducedMotion(win);
    if (reduced) {
        target.textContent = prefix + formatNum(n, decimals) + suffix;
        return () => {};
    }

    let rafId = null;
    let observer = null;
    let started = false;
    let startTs = 0;
    let startVal = 0;

    const tick = (ts) => {
        if (!startTs) startTs = ts;
        const progress = Math.min(1, (ts - startTs) / duration);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
        const current = startVal + (n - startVal) * eased;
        target.textContent = prefix + formatNum(current, decimals) + suffix;
        if (progress < 1) {
            rafId = win.requestAnimationFrame(tick);
        } else {
            target.textContent = prefix + formatNum(n, decimals) + suffix;
            rafId = null;
        }
    };

    const start = () => {
        if (started) return;
        started = true;
        startTs = 0;
        startVal = 0;
        rafId = win.requestAnimationFrame(tick);
    };

    if (startOnEnter && typeof win.IntersectionObserver === 'function') {
        observer = new win.IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    start();
                    observer.disconnect();
                    observer = null;
                }
            }
        }, { threshold: 0.5 });
        observer.observe(target);
    } else {
        start();
    }

    return () => {
        if (rafId) win.cancelAnimationFrame(rafId);
        rafId = null;
        if (observer) observer.disconnect();
        observer = null;
    };
}

/**
 * Initialize the count-up system (Type II lifecycle).
 *
 * Auto-mounts every [data-count-up] element in the document. The eventBus
 * parameter is part of the Type II contract; count-up itself needs no events.
 *
 * @param {import('../../../runtime/EventBus.js').EventBus} _eventBus
 * @returns {() => void} cleanup
 */
export function initCountUpSystem(_eventBus) {
    const doc = typeof document !== 'undefined' ? document : null;
    const win = typeof window !== 'undefined' ? window : null;
    if (!doc || !win) return () => {};
    const targets = Array.from(doc.querySelectorAll('[data-count-up]'));
    const cleanups = targets.map((el) => mountCountUp(el, {
        number: Number(el.dataset.number ?? el.textContent),
        decimals: Number.isFinite(Number(el.dataset.decimals)) ? Number(el.dataset.decimals) : undefined,
        prefix: el.dataset.prefix || '',
        suffix: el.dataset.suffix || '',
    }, { startOnEnter: el.dataset.startOnEnter !== 'false' }));
    return () => cleanups.forEach((fn) => fn());
}

function prefersReducedMotion(win) {
    try {
        return win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

function formatNum(n, decimals) {
    if (decimals > 0) return n.toFixed(decimals);
    return String(Math.round(n));
}

/**
 * Format a figure spec into a display string.
 *
 * Accepts `{ number, decimals, prefix, suffix }` or a primitive.
 * @param {object|number|string|null|undefined} spec
 * @returns {string}
 */
function formatFigure(spec) {
    if (spec == null) return '';
    if (typeof spec === 'number') return String(spec);
    if (typeof spec === 'string') return spec;
    const n = Number(spec.number);
    if (!Number.isFinite(n)) return '';
    const decimals = Number.isFinite(spec.decimals) ? spec.decimals : 0;
    const prefix = spec.prefix || '';
    const suffix = spec.suffix || '';
    const formatted = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
    return prefix + formatted + suffix;
}
