/**
 * Stats Dashboard Archetype — CSMA Token-Driven Metric Cards
 *
 * Factory: createStatsDashboard(container, emit, options) → { update, destroy, refresh }
 *
 * Phase 3.1 — aiui-native (Option a: factory-wrapping). All DOM construction
 * routes through `getComposer().mountTree(spec, target)`; no raw
 * `document.createElement` in archetype internals. Cards and charts re-mount
 * via spec arrays on each render cycle; chart renderer DOM (returned by
 * `options.renderChart`) is slotted via post-mount `appendChild` (mountTree
 * allows DOM Node passthrough inside spec trees).
 *
 * Features:
 * - Responsive auto-grid of stat cards
 * - Declarative metric definitions (label, fetch, format)
 * - Optional trend indicators (up/down/neutral)
 * - Optional charts section with explicit renderer hook or text summary fallback
 * - Loading / empty / error states
 * - Skeleton loading animation per card
 * - CSMA design tokens for all visual values
 */

import { spec, getComposer } from '../../ai-ui/specHelpers.js';
import { clearChildren } from '../../../utils/dom.js';

// ─── SVG icon specs (composed through mountTree like all other DOM) ────

function svgIconSpec(children) {
    return spec('svg', {
        attrs: {
            viewBox: '0 0 12 12',
            fill: 'none',
            'aria-hidden': 'true',
            focusable: 'false'
        },
        children
    });
}

function trendIconSpec(direction) {
    if (direction === 'up') {
        return svgIconSpec([spec('path', { attrs: { d: 'M6 2L10 7H2L6 2Z', fill: 'currentColor' } })]);
    }
    if (direction === 'down') {
        return svgIconSpec([spec('path', { attrs: { d: 'M6 10L2 5H10L6 10Z', fill: 'currentColor' } })]);
    }
    return svgIconSpec([spec('rect', { attrs: { x: '2', y: '5', width: '8', height: '2', rx: '1', fill: 'currentColor' } })]);
}

const FORMATTERS = {
    number: (v) => Number(v).toLocaleString(),
    bytes: (v) => {
        const n = Number(v);
        if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
        return n + ' B';
    },
    percent: (v) => Number(v).toFixed(1) + '%',
    duration: (v) => {
        const s = Math.round(Number(v));
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    },
    currency: (v) => '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }),
};

// ─── Spec builders ────────────────────────────────────────────────────

function cardSpec(cardDef, data, loading) {
    const children = [spec('div', { className: 'csma-stats__card-label', text: cardDef.label })];

    if (data == null && loading) {
        children.push(spec('div', { className: 'csma-stats__skeleton' }));
    } else {
        const fmt = FORMATTERS[cardDef.format] || FORMATTERS.number;
        children.push(spec('div', {
            className: 'csma-stats__card-value',
            text: fmt(data != null ? (data.value != null ? data.value : data) : 0)
        }));

        if (data && data.trend != null) {
            const dir = data.trend > 0 ? 'up' : data.trend < 0 ? 'down' : 'neutral';
            children.push(spec('div', {
                className: 'csma-stats__card-trend',
                dataset: { direction: dir },
                children: [
                    trendIconSpec(dir),
                    ` ${Math.abs(data.trend)}%`
                ]
            }));
        }
    }

    return spec('div', {
        className: 'csma-stats__card',
        dataset: { cardId: cardDef.id },
        children
    });
}

function chartSpec(chartDef) {
    return spec('div', {
        className: 'csma-stats__chart',
        dataset: { chartId: chartDef.id },
        children: [
            spec('div', { className: 'csma-stats__chart-label', text: chartDef.label }),
            // Summary <p> rendered when no renderChart callback; if renderChart
            // is provided, its DOM is appended post-mount (mountTree Node
            // passthrough), and the summary is removed.
            spec('p', {
                className: 'csma-stats__chart-summary',
                text: chartDef.description || `Chart: ${chartDef.label}`
            })
        ]
    });
}

export function createStatsDashboard(container, emit, options = {}) {
    const {
        cards = [],
        charts = [],
        cols = { sm: 2, md: 3, lg: 4 },
        emptyMessage = 'No metrics to display',
        loadingMessage = 'Loading metrics…',
        errorMessage = 'Failed to load metrics',
    } = options;

    const composer = getComposer();

    let isLoading = cards.some(c => c.fetch);
    let error = null;
    let cardData = {};

    // ─── Initial mount (static shell with all state overlays) ──

    const { root, cleanup } = composer.mountTree(spec('div', {
        className: 'csma-stats',
        attrs: { role: 'region', 'aria-label': 'Stats dashboard' },
        children: [
            spec('div', { className: 'csma-stats__grid' }),
            spec('div', { className: 'csma-stats__charts' }),
            spec('div', {
                className: 'csma-stats__state',
                dataset: { state: 'loading' },
                attrs: { role: 'status' },
                children: [
                    spec('div', { className: 'csma-stats__spinner' }),
                    spec('span', { className: 'csma-stats__state-message', text: loadingMessage })
                ]
            }),
            spec('div', {
                className: 'csma-stats__state',
                dataset: { state: 'empty' },
                attrs: { role: 'status' },
                children: [
                    spec('span', { className: 'csma-stats__state-message', text: emptyMessage })
                ]
            }),
            spec('div', {
                className: 'csma-stats__state',
                dataset: { state: 'error' },
                attrs: { role: 'status' },
                children: [
                    spec('span', { className: 'csma-stats__state-message', text: errorMessage }),
                    spec('button', { className: 'csma-stats__state-retry', text: 'Retry' })
                ]
            })
        ]
    }), container);

    if (isLoading) root.dataset.state = 'loading';

    // Cached post-mount references
    const grid = root.querySelector('.csma-stats__grid');
    const chartsEl = root.querySelector('.csma-stats__charts');

    // Wire retry button (event wiring on mounted DOM — allowed by the pattern)
    root.querySelector('.csma-stats__state-retry').addEventListener('click', () => loadAll());

    // ─── Render ────────────────────────────────────────

    function renderCards() {
        clearChildren(grid);
        if (cards.length === 0) return;
        const cardSpecs = cards.map((cardDef) => cardSpec(cardDef, cardData[cardDef.id], isLoading));
        const { root: frag } = composer.mountTree(cardSpecs);
        // Post-mount: skeleton inline width (mountTree forbids style attr;
        // .style.width post-mount is the documented exception).
        frag.querySelectorAll('.csma-stats__skeleton').forEach((s) => {
            s.style.width = '60%';
        });
        grid.appendChild(frag);
    }

    function renderChartsDOM() {
        clearChildren(chartsEl);
        if (charts.length === 0) {
            chartsEl.setAttribute('hidden', '');
            return;
        }
        chartsEl.removeAttribute('hidden');
        const chartSpecs = charts.map((cd) => chartSpec(cd));
        const { root: frag } = composer.mountTree(chartSpecs);
        // Post-mount: if renderChart callback is provided, replace the summary
        // <p> with the renderer's DOM Node. Otherwise the summary stays.
        const chartEls = [...frag.children];
        charts.forEach((chartDef, i) => {
            if (typeof options.renderChart === 'function') {
                const chartEl = chartEls[i];
                const summary = chartEl.querySelector('.csma-stats__chart-summary');
                const rendered = options.renderChart(chartDef, { emit, container: chartEl });
                if (summary) summary.remove();
                if (rendered instanceof Node) {
                    chartEl.appendChild(rendered);
                }
            }
        });
        chartsEl.appendChild(frag);
    }

    function renderAll() {
        renderCards();
        renderChartsDOM();
    }

    function setState(state) {
        delete root.dataset.state;
        if (state) root.dataset.state = state;
    }

    // ─── Data Loading ──────────────────────────────────

    async function loadAll() {
        if (!cards.some(c => c.fetch)) {
            setState(cards.length === 0 ? 'empty' : null);
            renderAll();
            return;
        }

        setState('loading');
        isLoading = true;
        error = null;

        try {
            const results = await Promise.allSettled(
                cards.map(async (cardDef) => {
                    if (!cardDef.fetch) return { id: cardDef.id, value: 0 };
                    const data = await cardDef.fetch();
                    return { id: cardDef.id, ...(typeof data === 'object' && data !== null ? data : { value: data }) };
                })
            );

            results.forEach((r) => {
                if (r.status === 'fulfilled') {
                    cardData[r.value.id] = r.value;
                } else {
                    cardData[r.value?.id || 'unknown'] = { value: 0, _error: r.reason?.message };
                }
            });

            isLoading = false;
            setState(null);
            renderAll();
        } catch (err) {
            error = err;
            isLoading = false;
            setState('error');
            if (emit) emit('stats:error', { error: err.message || String(err) });
        }
    }

    // ─── Initial Render ────────────────────────────────

    renderAll();

    if (cards.some(c => c.fetch)) {
        loadAll();
    } else if (cards.length === 0) {
        setState('empty');
    }

    // ─── Public API ────────────────────────────────────

    return {
        /** Refresh all card data (re-fetches). */
        refresh() {
            loadAll();
        },

        /** Update dashboard runtime data for existing card definitions. */
        update(data = {}) {
            cardData = data;
            renderAll();
        },

        /** Get current card data. */
        getData() {
            return cardData;
        },

        /** Destroy the dashboard. */
        destroy() {
            cleanup();
            root.remove();
        },
    };
}
